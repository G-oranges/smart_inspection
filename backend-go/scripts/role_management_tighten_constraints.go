//go:build ignore

package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	_ = godotenv.Load("../backend/.env")

	rawDSN := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if rawDSN == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	db, err := sql.Open("mysql", convertDSN(rawDSN))
	if err != nil {
		log.Fatalf("open database failed: %v", err)
	}
	defer db.Close()

	var schemaName string
	if err := db.QueryRow("SELECT DATABASE()").Scan(&schemaName); err != nil {
		log.Fatalf("query schema failed: %v", err)
	}

	for _, tableName := range []string{"user", "permission", "roletype", "roleentity", "roledatascope", "rolepermission", "_roleentitytouser"} {
		mustExec(db, fmt.Sprintf("ALTER TABLE `%s` ENGINE=InnoDB", tableName))
	}

	mustExec(db, "ALTER TABLE `roletype` MODIFY COLUMN `code` varchar(191) NOT NULL")
	mustExec(db, "ALTER TABLE `roletype` MODIFY COLUMN `name` varchar(255) NOT NULL")
	mustExec(db, "ALTER TABLE `roletype` MODIFY COLUMN `status` varchar(16) NOT NULL DEFAULT 'ACTIVE'")
	mustExec(db, "ALTER TABLE `roletype` MODIFY COLUMN `isSystem` tinyint(1) NOT NULL DEFAULT 0")
	mustExec(db, "ALTER TABLE `roletype` MODIFY COLUMN `sort` bigint NOT NULL DEFAULT 100")

	mustExec(db, "ALTER TABLE `roleentity` MODIFY COLUMN `code` varchar(191) NOT NULL")
	mustExec(db, "ALTER TABLE `roleentity` MODIFY COLUMN `name` varchar(255) NOT NULL")
	mustExec(db, "ALTER TABLE `roleentity` MODIFY COLUMN `typeCode` varchar(32) NOT NULL DEFAULT 'SYSTEM'")
	mustExec(db, "ALTER TABLE `roleentity` MODIFY COLUMN `status` varchar(16) NOT NULL DEFAULT 'ACTIVE'")
	mustExec(db, "ALTER TABLE `roleentity` MODIFY COLUMN `isSystem` tinyint(1) NOT NULL DEFAULT 0")
	mustExec(db, "ALTER TABLE `roleentity` MODIFY COLUMN `sort` bigint NOT NULL DEFAULT 100")

	mustExec(db, "ALTER TABLE `roledatascope` MODIFY COLUMN `roleId` char(36) NOT NULL")
	mustExec(db, "ALTER TABLE `roledatascope` MODIFY COLUMN `scopeMode` varchar(32) NOT NULL DEFAULT 'ALL'")
	mustExec(db, "ALTER TABLE `roledatascope` MODIFY COLUMN `presetCode` varchar(32) NOT NULL DEFAULT 'ALL'")

	mustExec(db, "ALTER TABLE `rolepermission` MODIFY COLUMN `roleId` char(36) NOT NULL")
	mustExec(db, "ALTER TABLE `rolepermission` MODIFY COLUMN `permissionId` char(36) NOT NULL")

	ensureUniqueIndex(db, schemaName, "roletype", "uk_roletype_code", "code")
	ensureUniqueIndex(db, schemaName, "roleentity", "uk_roleentity_code", "code")
	ensureUniqueIndex(db, schemaName, "roledatascope", "uk_roledatascope_roleid", "roleId")
	ensureUniqueIndex(db, schemaName, "rolepermission", "idx_role_permission", "roleId", "permissionId")
	ensureUniqueIndex(db, schemaName, "_roleentitytouser", "pk_roleentitytouser", "A", "B")

	ensureForeignKey(db, schemaName, "roleentity", "fk_roleentity_typecode", "typeCode", "roletype", "code", "CASCADE", "RESTRICT")
	ensureForeignKey(db, schemaName, "roledatascope", "fk_roledatascope_roleid", "roleId", "roleentity", "id", "CASCADE", "CASCADE")
	ensureForeignKey(db, schemaName, "rolepermission", "fk_rolepermission_roleid", "roleId", "roleentity", "id", "CASCADE", "CASCADE")
	ensureForeignKey(db, schemaName, "rolepermission", "fk_rolepermission_permissionid", "permissionId", "permission", "id", "CASCADE", "CASCADE")
	ensureForeignKey(db, schemaName, "_roleentitytouser", "fk_roleentitytouser_role", "A", "roleentity", "id", "CASCADE", "CASCADE")
	ensureForeignKey(db, schemaName, "_roleentitytouser", "fk_roleentitytouser_user", "B", "user", "id", "CASCADE", "CASCADE")

	log.Println("role management constraints tightened successfully")
}

func mustExec(db *sql.DB, query string, args ...interface{}) {
	if _, err := db.Exec(query, args...); err != nil {
		log.Fatalf("exec failed: %s: %v", query, err)
	}
}

func ensureUniqueIndex(db *sql.DB, schemaName, tableName, indexName string, columns ...string) {
	var count int
	err := db.QueryRow(`
		SELECT COUNT(1)
		FROM information_schema.statistics
		WHERE table_schema = ? AND table_name = ? AND index_name = ?
	`, schemaName, tableName, indexName).Scan(&count)
	if err != nil {
		log.Fatalf("check index %s failed: %v", indexName, err)
	}
	if count > 0 {
		return
	}
	query := fmt.Sprintf("ALTER TABLE `%s` ADD UNIQUE INDEX `%s` (%s)", tableName, indexName, quotedColumns(columns...))
	mustExec(db, query)
}

func ensureForeignKey(db *sql.DB, schemaName, tableName, constraintName, columnName, refTable, refColumn, onUpdate, onDelete string) {
	var count int
	err := db.QueryRow(`
		SELECT COUNT(1)
		FROM information_schema.referential_constraints
		WHERE constraint_schema = ? AND table_name = ? AND constraint_name = ?
	`, schemaName, tableName, constraintName).Scan(&count)
	if err != nil {
		log.Fatalf("check foreign key %s failed: %v", constraintName, err)
	}
	if count > 0 {
		return
	}
	query := fmt.Sprintf(
		"ALTER TABLE `%s` ADD CONSTRAINT `%s` FOREIGN KEY (`%s`) REFERENCES `%s`(`%s`) ON UPDATE %s ON DELETE %s",
		tableName, constraintName, columnName, refTable, refColumn, onUpdate, onDelete,
	)
	mustExec(db, query)
}

func quotedColumns(columns ...string) string {
	parts := make([]string, 0, len(columns))
	for _, column := range columns {
		parts = append(parts, fmt.Sprintf("`%s`", column))
	}
	return strings.Join(parts, ", ")
}

func convertDSN(prismaDSN string) string {
	const prefix = "mysql://"
	if !strings.HasPrefix(prismaDSN, prefix) {
		return prismaDSN
	}
	trimmed := strings.TrimPrefix(prismaDSN, prefix)
	parts := strings.SplitN(trimmed, "@", 2)
	if len(parts) != 2 {
		return prismaDSN
	}
	credentials := parts[0]
	addressDB := parts[1]
	addrParts := strings.SplitN(addressDB, "/", 2)
	if len(addrParts) != 2 {
		return prismaDSN
	}
	hostPort := addrParts[0]
	dbName := addrParts[1]
	if idx := strings.Index(dbName, "?"); idx != -1 {
		dbName = dbName[:idx]
	}
	return fmt.Sprintf("%s@tcp(%s)/%s?charset=utf8mb4&parseTime=True&loc=Local", credentials, hostPort, dbName)
}
