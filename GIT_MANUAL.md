# Git 全流程傻瓜式操作手册

欢迎来到 Git 的世界！这份手册专为初学者设计，涵盖了从“安装配置”到“日常开发”的全链条操作。请把它当作你的手边参考书。

---

## 第一阶段：准备工作 (只做一次)

### 1. 安装 Git

如果你还没安装，请去官网下载：[https://git-scm.com/](https://git-scm.com/)，一路点击 "Next" 安装即可。

### 2. 自报家门 (全局配置)

Git 需要知道是谁在提交代码。在命令行（CMD 或 PowerShell）中运行以下两行命令（替换为你自己的名字和邮箱）：

```bash
git config --global user.name "你的名字"
# 例如: git config --global user.name "ZhangSan"

git config --global user.email "你的邮箱@example.com"
# 例如: git config --global user.email "zhangsan@gmail.com"
```

---

## 第二阶段：开始一个项目

### 场景 A：从零开始 (新项目)

如果你在本地有一个文件夹想要开始管理：

1.  **进入文件夹**：在命令行中 `cd` 进入你的项目目录。
2.  **初始化**：
    ```bash
    git init
    ```
    _这会在目录下生成一个隐藏的 `.git` 文件夹，Git 正式接管该目录。_
3.  **连接远程仓库** (如果你在 GitHub 上建好了空仓库)：
    ```bash
    git remote add origin <你的远程仓库URL>
    # 例如: git remote add origin https://github.com/xxx/my-project.git
    ```

### 场景 B：接手已有的项目 (克隆)

如果你要下载别人已经写好的代码：

1.  **复制远程地址**：在 GitHub 上找到 "Clone or download" 按钮，复制 URL。
2.  **克隆到本地**：
    ```bash
    git clone <远程URL>
    ```
    _这会自动下载代码并配置好远程连接，无需再做 `git init`。_

---

## 第三阶段：日常开发三部曲 (最常用)

这是你每天哪怕写一行代码都要经历的循环：**修改 -> 暂存 -> 提交 -> 推送**。

### 1. 检查状态 (随时可用)

不知道自己改了什么？运行：

```bash
git status
```

- **红色**：文件被修改了，但还没准备好提交。
- **绿色**：文件已经准备好（暂存），等待提交。

### 2. 暂存更改 (Summon to Stage)

把你想要保存的文件放入“暂存区”（购物篮）：

```bash
# 添加指定文件
git add 文件名.txt

# 添加所有修改过的文件 (最常用)
git add .
```

### 3. 提交暂存 (Commit)

把“购物篮”里的东西真正结账打包，生成一个版本节点：

```bash
git commit -m "这里写清楚你改了什么"
# 例如: git commit -m "修复了登录页面的bug"
```

### 4. 推送到远程 (Push)

把本地的提交上传到 GitHub (云端备份)：

```bash
git push origin main
# 如果第一次报错，可能需要加 -u (set-upstream)
# git push -u origin main
```

---

## 第四阶段：团队协作与分支 (进阶)

为了不影响主代码 (main)，通常我们会在新分支上开发新功能。

### 1. 创建并切换分支

```bash
# 创建并切换到新分支 "feature-login"
git checkout -b feature-login
```

### 2. 在分支上开发

在分支上重复“日常三部曲”：`git add .` -> `git commit -m "..."` -> `git push origin feature-login`。

### 3. 合并分支 (Merge)

功能开发完了，要合入主分支：

1.  **切回主分支**：
    ```bash
    git checkout main
    ```
2.  **拉取最新代码** (防止别人改了主分支)：
    ```bash
    git pull origin main
    ```
3.  **合并分支**：
    ```bash
    git merge feature-login
    ```
4.  **推送到远程**：
    ```bash
    git push origin main
    ```

---

## 第五阶段：常见问题与急救

### 1. 怎么拉取别人的更新？

每天开工第一件事，或者推送前提示“落后”时：

```bash
git pull origin main
```

### 2. 后悔了，想丢弃本地修改 (还没 git add)

```bash
git checkout -- 文件名
# 或者丢弃所有修改
git checkout .
```

### 3. 提交错了，想撤销最近一次 commit (但保留代码)

```bash
git reset --soft HEAD^
```

### 4. 这里的命令太多，记不住怎么办？

其实 90% 的时间你只需要记住这四个命令：

1.  `git pull` (拉取)
2.  `git add .` (添加)
3.  `git commit -m "xxx"` (提交)
4.  `git push` (推送)

---

## Git 常用命令速查表

| 命令                     | 作用           | 通俗解释                   |
| :----------------------- | :------------- | :------------------------- |
| `git init`               | 初始化仓库     | "Git，这里归你管了"        |
| `git clone <url>`        | 克隆仓库       | "帮我把那边的代码搬过来"   |
| `git status`             | 查看状态       | "我现在改了啥？"           |
| `git add .`              | 添加所有文件   | "这些都放进购物车"         |
| `git commit -m "msg"`    | 提交           | "结账，开发票，备注一下"   |
| `git push`               | 推送           | "发快递到云端"             |
| `git pull`               | 拉取           | "看看云端有啥新东西没"     |
| `git branch`             | 查看分支       | "我有几个分身？"           |
| `git branch -a`          | 查看所有分支   | "看看云端和本地都有啥分身" |
| `git checkout -b <name>` | 创建并切换分支 | "影分身之术！"             |
| `git checkout <name>`    | 切换分支       | "变身！"                   |
| `git merge <name>`       | 合并分支       | "合体！"                   |

祝你 Git 之路顺畅！🚀
