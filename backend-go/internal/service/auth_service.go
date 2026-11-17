package service

import (
	"crypto/subtle"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"
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
				// 临时密码验证成功：把它设为当前密码（这样修改密码时可作为“当前密码”填写），
				// 使其他会话失效，并删除临时密码（单次使用）
				isTempPwd = true
				if updateErr := s.db.Model(&model.User{}).Where("id = ?", user.ID).Updates(map[string]interface{}{
					"password":           tempHashed,
					"tokenVersion":       gorm.Expr("tokenVersion + 1"),
					"mustChangePassword": true,
				}).Error; updateErr != nil {
					return "", "", nil, false, updateErr
				}
				user.Password = tempHashed
				user.TokenVersion++
				user.MustChangePassword = true
				utils.DelCache("temp_pwd:" + user.ID)
			}
		}

		if err != nil {
			return "", "", nil, false, errors.New("用户名或密码错误")
		}
	}

	// 使用批量导入的初始密码或临时密码登录时，标记为必须修改密码（后端在修改前会限制访问）
	if !user.MustChangePassword && (isTempPwd || utils.IsDefaultInitialPassword(password)) {
		if err := s.db.Model(&model.User{}).Where("id = ?", user.ID).Update("mustChangePassword", true).Error; err != nil {
			return "", "", nil, false, err
		}
		user.MustChangePassword = true
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
	if newPassword == oldPassword {
		return errors.New("新密码不能与当前密码相同")
	}
	if utils.IsDefaultInitialPassword(newPassword) {
		return errors.New("新密码不能与系统初始密码相同")
	}

	// 哈希存储
	hashed, err := utils.HashPassword(newPassword)
	if err != nil {
		return err
	}

	// 更新密码、递增 tokenVersion（使旧 Token 失效），并解除“必须修改密码”状态
	if err := s.db.Model(&user).Updates(map[string]interface{}{
		"password":           hashed,
		"tokenVersion":       gorm.Expr("tokenVersion + 1"),
		"mustChangePassword": false,
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

// recoveryUnavailableMessage 账号不存在、已禁用、未绑定邮箱时统一返回的提示，避免被用来探测账号。
const recoveryUnavailableMessage = "无法通过邮箱找回该账号的密码，请联系管理员重置"

// CheckUserEmail 检查用户绑定的邮箱，返回部分隐藏的邮箱地址
func (s *authService) CheckUserEmail(username string) (string, error) {
	var user model.User
	if err := s.db.Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", errors.New(recoveryUnavailableMessage)
		}
		return "", err
	}

	if user.IsDisabled || user.Email == nil || strings.TrimSpace(*user.Email) == "" {
		return "", errors.New(recoveryUnavailableMessage)
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
	if local == "" {
		return "***@" + domain
	}

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

	// 根据用户名查找用户。账号不存在、已禁用、未绑定邮箱或邮箱不一致时，
	// 都按“已发送”处理且不发邮件，避免通过返回信息判断账号与邮箱是否匹配。
	var user model.User
	if err := s.db.Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	if user.IsDisabled || user.Email == nil || !strings.EqualFold(strings.TrimSpace(*user.Email), strings.TrimSpace(emailAddr)) {
		return nil
	}
	emailAddr = strings.ToLower(strings.TrimSpace(emailAddr))

	// 检查是否频繁请求（1分钟内只能请求一次）
	rateLimitKey := "pwd_reset_limit:" + emailAddr
	if _, err := utils.GetCache(rateLimitKey); err == nil {
		return errors.New("请求过于频繁，请1分钟后再试")
	}

	// 生成验证码
	code := email.GenerateVerificationCode()

	// 存储到 Redis，有效期 5 分钟。验证码与具体用户 ID 绑定，避免同邮箱多账号时重置错人
	cacheKey := "pwd_reset_code:" + emailAddr
	payload, _ := json.Marshal(resetCodeEntry{UserID: user.ID, Code: code})
	if err := utils.SetCache(cacheKey, string(payload), resetCodeTTL); err != nil {
		return fmt.Errorf("验证码存储失败: %v", err)
	}
	utils.DelCache(resetAttemptsKey(emailAddr))

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

const (
	resetCodeTTL         = 5 * time.Minute
	maxResetCodeAttempts = 5
)

type resetCodeEntry struct {
	UserID string `json:"userId"`
	Code   string `json:"code"`
}

func resetAttemptsKey(emailAddr string) string { return "pwd_reset_attempts:" + emailAddr }

// ResetPasswordByCode 通过验证码重置密码。验证码连续输错 5 次即作废，需要重新获取。
func (s *authService) ResetPasswordByCode(emailAddr, code, newPassword string) error {
	emailAddr = strings.ToLower(strings.TrimSpace(emailAddr))
	cacheKey := "pwd_reset_code:" + emailAddr
	stored, err := utils.GetCache(cacheKey)
	if err != nil {
		return errors.New("验证码已过期或不存在，请重新获取")
	}
	var entry resetCodeEntry
	if json.Unmarshal([]byte(stored), &entry) != nil || entry.UserID == "" {
		utils.DelCache(cacheKey)
		return errors.New("验证码已过期或不存在，请重新获取")
	}

	if subtle.ConstantTimeCompare([]byte(entry.Code), []byte(strings.TrimSpace(code))) != 1 {
		attempts := 1
		if raw, err := utils.GetCache(resetAttemptsKey(emailAddr)); err == nil {
			if previous, convErr := strconv.Atoi(raw); convErr == nil {
				attempts = previous + 1
			}
		}
		if attempts >= maxResetCodeAttempts {
			utils.DelCache(cacheKey, resetAttemptsKey(emailAddr))
			return errors.New("验证码错误次数过多，请重新获取验证码")
		}
		utils.SetCache(resetAttemptsKey(emailAddr), strconv.Itoa(attempts), resetCodeTTL)
		return errors.New("验证码错误")
	}

	// 验证新密码强度
	if !utils.IsStrongPassword(newPassword) {
		return errors.New("新密码不符合复杂度要求（必须包含大小写字母、数字及标点符号，且不少于 8 位）")
	}
	if utils.IsDefaultInitialPassword(newPassword) {
		return errors.New("新密码不能与系统初始密码相同")
	}

	var user model.User
	if err := s.db.Where("id = ?", entry.UserID).First(&user).Error; err != nil {
		utils.DelCache(cacheKey)
		return errors.New("验证码已过期或不存在，请重新获取")
	}

	// 哈希存储
	hashed, err := utils.HashPassword(newPassword)
	if err != nil {
		return err
	}

	// 更新密码并递增 tokenVersion（使旧 Token 失效）
	if err := s.db.Model(&user).Updates(map[string]interface{}{
		"password":           hashed,
		"tokenVersion":       gorm.Expr("tokenVersion + 1"),
		"mustChangePassword": false,
	}).Error; err != nil {
		return err
	}

	// 清理验证码、错误次数、临时密码和用户状态缓存
	utils.DelCache(cacheKey, resetAttemptsKey(emailAddr), "temp_pwd:"+user.ID, "user:status:"+user.ID)

	return nil
}
