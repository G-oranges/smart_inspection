package service

import (
	"database/sql/driver"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/pkg/email"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/gorm"
)

type AuthService interface {
	Login(username, password string) (accessToken, refreshToken string, user *model.User, isTempPwd bool, err error)
	RefreshToken(token string) (accessToken, refreshToken string, err error)
	VerifyPassword(id, password string) (string, error)
	ChangePassword(id, oldPassword, newPassword string) error
	// 检查用户绑定的邮箱（返回部分隐藏的邮箱）
	CheckUserEmail(username string) (maskedEmail string, err error)
	// 忘记密码：验证用户名和邮箱匹配后发送验证码
	ForgotPassword(username, emailAddr string) error
	// 通过验证码重置密码
	ResetPasswordByCode(emailAddr, code, newPassword string) error
}

type authService struct {
	db           *gorm.DB
	emailService *email.Service
}

func NewAuthService(db *gorm.DB) AuthService {
	return &authService{
		db:           db,
		emailService: email.NewService(),
	}
}

func (s *authService) Login(username, password string) (string, string, *model.User, bool, error) {
	var user model.User
	var isTempPwd bool
	// 查找用户及其角色信息
	err := s.db.Preload("Roles").Where("username = ?", username).First(&user).Error
	if err != nil && (errors.Is(err, driver.ErrBadConn) || strings.Contains(err.Error(), "invalid connection")) {
		// 可能是连接池中的死连接，重试一次
		err = s.db.Preload("Roles").Where("username = ?", username).First(&user).Error
	}

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", "", nil, false, errors.New("用户名或密码错误")
		}
		return "", "", nil, false, err
	}

	if user.IsDisabled {
		return "", "", nil, false, errors.New("账户已被禁用")
	}

	// 验证密码
	err = utils.ComparePasswords(user.Password, password)
	if err != nil {
		// 尝试从 Redis 获取临时密码
		tempHashed, redisErr := utils.GetCache("temp_pwd:" + user.ID)
		if redisErr == nil {
			err = utils.ComparePasswords(tempHashed, password)
			if err == nil {
				// 临时密码验证成功，立即删除（单次使用）
				isTempPwd = true
				utils.DelCache("temp_pwd:" + user.ID)
			}
		}

		if err != nil {
			return "", "", nil, false, errors.New("用户名或密码错误")
		}
	}

	// 生成 Access Token（带版本号）
	accessToken, err := utils.GenerateAccessToken(user.ID, user.Role, user.TokenVersion)
	if err != nil {
		return "", "", nil, false, err
	}

	// 生成 Refresh Token（带版本号）
	refreshToken, err := utils.GenerateRefreshToken(user.ID, user.TokenVersion)
	if err != nil {
		return "", "", nil, false, err
	}

	return accessToken, refreshToken, &user, isTempPwd, nil
}

func (s *authService) ChangePassword(id, oldPassword, newPassword string) error {
	var user model.User
	if err := s.db.Where("id = ?", id).First(&user).Error; err != nil {
		// 修改密码操作也加上连接重试
		if errors.Is(err, driver.ErrBadConn) || strings.Contains(err.Error(), "invalid connection") {
			err = s.db.Where("id = ?", id).First(&user).Error
		}
		if err != nil {
			return errors.New("用户不存在")
		}
	}

	// 验证旧密码
	if err := utils.ComparePasswords(user.Password, oldPassword); err != nil {
		return errors.New("旧密码不正确")
	}

	// 验证新密码强度
	if !utils.IsStrongPassword(newPassword) {
		return errors.New("新密码不符合复杂度要求（必须包含大小写字母、数字及标点符号，且不少于 8 位）")
	}

	// 哈希存储
	hashed, err := utils.HashPassword(newPassword)
	if err != nil {
		return err
	}

	// 更新密码并递增 tokenVersion（使旧 Token 失效）
	if err := s.db.Model(&user).Updates(map[string]interface{}{
		"password":     hashed,
		"tokenVersion": gorm.Expr("tokenVersion + 1"),
	}).Error; err != nil {
		return err
	}

	// 清理可能的临时密码和用户状态缓存
	utils.DelCache("temp_pwd:"+id, "user:status:"+id)

	return nil
}

func (s *authService) RefreshToken(tokenString string) (string, string, error) {
	// 先检查 Refresh Token 是否已被列入黑名单
	if utils.IsRefreshTokenBlacklisted(tokenString) {
		return "", "", errors.New("刷新令牌已失效")
	}

	claims, err := utils.ParseRefreshToken(tokenString)
	if err != nil {
		return "", "", err
	}

	var user model.User
	if err := s.db.Where("id = ?", claims.ID).First(&user).Error; err != nil {
		// 刷新 Token 时也可能碰到死连接
		if errors.Is(err, driver.ErrBadConn) || strings.Contains(err.Error(), "invalid connection") {
			err = s.db.Where("id = ?", claims.ID).First(&user).Error
		}
		if err != nil {
			return "", "", errors.New("用户不存在")
		}
	}

	if user.IsDisabled {
		return "", "", errors.New("账户已被禁用")
	}

	// 校验 Token 版本号（改密/禁用后旧 Refresh Token 失效）
	if claims.TokenVersion != user.TokenVersion {
		return "", "", errors.New("凭证已失效，请重新登录")
	}

	// 生成新的 Access Token（带当前版本号）
	newAccessToken, err := utils.GenerateAccessToken(user.ID, user.Role, user.TokenVersion)
	if err != nil {
		return "", "", err
	}

	// 如果刷新令牌即将过期（剩余不足1天），生成新的刷新令牌（Token 轮转）
	var newRefreshToken string
	if time.Until(claims.ExpiresAt.Time) < 24*time.Hour {
		newRefreshToken, _ = utils.GenerateRefreshToken(user.ID, user.TokenVersion)
		// 将旧 Refresh Token 加入黑名单，TTL 为旧 Token 剩余有效期
		ttl := time.Until(claims.ExpiresAt.Time)
		if ttl > 0 {
			utils.BlacklistRefreshToken(tokenString, ttl)
		}
	}

	return newAccessToken, newRefreshToken, nil
}

func (s *authService) VerifyPassword(id, password string) (string, error) {
	var user model.User
	if err := s.db.Where("id = ?", id).First(&user).Error; err != nil {
		return "", errors.New("用户不存在")
	}

	if err := utils.ComparePasswords(user.Password, password); err != nil {
		return "", errors.New("密码错误")
	}

	// 生成一个短期的"已验证"令牌 (5分钟)
	secret := []byte(os.Getenv("JWT_SECRET"))
	if len(secret) == 0 {
		secret = []byte("default_secret_for_dev_only")
	}

	claims := &utils.Claims{
		ID:   user.ID,
		Type: "verified",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

// CheckUserEmail 检查用户绑定的邮箱，返回部分隐藏的邮箱地址
func (s *authService) CheckUserEmail(username string) (string, error) {
	var user model.User
	if err := s.db.Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", errors.New("用户名不存在")
		}
		return "", err
	}

	if user.IsDisabled {
		return "", errors.New("账户已被禁用")
	}

	// 检查是否绑定了邮箱
	if user.Email == nil || *user.Email == "" {
		return "", errors.New("该账号未绑定邮箱，请联系管理员重置密码")
	}

	// 返回部分隐藏的邮箱（例如：z***g@example.com）
	maskedEmail := maskEmail(*user.Email)
	return maskedEmail, nil
}

// maskEmail 将邮箱地址部分隐藏
func maskEmail(email string) string {
	parts := splitEmail(email)
	if len(parts) != 2 {
		return "***@***"
	}

	local := parts[0]
	domain := parts[1]

	// 本地部分隐藏处理
	var maskedLocal string
	if len(local) <= 2 {
		maskedLocal = local[:1] + "***"
	} else {
		maskedLocal = local[:1] + "***" + local[len(local)-1:]
	}

	return maskedLocal + "@" + domain
}

// splitEmail 分割邮箱的本地部分和域名部分
func splitEmail(email string) []string {
	for i := len(email) - 1; i >= 0; i-- {
		if email[i] == '@' {
			return []string{email[:i], email[i+1:]}
		}
	}
	return []string{email}
}

// ForgotPassword 忘记密码：验证用户名和邮箱匹配后发送验证码
func (s *authService) ForgotPassword(username, emailAddr string) error {
	// 检查邮件服务是否配置
	if !s.emailService.IsConfigured() {
		return errors.New("邮件服务未配置，请联系管理员")
	}

	// 根据用户名查找用户
	var user model.User
	if err := s.db.Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("用户名不存在")
		}
		return err
	}

	if user.IsDisabled {
		return errors.New("账户已被禁用，无法重置密码")
	}

	// 检查用户是否绑定了邮箱
	if user.Email == nil || *user.Email == "" {
		return errors.New("该账号未绑定邮箱，请联系管理员重置密码")
	}

	// 验证输入的邮箱与绑定的邮箱是否一致
	if *user.Email != emailAddr {
		return errors.New("输入的邮箱与账号绑定的邮箱不一致")
	}

	// 检查是否频繁请求（1分钟内只能请求一次）
	rateLimitKey := "pwd_reset_limit:" + emailAddr
	if _, err := utils.GetCache(rateLimitKey); err == nil {
		return errors.New("请求过于频繁，请1分钟后再试")
	}

	// 生成验证码
	code := email.GenerateVerificationCode()

	// 存储到 Redis，有效期 5 分钟
	cacheKey := "pwd_reset_code:" + emailAddr
	if err := utils.SetCache(cacheKey, code, 5*time.Minute); err != nil {
		return fmt.Errorf("验证码存储失败: %v", err)
	}

	// 设置速率限制标记（1分钟）
	utils.SetCache(rateLimitKey, "1", 1*time.Minute)

	// 发送邮件
	if err := s.emailService.SendPasswordResetEmail(emailAddr, code, user.FullName); err != nil {
		// 发送失败时清除验证码
		utils.DelCache(cacheKey)
		return fmt.Errorf("邮件发送失败: %v", err)
	}

	return nil
}

// ResetPasswordByCode 通过验证码重置密码
func (s *authService) ResetPasswordByCode(emailAddr, code, newPassword string) error {
	// 获取存储的验证码
	cacheKey := "pwd_reset_code:" + emailAddr
	storedCode, err := utils.GetCache(cacheKey)
	if err != nil {
		return errors.New("验证码已过期或不存在，请重新获取")
	}

	// 验证码校验
	if storedCode != code {
		return errors.New("验证码错误")
	}

	// 查找用户
	var user model.User
	if err := s.db.Where("email = ?", emailAddr).First(&user).Error; err != nil {
		return errors.New("用户不存在")
	}

	// 验证新密码强度
	if !utils.IsStrongPassword(newPassword) {
		return errors.New("新密码不符合复杂度要求（必须包含大小写字母、数字及标点符号，且不少于 8 位）")
	}

	// 哈希存储
	hashed, err := utils.HashPassword(newPassword)
	if err != nil {
		return err
	}

	// 更新密码并递增 tokenVersion（使旧 Token 失效）
	if err := s.db.Model(&user).Updates(map[string]interface{}{
		"password":     hashed,
		"tokenVersion": gorm.Expr("tokenVersion + 1"),
	}).Error; err != nil {
		return err
	}

	// 清理验证码、临时密码和用户状态缓存
	utils.DelCache(cacheKey, "temp_pwd:"+user.ID, "user:status:"+user.ID)

	return nil
}
