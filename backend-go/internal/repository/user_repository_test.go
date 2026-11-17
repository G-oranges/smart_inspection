package repository

import (
	"testing"

	gormsqlite "github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestFindExecutorsDoesNotRequireAvatarURLColumn(t *testing.T) {
	db, err := gorm.Open(gormsqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	if err := db.Exec(`
		CREATE TABLE user (
			id TEXT PRIMARY KEY,
			username TEXT NOT NULL,
			password TEXT NOT NULL,
			role TEXT NOT NULL,
			fullName TEXT NOT NULL,
			email TEXT,
			phone TEXT,
			department TEXT,
			isDisabled BOOLEAN DEFAULT 0,
			tokenVersion INTEGER DEFAULT 1,
			userType TEXT,
			dormId TEXT,
			createdAt DATETIME
		)
	`).Error; err != nil {
		t.Fatalf("create user table: %v", err)
	}

	if err := db.Exec(`
		CREATE TABLE roleentity (
			id TEXT PRIMARY KEY,
			code TEXT,
			status TEXT
		)
	`).Error; err != nil {
		t.Fatalf("create roleentity table: %v", err)
	}

	if err := db.Table("user").Create(map[string]interface{}{
		"id":           "executor-1",
		"username":     "leader001",
		"password":     "x",
		"role":         "LEADER",
		"fullName":     "执行人",
		"isDisabled":   false,
		"tokenVersion": 1,
	}).Error; err != nil {
		t.Fatalf("seed executor: %v", err)
	}

	repo := NewUserRepository(db)
	users, total, err := repo.FindExecutors(1, 20, "", "")
	if err != nil {
		t.Fatalf("find executors: %v", err)
	}

	if total != 1 {
		t.Fatalf("expected total 1, got %d", total)
	}
	if len(users) != 1 {
		t.Fatalf("expected one executor, got %d", len(users))
	}
	if users[0].Username != "leader001" {
		t.Fatalf("expected username %s, got %s", "leader001", users[0].Username)
	}
}
