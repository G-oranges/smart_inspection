//go:build ignore

package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type User struct {
	ID           string `gorm:"column:id"`
	Username     string `gorm:"column:username"`
	FullName     string `gorm:"column:fullName"`
	TokenVersion int    `gorm:"column:tokenVersion"`
	IsDisabled   bool   `gorm:"column:isDisabled"`
}

func main() {
	// 加载环境变量
	godotenv.Load("../.env")

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL not set")
	}

	// 转换 DSN 格式
	dsn = convertDSN(dsn)
	fmt.Println("Connecting to:", dsn)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect:", err)
	}

	var user User
	if err := db.Table("user").Where("username = ?", "root").First(&user).Error; err != nil {
		log.Fatal("Failed to query user:", err)
	}

	fmt.Printf("\n=== root 用户信息 ===\n")
	fmt.Printf("ID: %s\n", user.ID)
	fmt.Printf("用户名: %s\n", user.Username)
	fmt.Printf("姓名: %s\n", user.FullName)
	fmt.Printf("TokenVersion: %d\n", user.TokenVersion)
	fmt.Printf("IsDisabled: %v\n", user.IsDisabled)
}

func convertDSN(prismaDSN string) string {
	// mysql://user:password@host:port/database -> user:password@tcp(host:port)/database?parseTime=true
	prefix := "mysql://"
	if len(prismaDSN) <= len(prefix) {
		return prismaDSN
	}

	trimmed := prismaDSN[len(prefix):]
	// trimmed = user:password@host:port/database

	atIndex := -1
	for i := len(trimmed) - 1; i >= 0; i-- {
		if trimmed[i] == '@' {
			atIndex = i
			break
		}
	}
	if atIndex == -1 {
		return prismaDSN
	}

	userPass := trimmed[:atIndex]
	hostDbPart := trimmed[atIndex+1:]

	slashIndex := -1
	for i := 0; i < len(hostDbPart); i++ {
		if hostDbPart[i] == '/' {
			slashIndex = i
			break
		}
	}
	if slashIndex == -1 {
		return prismaDSN
	}

	hostPort := hostDbPart[:slashIndex]
	database := hostDbPart[slashIndex+1:]

	return fmt.Sprintf("%s@tcp(%s)/%s?parseTime=true", userPass, hostPort, database)
}
