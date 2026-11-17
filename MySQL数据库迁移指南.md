# MySQL 数据库迁移/复制指南（Windows）

在 Windows 系统中迁移或复制 MySQL 数据库表和数据，有以下几种常用方法：

---

## 方法一：使用 `mysqldump` 命令行工具（推荐）

这是最常用、最可靠的方法。

### 1. 导出整个数据库

```powershell
# 打开命令提示符或 PowerShell，进入 MySQL bin 目录
cd "C:\Program Files\MySQL\MySQL Server 8.0\bin"

# 导出整个数据库
mysqldump -u root -p 数据库名 > D:\backup\database_backup.sql
```

### 2. 导出特定表

```powershell
# 只导出指定的表
mysqldump -u root -p 数据库名 表1 表2 表3 > D:\backup\tables_backup.sql
```

### 3. 只导出表结构（不含数据）

```powershell
mysqldump -u root -p --no-data 数据库名 > D:\backup\structure_only.sql
```

### 4. 只导出数据（不含表结构）

```powershell
mysqldump -u root -p --no-create-info 数据库名 > D:\backup\data_only.sql
```

### 5. 导入数据到目标数据库

```powershell
# 先创建目标数据库（如果不存在）
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS 新数据库名;"

# 导入备份文件
mysql -u root -p 新数据库名 < D:\backup\database_backup.sql
```

---

## 方法二：使用 MySQL Workbench（图形界面）

如果你安装了 MySQL Workbench，可以使用图形界面操作：

### 导出步骤

1. 打开 MySQL Workbench，连接到数据库
2. 选择菜单 **Server** → **Data Export**
3. 选择要导出的数据库和表
4. 选择导出路径和格式
5. 点击 **Start Export**

### 导入步骤

1. 选择菜单 **Server** → **Data Import**
2. 选择导入源（SQL 文件）
3. 选择目标数据库
4. 点击 **Start Import**

---

## 方法三：直接复制数据目录（适用于 InnoDB/MyISAM）

> ⚠️ **注意**：此方法风险较高，需要停止 MySQL 服务

### 步骤

1. **停止 MySQL 服务**

   ```powershell
   net stop mysql
   ```

2. **找到数据目录**（通常位于）

   ```
   C:\ProgramData\MySQL\MySQL Server 8.0\Data\
   ```

3. **复制整个数据库文件夹**到目标位置

4. **启动 MySQL 服务**

   ```powershell
   net start mysql
   ```

---

## 方法四：使用 SQL 语句复制表

### 在同一数据库中复制表

```sql
-- 复制表结构和数据
CREATE TABLE 新表名 AS SELECT * FROM 原表名;

-- 只复制表结构
CREATE TABLE 新表名 LIKE 原表名;

-- 复制数据到已存在的表
INSERT INTO 新表名 SELECT * FROM 原表名;
```

### 跨数据库复制表

```sql
-- 复制表结构和数据到另一个数据库
CREATE TABLE 目标数据库.新表名 AS SELECT * FROM 源数据库.原表名;
```

---

## 常用 mysqldump 选项参考

| 选项                     | 说明                         |
| ------------------------ | ---------------------------- |
| `--single-transaction`   | 适用于 InnoDB，保证一致性    |
| `--routines`             | 包含存储过程和函数           |
| `--triggers`             | 包含触发器                   |
| `--events`               | 包含事件                     |
| `--all-databases`        | 导出所有数据库               |
| `--add-drop-table`       | 在创建表前添加 DROP TABLE    |

### 完整备份示例

```powershell
mysqldump -u root -p --single-transaction --routines --triggers 数据库名 > D:\backup\full_backup.sql
```

---

## 远程服务器迁移

### 从本地导出并导入到远程服务器

```powershell
# 导出本地数据库
mysqldump -u root -p 数据库名 > D:\backup\database_backup.sql

# 导入到远程服务器（需要远程服务器的连接信息）
mysql -h 远程服务器IP -u 用户名 -p 数据库名 < D:\backup\database_backup.sql
```

### 直接管道传输（一步完成）

```powershell
mysqldump -u root -p 源数据库 | mysql -h 远程IP -u 用户名 -p 目标数据库
```

---

## 常见问题

### Q1: 导出时提示 "Access denied"

- 检查用户权限，确保有 `SELECT` 和 `LOCK TABLES` 权限
- 使用管理员账户（如 root）

### Q2: 导入时提示 "Unknown database"

- 先创建目标数据库：`CREATE DATABASE 数据库名;`

### Q3: 中文乱码问题

```powershell
# 导出时指定字符集
mysqldump -u root -p --default-character-set=utf8mb4 数据库名 > backup.sql

# 导入时指定字符集
mysql -u root -p --default-character-set=utf8mb4 数据库名 < backup.sql
```

### Q4: 文件太大导出失败

```powershell
# 分表导出
mysqldump -u root -p 数据库名 表1 > table1.sql
mysqldump -u root -p 数据库名 表2 > table2.sql
```

---

## 快速参考命令

```powershell
# 进入 MySQL bin 目录
cd "C:\Program Files\MySQL\MySQL Server 8.0\bin"

# 完整数据库备份
mysqldump -u root -p --single-transaction --routines --triggers 数据库名 > backup.sql

# 导入备份
mysql -u root -p 数据库名 < backup.sql

# 查看所有数据库
mysql -u root -p -e "SHOW DATABASES;"

# 查看数据库中的所有表
mysql -u root -p -e "USE 数据库名; SHOW TABLES;"
```

---

*文档创建日期：2026-01-27*
