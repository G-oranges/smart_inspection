导入向导预处理与部分导入进展（宿舍试点）

1. 背景与范围
   1.1 背景
   Excel 单元格类型（数值/文本）与 Go DTO 类型不一致，容易导致导入失败或数据污染。
   通过前端预处理统一类型、提前识别阻断错误，实现“部分导入 + 错误行导出”。
   1.2 试点范围
   试点范围：宿舍导入向导（Step1~Step6）。
   配置来源：DORM_IMPORT_CONFIG；唯一键口径为 campus + building + roomNo。
   后端接口：/api/v2/infra/dorms/import/preview、/api/v2/infra/dorms/import/execute。
   1.3 约束
   不新增步骤。
   不新增策略（仅 SKIP / OVERWRITE）。
   不提供在线编辑修复。
   不做异步任务/撤销。
2. 导入向导总体流程（Step1~Step6）
   2.1 关键状态与含义
   状态 含义 产生/更新阶段
   workbook 解析后的 Excel 工作簿 Step2
   sheetNames / selectedSheet Sheet 列表 / 当前选择 Step2
   headers 表头（第一行） Step2 → Step3
   mapping 表头到字段 key 的映射 Step3
   processedRows 预处理后的数据行（含 rowNo） Step4
   preprocessStats 预处理统计 Step4
   previewResult.issues 预处理 + 后端预检合并后的 issues Step4
   importableRows 导入队列（剔除 A/B 行） Step4
   strategy 冲突处理策略（SKIP/OVERWRITE） Step5
   executeResult 执行结果与 failedRows Step6
   lastExecutedRows 执行时数据镜像（用于失败行导出） Step6
   2.2 Step1~Step6 流程与阻断点
   Step 目标 输入 输出 阻断条件
   Step1 下载模板 提供规范表头与示例 配置字段 本地模板文件 无
   Step2 上传文件 解析 Excel 与 Sheet Excel 文件 workbook、sheetNames 非 Excel 格式、解析失败、未选 Sheet、无表头、无有效数据行
   Step3 字段映射 确认 Excel 列与字段口径 headers + 配置字段 mapping 必填字段未映射
   Step4 数据预检 预处理 + 后端 preview mapping + Sheet 数据 processedRows、previewResult、importableRows importableRowCount = 0
   Step5 确认策略 选择冲突处理 conflictRowCount + strategy strategy 无
   Step6 执行导入 写入并复盘 strategy + importableRows executeResult + 下载资产 rowsToExecute = 0（兜底阻断）
3. 数据预处理（Preprocess）能力说明（核心章节）
   3.1 发生时机
   发生时机：完成字段映射后（mappedRows）进入 Step4，后端 preview 之前。
   rowNo 口径：数据行从 Excel 第 2 行开始，rowNo = 数据行序号 + 1（实现中为 index + 2）。
   空值处理：保持为空，必填校验交由后端 preview 处理。
   3.2 类型归一化规则
   字段类型/场景 归一化规则 错误码/说明
   string（通用） string：trim；number/其他：String(value) 无（仅记录 coerced）
   string（编码字段：roomNo、grade） number：若包含小数或转为科学计数法则阻断；否则 number → string A: INVALID_SCI_NOTATION；提示：数值型编码可能已丢失前导 0，系统不回补
   number/int string：trim + 去千分位逗号后 Number；空字符串 → null；number 直接使用 A: TYPE_COERCION_FAILED / INVALID_INTEGER_VALUE / VALUE_OUT_OF_RANGE
   enum（string 字段配置 enum） 先按 string 规则转换，再校验是否在枚举列表中 B: INVALID_ENUM_VALUE
   补充说明：min/max 来自 config.fields，int 类型要求为整数。

3.3 预处理输出
输出 说明
processedRows 预处理后的行数据，保留 rowNo（Excel 行号口径）
preprocessIssues 预处理问题列表（rowNo、errorType、errorCode、reason、suggestion、affectedFields）
stats 预处理统计：totalRows、coercedCells、numberToString、stringToNumber
3.4 预处理错误码
错误码 错误类型 触发条件 阻断
TYPE_COERCION_FAILED A 无法转换为数字 阻断
INVALID_INTEGER_VALUE A int 字段出现小数 阻断
VALUE_OUT_OF_RANGE A 超出 min/max 阻断
INVALID_SCI_NOTATION A 编码字段小数或科学计数法 阻断
补充说明：枚举不合法会产生 B 类 INVALID_ENUM_VALUE，并参与 Step4 阻断口径。

4. Step4 数据逻辑预检 + 部分导入策略（核心章节）
   4.1 预检流程与 issues 合并
   mappedRows → preprocessRows：得到 processedRows、preprocessIssues、preprocessStats。
   candidateRows：剔除预处理阶段阻断行（当前实现仅 A 类可提前剔除）；若为 0，则不调用后端 preview。
   后端 /preview：仅对 candidateRows 进行逻辑校验与冲突检查。
   allIssues = preprocessIssues + backendPreviewIssues（不去重）。
   统计口径基于 allIssues 重新计算（A/B/C 以 rowNo 去重）。
   importableRows：最终导入队列 = processedRows 中剔除 A/B 行。
   说明：预处理阶段的 B 类（目前仅枚举不合法）不会在进入 preview 前剔除，但在最终统计与阻断口径中与 A 类等价处理。

4.2 行分类口径（按 rowNo 去重）
行分类 判定口径 行为
需修复（A/B） 该 rowNo 存在任一 A/B issue 不可导入
可导入 该 rowNo 无 A/B issue（允许 C） 进入导入队列
有冲突 仅 C issue 且无 A/B 可导入子集，进入 Step5
4.3 previewRows 规则
candidateRows：先按阻断口径剔除 A/B 行得到；当前实现中预处理阶段仅 A 类会在此处剔除（B 类多来自后端预检）。
previewRows = candidateRows（rows 参数仅包含候选行）。
4.4 统计口径
指标 计算方式
扫描总数 totalRows processedRows.length
可导入 importableRowCount totalRows - errorRowCount
需修复 errorRowCount rowNo 去重（issues 中 A/B）
有冲突 conflictRowCount rowNo 去重（仅 C 且不在 A/B）
issueCount issues.length（不去重）
passCount importableRowCount - conflictRowCount
4.5 UI/按钮规则
条件 UI/按钮状态
importableRowCount > 0 “继续导入 X 行”可点击
errorRowCount > 0 显示“下载错误行”按钮
importableRowCount = 0 “继续导入”禁用，但仍可下载错误行
补充：Step4 支持 issues 筛选（全部 / 仅 A+B / 仅 C）。

5. Step5 冲突策略
   策略 含义 适用范围
   SKIP 唯一键冲突时跳过 仅 C 类冲突行
   OVERWRITE 唯一键冲突时覆盖更新 仅 C 类冲突行
   唯一键（宿舍试点）：campus + building + roomNo。A/B 行不进入策略处理。

6. Step6 执行导入 + 结果复盘 + 资产下载
   6.1 执行导入
   execute rows 必须与 preview 通过的导入队列一致（仅 importableRows）。
   请求体：{ strategy, rows }。
   6.2 结果统计口径
   指标 口径
   处理总数 totalCount 导入队列行数（非扫描总数）
   successCount createdCount + updatedCount
   createdCount / updatedCount 新增 / 覆盖数量
   skippedCount SKIP 策略下因唯一键冲突跳过
   failedCount 数据写入失败
   6.3 结果页文案
   需说明“扫描 N 行，其中 M 行错误已跳过，本次处理 N-M 行”。
   6.4 下载资产
   资产 生成时机 Sheet 名称 文件名规范 列结构 生成逻辑
   错误行导出（A/B） Step4 错误明细 {title}_错误行导出_{timestamp}.xlsx 模板原始列 + 行号 + 错误类型 + 错误代码 + 错误原因 + 修复建议 仅 A/B issues，每条 issue 一行；多错可重复多行
   失败行明细 Step6 失败明细 {title}_失败行导出_{timestamp}.xlsx 模板原始列 + 行号 + 异常类型 + 错误代码 + 错误原因 + 处理建议 failedRows 与 lastExecutedRows(rowNo) 匹配生成；缺失 errorType 时导出为 E
   异常分析报告 Step6 异常分析报告 {title}_异常分析报告_{timestamp}.xlsx 错误代码 + 发生次数 + 异常描述 + 修复方案 + 涉及字段 按 failedRows.errorCode 聚合
7. 验收清单（必须可复制执行）
   7.1 前置条件
   系统中已存在楼栋：主校区/1 号楼、主校区/2 号楼、西校区/2 号楼。
   仅“仅 C 冲突”用例需预置宿舍：
   主校区/1 号楼/301、主校区/1 号楼/302、西校区/2 号楼/201。
   Excel 表头按模板字段顺序，rowNo 以 Excel 行号（数据从第 2 行）计算。
   7.2 用例：部分通过（2 通过 + 4 错误）
   输入数据（示例）

rowNo 校区 楼宇 楼层 房间号 床位数 性别 年级 备注
2 主校区 1 号楼 3 301 4 男 2024 正常
3 主校区 1 号楼 2 302 4 女 2024 正常
4 （空） 1 号楼 2 303 4 男 2024 必填缺失
5 主校区 1 号楼 2 304 abc 男 2024 床位数类型错误
6 主校区 1 号楼 2 305 4 未知 2024 枚举错误
7 主校区 不存在楼栋 2 306 4 男 2024 楼栋不存在
操作步骤

按模板上传 Excel 并完成字段映射。
进入 Step4 查看统计；可导入 > 0 时点击“继续导入”。
Step5 选择 SKIP（默认），执行导入。
预期

Step4 卡片：扫描总数=6，可导入=2，需修复=4，有冲突=0。
Step5：可进入。
Step6：处理总数=2，success=2（created=2、updated=0），skipped=0，failed=0；数据库新增 2 条宿舍（301、302）。
7.3 用例：全部错误
输入数据（示例）

rowNo 校区 楼宇 楼层 房间号 床位数 性别 年级 备注
2 主校区 1 号楼 2 301.5 4 男 2024 编码小数
3 主校区 1 号楼 2 302 0 男 2024 超出最小值
4 主校区 1 号楼 1.5 303 4 女 2024 楼层小数
5 主校区 不存在楼栋 2 304 4 男 2024 楼栋不存在
6 主校区 1 号楼 2 305 4 未知 2024 枚举错误
7 （空） 1 号楼 2 306 4 男 2024 必填缺失
操作步骤

按模板上传 Excel 并完成字段映射。
进入 Step4 查看统计。
预期

Step4 卡片：扫描总数=6，可导入=0，需修复=6，有冲突=0。
Step5：不可进入（继续导入禁用）。
Step6：不执行；数据库无变化。
7.4 用例：仅 C 冲突
输入数据（示例）

rowNo 校区 楼宇 楼层 房间号 床位数 性别 年级 备注
2 主校区 1 号楼 3 301 4 男 2024 预置冲突
3 主校区 1 号楼 3 302 4 女 2024 预置冲突
4 西校区 2 号楼 2 201 4 男 2024 预置冲突
5 主校区 1 号楼 3 303 4 男 2024 新增
6 主校区 2 号楼 1 101 4 女 2024 新增
7 西校区 2 号楼 2 202 4 男 2024 新增
操作步骤

按模板上传 Excel 并完成字段映射。
进入 Step4 查看统计，点击“继续导入”。
Step5 选择策略（SKIP 或 OVERWRITE），执行导入。
预期

Step4 卡片：扫描总数=6，可导入=6，需修复=0，有冲突=3。
Step5：可进入。
Step6（SKIP）：处理总数=6，success=3（created=3、updated=0），skipped=3，failed=0；数据库新增 3 条、原冲突宿舍不变。
Step6（OVERWRITE）：处理总数=6，success=6（created=3、updated=3），skipped=0，failed=0；数据库新增 3 条、原冲突宿舍被覆盖更新。
7.5 用例：类型纠偏（roomNo/grade 数字）
输入数据（示例，Excel 单元格为数值格式）

rowNo 校区 楼宇 楼层 房间号 床位数 性别 年级 备注
2 主校区 1 号楼 3 301 4 男 2024 roomNo/grade 为数值
3 主校区 1 号楼 3 302 4 女 2025 roomNo/grade 为数值
操作步骤

按模板上传 Excel 并完成字段映射。
进入 Step4 查看统计，点击“继续导入”。
Step5 选择 SKIP（默认）并执行导入。
预期

Step4 卡片：扫描总数=2，可导入=2，需修复=0，有冲突=0。
Step5：可进入（无冲突）。
Step6：处理总数=2，success=2（created=2、updated=0），skipped=0，failed=0；数据库新增 2 条宿舍，roomNo/grade 按字符串保存。
7.6 用例：capacity 文本转数字
输入数据（示例，床位数为文本格式）

rowNo 校区 楼宇 楼层 房间号 床位数 性别 年级 备注
2 主校区 1 号楼 2 401 4 男 2024 文本数字
3 主校区 1 号楼 2 402 20 女 2024 文本数字
操作步骤

按模板上传 Excel 并完成字段映射。
进入 Step4 查看统计，点击“继续导入”。
Step5 选择 SKIP（默认）并执行导入。
预期

Step4 卡片：扫描总数=2，可导入=2，需修复=0，有冲突=0。
Step5：可进入（无冲突）。
Step6：处理总数=2，success=2（created=2、updated=0），skipped=0，failed=0；数据库新增 2 条宿舍，capacity 保存为数值。
7.7 用例：floor 小数/负数
输入数据（示例）

rowNo 校区 楼宇 楼层 房间号 床位数 性别 年级 备注
2 主校区 1 号楼 1.5 501 4 男 2024 楼层小数
3 主校区 1 号楼 -1 502 4 女 2024 楼层负数
操作步骤

按模板上传 Excel 并完成字段映射。
进入 Step4 查看统计。
预期

Step4 卡片：扫描总数=2，可导入=0，需修复=2，有冲突=0。
Step5：不可进入（继续导入禁用）。
Step6：不执行；数据库无变化。
7.8 用例：科学计数法
输入数据（示例，roomNo 为数值格式，输入 1E+21）

rowNo 校区 楼宇 楼层 房间号 床位数 性别 年级 备注
2 主校区 1 号楼 2 1E+21 4 男 2024 科学计数法
操作步骤

按模板上传 Excel 并完成字段映射。
进入 Step4 查看统计。
预期

Step4 卡片：扫描总数=1，可导入=0，需修复=1，有冲突=0。
Step5：不可进入（继续导入禁用）。
Step6：不执行；数据库无变化。 8. 版本记录与下一步
8.1 版本记录
本文档覆盖：宿舍导入试点（预处理 + 部分导入 + 错误行导出 + 冲突策略）。
8.2 下一步（扩展到学生/入住的复用点）
fields.type/min/max/enum 配置化复用预处理与校验规则。
编码字段列表复用（roomNo/grade 现有；可扩展到 studentNo/employeeNo）。
uniqueKeys 配置化复用 C 类冲突判定。
preview/execute 路由配置化复用（config.api.preview/execute）。
统计口径、按钮规则与导出资产复用（错误行/失败行/异常分析报告）。
