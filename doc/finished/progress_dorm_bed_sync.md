# 宿舍床位同步功能实施进展

## 实施日期

2026-01-21

## 问题背景

用户反馈：宿舍可住人数编辑后（如从 0 改为 5），入住管理界面仍显示"暂无床位信息"。

## 根因分析

**数据模型设计与业务逻辑解耦：**

- 宿舍表 `dormitory` 的 `capacity` 字段只是一个数值
- 床位表 `dormbed` 存储的是独立的床位实体记录
- 原有的 `UpdateDorm` 方法仅更新 `dormitory.capacity` 数字，**未触发 `dormbed` 表的增删操作**

## 解决方案

在 `infra_repository.go` 的 `UpdateDorm` 方法中实现床位同步逻辑：

### 核心逻辑

```
当 Capacity 从 oldCapacity 变更为 newCapacity 时：
1. 若 newCapacity > oldCapacity（扩容）：
   - 自动在 dormbed 表插入 (newCapacity - oldCapacity) 条新床位记录
   - 床位号从 oldCapacity+1 开始递增

2. 若 newCapacity < oldCapacity（缩容）：
   - 检查 bedNo > newCapacity 的床位是否有学生入住
   - 若有人入住：报错阻止操作
   - 若全部为空：删除这些多余床位记录

3. 若 newCapacity == oldCapacity：
   - 仅更新宿舍属性，不触动床位表
```

### 修改文件

| 文件                                                 | 变更说明                                         |
| ---------------------------------------------------- | ------------------------------------------------ |
| `backend-go/internal/repository/infra_repository.go` | 重构 `UpdateDorm` 方法，新增 `syncDormBeds` 函数 |

### 关键代码

```go
// syncDormBeds 同步宿舍床位：根据容量变化增删床位记录
func (r *infraRepository) syncDormBeds(tx *gorm.DB, dormID string, oldCapacity, newCapacity int) error {
    if newCapacity > oldCapacity {
        // 【增量】生成新床位
        for i := oldCapacity + 1; i <= newCapacity; i++ {
            bed := model.DormBed{
                ID:     uuid.New().String(),
                DormID: dormID,
                BedNo:  strconv.Itoa(i),
                Status: "available",
            }
            if err := tx.Create(&bed).Error; err != nil {
                return err
            }
        }
    } else if newCapacity < oldCapacity {
        // 【减量】检查要删除的床位是否有人入住
        var occupiedCount int64
        tx.Model(&model.DormBed{}).
            Where("dormId = ? AND CAST(bedNo AS SIGNED) > ?", dormID, newCapacity).
            Where("studentId IS NOT NULL AND studentId != ''").
            Count(&occupiedCount)

        if occupiedCount > 0 {
            return fmt.Errorf("无法缩小宿舍规模：有 %d 个待删除的床位当前已有学生入住", occupiedCount)
        }

        // 删除多余的空床位
        tx.Where("dormId = ? AND CAST(bedNo AS SIGNED) > ?", dormID, newCapacity).
           Delete(&model.DormBed{})
    }
    return nil
}
```

## 预期效果

1. **扩容场景**：将宿舍从 0 人改为 5 人 → 自动创建 1-5 号床位
2. **缩容场景（全空）**：将 4 人宿舍改为 2 人（3、4 号床无人）→ 删除 3、4 号床位
3. **缩容场景（有人）**：将 4 人宿舍改为 2 人（4 号床有人）→ 报错阻止

## 测试验证

- [x] 后端编译通过
- [x] 后端服务启动正常
- [ ] 前端界面功能验证

## 后续工作

- 考虑在宿舍导入时也应用同样的床位同步逻辑（目前 `BatchImportDormsV2` 未处理）
