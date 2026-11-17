package utils

import (
	"crypto/rand"
	"math/big"
	"os"
	"regexp"

	"golang.org/x/crypto/bcrypt"
)

// ComparePasswords 成功返回 nil，失败返回错误
func ComparePasswords(hashedPwd, plainPwd string) error {
	return bcrypt.CompareHashAndPassword([]byte(hashedPwd), []byte(plainPwd))
}

// HashPassword 生成哈希密码
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// GenerateRandomPassword 生成包含大小写字母、数字和标点的随机字符串
func GenerateRandomPassword(length int) string {
	const (
		upper   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
		lower   = "abcdefghijklmnopqrstuvwxyz"
		digits  = "0123456789"
		symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?"
	)
	all := upper + lower + digits + symbols
	result := make([]byte, length)

	// 确保至少包含各类型一个字符 (简化版，先随机填满，后续可优化)
	for i := 0; i < length; i++ {
		num, _ := rand.Int(rand.Reader, big.NewInt(int64(len(all))))
		result[i] = all[num.Int64()]
	}
	return string(result)
}

// IsStrongPassword 验证密码强度：大小写字母、数字、标点符号，不少于8位
func IsStrongPassword(password string) bool {
	if len(password) < 8 {
		return false
	}
	var (
		hasUpper   = regexp.MustCompile(`[A-Z]`).MatchString(password)
		hasLower   = regexp.MustCompile(`[a-z]`).MatchString(password)
		hasDigit   = regexp.MustCompile(`[0-9]`).MatchString(password)
		hasSymbols = regexp.MustCompile(`[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]`).MatchString(password)
	)
	return hasUpper && hasLower && hasDigit && hasSymbols
}

// GetDefaultInitialPassword 获取默认初始密码（从环境变量读取，若未配置则使用默认值）
// 用于新用户创建、密码重置等场景
func GetDefaultInitialPassword() string {
	password := os.Getenv("DEFAULT_INITIAL_PASSWORD")
	if password == "" {
		// 默认密码：符合复杂度要求
		password = "ChangeMe123!"
	}
	return password
}

// HashDefaultInitialPassword 获取哈希后的默认初始密码
func HashDefaultInitialPassword() (string, error) {
	return HashPassword(GetDefaultInitialPassword())
}
