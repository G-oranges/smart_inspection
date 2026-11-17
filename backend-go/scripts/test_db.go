//go:build ignore

package main

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func main() {
	godotenv.Load("../backend/.env")
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		fmt.Println("DATABASE_URL not found")
		return
	}
	// Convert prisma dsn to gorm dsn if needed (simplified)
	// Example: mysql://root:123456@localhost:3307/dorm_inspection
	fmt.Println("Testing DSN:", dsn)

	db, err := gorm.Open(mysql.Open("root:123456@tcp(localhost:3307)/dorm_inspection?parseTime=true"), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}

	var count int64
	db.Model(&model.User{}).Count(&count)
	fmt.Printf("Total users in DB: %d\n", count)

	var user model.User
	err = db.Where("username = ?", "root").First(&user).Error
	if err != nil {
		fmt.Printf("User 'root' not found: %v\n", err)
	} else {
		fmt.Printf("User 'root' found: ID=%s, FullName=%s\n", user.ID, user.FullName)
	}
}
