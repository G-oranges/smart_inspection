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

	// 检查 tokenVersion 列是否存在
	var count int
	err = db.QueryRow(`
		SELECT COUNT(*) 
		FROM information_schema.COLUMNS 
		WHERE TABLE_SCHEMA = 'dorm_inspection' 
		AND TABLE_NAME = 'user' 
		AND COLUMN_NAME = 'tokenVersion'
	`).Scan(&count)
	if err != nil {
		log.Fatal("Failed to check column:", err)
	}

	if count == 0 {
		fmt.Println("\n⚠️  tokenVersion 列不存在，正在添加...")

		// 添加 tokenVersion 列，默认值为 1
		_, err = db.Exec("ALTER TABLE user ADD COLUMN tokenVersion INT NOT NULL DEFAULT 1")
		if err != nil {
			log.Fatal("Failed to add column:", err)
		}
		fmt.Println("✅ tokenVersion 列添加成功！所有用户的 tokenVersion 已设置为 1")
	} else {
		fmt.Println("\n✅ tokenVersion 列已存在")

		// 将 tokenVersion 为 0 或 NULL 的用户更新为 1
		result, err := db.Exec("UPDATE user SET tokenVersion = 1 WHERE tokenVersion = 0 OR tokenVersion IS NULL")
		if err != nil {
			log.Fatal("Failed to update:", err)
		}
		affected, _ := result.RowsAffected()
		fmt.Printf("已修复 %d 个用户的 tokenVersion（从 0 更新为 1）\n", affected)
	}

	// 验证
	rows, err := db.Query("SELECT id, username, tokenVersion FROM user LIMIT 5")
	if err != nil {
		log.Fatal("Failed to verify:", err)
	}
	defer rows.Close()

	fmt.Println("\n=== 验证结果 (前5个用户) ===")
	for rows.Next() {
		var id, username string
		var tokenVersion int
		rows.Scan(&id, &username, &tokenVersion)
		fmt.Printf("  %s (用户名: %s, tokenVersion: %d)\n", id[:8]+"...", username, tokenVersion)
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
