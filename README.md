# DeepSeek Exporter

一键保存 DeepSeek 对话记录，导出为 Markdown 文件。

## 功能

- 📋 复制对话到剪贴板
- 📁 导出为 Markdown 文件
- 🧠 支持导出 AI 思考过程（DeepSeek 深度思考）
- 🌐 支持 Chrome、Edge 等浏览器

---

## 安装方法

### 方法一：直接下载（推荐，无需构建）

#### 1. 下载插件

1. 点击 GitHub 页面的绿色 "Code" 按钮
2. 选择 "Download ZIP"
3. 解压文件

或者直接下载 [dist 文件夹](./dist)（如果 GitHub 支持单独下载文件夹）

#### 2. 加载到浏览器

适用于 Chrome、Edge、Brave、Opera、Vivaldi、360、QQ浏览器、搜狗浏览器等基于 Chromium 内核的浏览器。

**Chrome：**
1. 在地址栏输入 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择解压后的 `dist` 文件夹

**Edge：**
1. 在地址栏输入 `edge://extensions/`
2. 开启左下角的「开发人员模式」
3. 点击「加载解压缩的扩展」
4. 选择解压后的 `dist` 文件夹

---

### 方法二：从源码构建

#### 1. 安装 Node.js

如果电脑没有 Node.js：
- 下载地址：https://nodejs.org/
- 选择 LTS 版本下载安装
- 安装完成后重启命令行

验证安装：
```bash
node -v
npm -v
```

#### 2. 下载并构建

```bash
# 克隆仓库
git clone https://github.com/sati0121/DeepSeek-Conversation-Copy-and-Export-Plugin.git
cd DeepSeek-Conversation-Copy-and-Export-Plugin

# 安装依赖
npm install

# 构建
npm run build
```

构建完成后，加载 `dist` 文件夹到浏览器即可。

---

## 使用方法

### 1. 打开 DeepSeek

访问 https://chat.deepseek.com/

### 2. 找到按钮

在输入框附近会出现两个按钮：
- 📋 **复制按钮** - 复制对话到剪贴板
- ⬇️ **导出按钮** - 导出为文件

### 3. 导出对话

**复制到剪贴板：**
1. 点击复制按钮
2. 等待提示"已复制到剪贴板"
3. 粘贴到任意位置

**导出文件：**
1. 点击导出按钮
2. 选择导出方式：
   - **直接导出** - 仅 AI 回答
   - **导出思考过程** - 包含深度思考过程
3. 文件自动下载到下载文件夹

---

## 导出格式

```markdown
# AI 对话记录

## 用户
你好

---

## AI
你好！有什么可以帮你的？

---
```

---

## 常见问题

### 找不到按钮？

1. 刷新页面（F5）
2. 等待 2-3 秒
3. 检查插件是否已启用

### 按钮位置不对？

首次加载时按钮可能在右下角，刷新页面后会移动到输入框附近。

### 部分消息没导出？

- 滚动到页面顶部，确保历史消息已加载
- 等待 AI 回复完成后再导出

### 提示"请等待 AI 回复完成"？

AI 正在生成回复，等待完成后再点击按钮。

---

## 支持的浏览器

| 浏览器 | 支持 |
|--------|------|
| Chrome | ✅ |
| Edge | ✅ |
| Brave | ✅ |
| Opera | ✅ |
| 360浏览器 | ✅ |
| QQ浏览器 | ✅ |
| Firefox | ❌ 需适配 |
| Safari | ❌ 不支持 |

---

## 项目结构

```
├── public/          # 源代码
│   ├── manifest.json
│   ├── background/  # 后台脚本
│   ├── content/     # 内容脚本
│   └── utils/       # 工具函数
├── dist/            # 构建输出（可直接加载）
├── package.json
└── vite.config.js
```

---

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

---

## License

MIT
