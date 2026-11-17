package utils

import (
	"crypto/rand"
	"crypto/subtle"
	"errors"
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

// GenerateRandomPassword 生成包含大小写字母、数字和标点的随机字符串（加密安全随机数）。
// 结果保证每类字符至少出现一次，因此长度 >= 8 时一定满足 IsStrongPassword。
func GenerateRandomPassword(length int) string {
	const (
		upper   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
		lower   = "abcdefghijklmnopqrstuvwxyz"
		digits  = "0123456789"
		symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?"
	)
	classes := []string{upper, lower, digits, symbols}
	if length < len(classes) {
		length = len(classes)
	}
	all := upper + lower + digits + symbols
	result := make([]byte, length)
	for i := 0; i < length; i++ {
		charset := all
		if i < len(classes) {
			charset = classes[i]
		}
		result[i] = charset[secureIntn(len(charset))]
	}
	// Fisher-Yates shuffle so the guaranteed characters are not always at the front.
	for i := length - 1; i > 0; i-- {
		j := secureIntn(i + 1)
		result[i], result[j] = result[j], result[i]
	}
	return string(result)
}

func secureIntn(n int) int {
	num, err := rand.Int(rand.Reader, big.NewInt(int64(n)))
	if err != nil {
		panic("crypto/rand unavailable: " + err.Error())
	}
	return int(num.Int64())
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

// GetDefaultInitialPassword 获取批量导入账号使用的初始密码，只从环境变量 DEFAULT_INITIAL_PASSWORD 读取。
// 未配置时返回空字符串，调用方必须报错，而不是回退到写在源码里的公开密码。
func GetDefaultInitialPassword() string {
	return os.Getenv("DEFAULT_INITIAL_PASSWORD")
}

// HashDefaultInitialPassword 获取哈希后的默认初始密码
func HashDefaultInitialPassword() (string, error) {
	password := GetDefaultInitialPassword()
	if password == "" {
		return "", errors.New("未配置 DEFAULT_INITIAL_PASSWORD，无法为导入账号设置初始密码")
	}
	return HashPassword(password)
}

// IsDefaultInitialPassword 判断明文密码是否就是批量导入使用的初始密码。
func IsDefaultInitialPassword(plain string) bool {
	initial := GetDefaultInitialPassword()
	return initial != "" && subtle.ConstantTimeCompare([]byte(initial), []byte(plain)) == 1
}
