-- Token 版本控制迁移脚本
-- 用于支持禁用/改密后立即使旧 Token 失效

-- 添加 tokenVersion 字段到 user 表
ALTER TABLE `user` ADD COLUMN `tokenVersion` INT NOT NULL DEFAULT 1;

-- 添加注释
ALTER TABLE `user` MODIFY COLUMN `tokenVersion` INT NOT NULL DEFAULT 1 COMMENT 'Token版本号，禁用/改密时递增使旧Token失效';
