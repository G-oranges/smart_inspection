//go:build ignore

package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

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

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal("Failed to connect:", err)
	}
	defer db.Close()

	// 查看 user 表结构
	rows, err := db.Query("DESCRIBE user")
	if err != nil {
		log.Fatal("Failed to describe table:", err)
	}
	defer rows.Close()

	fmt.Println("\n=== user 表结构 ===")
	for rows.Next() {
		var field, colType, null, key string
		var defaultVal, extra sql.NullString
		rows.Scan(&field, &colType, &null, &key, &defaultVal, &extra)
		fmt.Printf("  %s (%s)\n", field, colType)
	}
}

func convertDSN(prismaDSN string) string {
	prefix := "mysql://"
	if len(prismaDSN) <= len(prefix) {
		return prismaDSN
	}

	trimmed := prismaDSN[len(prefix):]

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
