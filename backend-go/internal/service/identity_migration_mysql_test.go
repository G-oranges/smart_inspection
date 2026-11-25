package service

import (
	"errors"
	"os"
	"testing"

	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

func TestIdentityMigrationMySQL(t *testing.T) {
	dsn := os.Getenv("IDENTITY_TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("set IDENTITY_TEST_MYSQL_DSN to an empty MySQL test database")
	}
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: true,
		IgnoreRelationshipsWhenMigrating:         true,
		NamingStrategy:                           schema.NamingStrategy{NoLowerCase: true, SingularTable: true},
		Logger:                                   logger.Default.LogMode(logger.Silent),
	})
	checkIdentityTest(t, err)
	conn, err := db.DB()
	checkIdentityTest(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	tables, err := db.Migrator().GetTables()
	checkIdentityTest(t, err)
	if len(tables) > 0 {
		t.Fatal("identity migration test requires an empty database")
	}
	t.Cleanup(func() {
		checkIdentityTest(t, db.Exec("DROP TABLE IF EXISTS identity_history, student, teacher, _roleentitytouser, appmigration, user").Error)
	})

	for _, sql := range []string{
		"CREATE TABLE user (id CHAR(36) PRIMARY KEY, username VARCHAR(80) UNIQUE, role VARCHAR(64), userType VARCHAR(32), fullName VARCHAR(80), department VARCHAR(80), phone VARCHAR(30)) ENGINE=InnoDB",
		"CREATE TABLE student (id CHAR(36) PRIMARY KEY, studentNo VARCHAR(80) UNIQUE, userId CHAR(36), fullName VARCHAR(80), college VARCHAR(80), mobile VARCHAR(30), phone VARCHAR(30), FOREIGN KEY (userId) REFERENCES user(id)) ENGINE=InnoDB",
		"CREATE TABLE teacher (id CHAR(36) PRIMARY KEY, employeeNo VARCHAR(80) UNIQUE, fullName VARCHAR(80), department VARCHAR(80), mobile VARCHAR(30), updatedAt DATETIME(3)) ENGINE=InnoDB",
		"CREATE TABLE _roleentitytouser (A CHAR(36), B CHAR(36), PRIMARY KEY (A, B)) ENGINE=InnoDB",
		"INSERT INTO user (id, username, role, userType, fullName, department, phone) VALUES ('u1', 's1', 'LEADER', 'STUDENT', 'Account', 'Old', '100'), ('u2', 't1', 'ADMIN', 'ADMIN', 'Old teacher', 'Science', '321')",
		"INSERT INTO student (id, studentNo, fullName, college, mobile, phone) VALUES ('s1', 's1', 'Student', 'Arts', '200', '300')",
		"INSERT INTO student (id, studentNo, userId, fullName) VALUES ('duplicate', 's2', 'u1', 'Duplicate')",
		"INSERT INTO teacher (id, employeeNo, fullName) VALUES ('t1', 't1', 'Teacher'), ('t2', 't2', 'Unbound')",
	} {
		checkIdentityTest(t, db.Exec(sql).Error)
	}

	if err := EnsureIdentityBindings(db); !errors.Is(err, ErrIdentityConflict) {
		t.Fatalf("expected migration to stop on conflicting binding, got %v", err)
	}
	checkIdentityTest(t, db.Exec("DELETE FROM student WHERE id = 'duplicate'").Error)
	checkIdentityTest(t, EnsureIdentityBindings(db))

	var student model.Student
	checkIdentityTest(t, db.Take(&student, "id = ?", "s1").Error)
	if ptrToStr(student.UserID) != "u1" || ptrToStr(student.Mobile) != "200" || ptrToStr(student.Phone) != "200" {
		t.Fatalf("student backfill failed: %+v", student)
	}
	var teacher model.Teacher
	checkIdentityTest(t, db.Take(&teacher, "id = ?", "t1").Error)
	if ptrToStr(teacher.UserID) != "u2" || ptrToStr(teacher.Department) != "Science" || ptrToStr(teacher.Mobile) != "321" {
		t.Fatalf("teacher backfill failed: %+v", teacher)
	}
	if err := db.Exec("INSERT INTO student (id, studentNo, userId) VALUES ('duplicate', 's2', 'u1')").Error; err == nil {
		t.Fatal("student allows duplicate userId")
	}
	if err := db.Exec("UPDATE teacher SET userId = 'u2' WHERE id = 't2'").Error; err == nil {
		t.Fatal("teacher allows duplicate userId")
	}
	checkIdentityTest(t, db.Exec("INSERT INTO teacher (id, employeeNo) VALUES ('t3', 't3')").Error)
	checkIdentityTest(t, db.Exec("UPDATE user SET fullName = 'Changed after migration' WHERE id = 'u1'").Error)
	checkIdentityTest(t, EnsureIdentityBindings(db))
	var account model.User
	checkIdentityTest(t, db.Take(&account, "id = ?", "u1").Error)
	if account.FullName != "Changed after migration" || ptrToStr(account.Department) != "Arts" || account.Role != "LEADER" {
		t.Fatalf("bad user backfill or migration reapplied: %+v", account)
	}

	checkIdentityTest(t, db.Exec("CREATE TABLE identity_history (userId CHAR(36), FOREIGN KEY (userId) REFERENCES user(id)) ENGINE=InnoDB").Error)
	checkIdentityTest(t, db.Exec("INSERT INTO identity_history (userId) VALUES ('u1')").Error)
	repo := repository.NewUserRepository(db)
	if err := repo.Delete([]string{"u1", "u2"}); err == nil {
		t.Fatal("foreign key should prevent account deletion")
	}
	checkIdentityTest(t, db.Take(&student, "id = ?", "s1").Error)
	checkIdentityTest(t, db.Take(&teacher, "id = ?", "t1").Error)
	if ptrToStr(student.UserID) != "u1" || ptrToStr(teacher.UserID) != "u2" {
		t.Fatal("failed account deletion did not roll back both unbinds")
	}
	checkIdentityTest(t, db.Exec("DELETE FROM identity_history").Error)
	checkIdentityTest(t, repo.Delete([]string{"u1", "u2"}))
	checkIdentityTest(t, db.Take(&student, "id = ?", "s1").Error)
	checkIdentityTest(t, db.Take(&teacher, "id = ?", "t1").Error)
	if student.UserID != nil || teacher.UserID != nil {
		t.Fatal("deleted user still bound to profile")
	}
}
