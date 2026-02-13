# DeepSeek Exporter - 开发文档

## 项目概述

**名称**: DeepSeek Exporter  
**版本**: 1.0.0  
**功能**: 将DeepSeek平台的对话记录复制到剪贴板或导出为Markdown文件

## 项目结构

```
ai-exporter/
├── public/                    # 源代码目录
│   ├── manifest.json          # Chrome扩展配置
│   ├── background/            # 后台脚本
│   │   └── index.js           # 处理下载请求
│   ├── content/               # 内容脚本
│   │   ├── index.js           # 入口文件，初始化插件
│   │   ├── ui.js              # UI模块，创建按钮
│   │   ├── extractor.js       # 消息提取模块
│   │   ├── selectors.js       # 平台CSS选择器配置
│   │   └── style.css          # 按钮样式
│   ├── utils/                 # 工具函数
│   │   ├── helpers.js         # 平台检测等辅助函数
│   │   └── scrollLoader.js    # 滚动加载消息
│   └── icons/                 # 扩展图标
├── dist/                      # 构建输出目录
├── package.json               # 项目配置
├── vite.config.js             # Vite构建配置
└── .gitignore                 # Git忽略文件
```

## 技术栈

- **Manifest V3**: Chrome扩展最新标准
- **Vite**: 构建工具
- **原生JavaScript**: 无框架依赖

## 核心模块说明

### 1. 内容脚本入口 (content/index.js)

**职责**: 
- 检测当前平台
- 初始化按钮
- 监听SPA页面切换

**关键函数**:
```javascript
init()                    // 初始化插件
createButtonsWithRetry()  // 带重试的按钮创建
setupObserver()           // 监听DOM变化
```

### 2. UI模块 (content/ui.js)

**职责**:
- 创建复制/导出按钮
- 处理用户点击
- 显示导出菜单（DeepSeek专用）

**关键函数**:
```javascript
createButtons()           // 创建按钮并插入页面
createExportMenu()        // 创建导出菜单
downloadContent()         // 下载Markdown文件
copyToClipboard()         // 复制到剪贴板
```

### 3. 消息提取模块 (content/extractor.js)

**职责**:
- 提取对话消息
- 识别用户/AI角色
- 分离思考过程和最终回答

**关键函数**:
```javascript
extractConversation()     // 主提取函数
detectDeepSeekRole()      // 角色检测（固定交替模式）
extractDeepSeekContent()  // 提取消息内容
extractAIAnswer()         // 提取AI最终回答（排除思考过程）
extractDeepSeekThinking() // 提取思考过程
```

### 4. 滚动加载模块 (utils/scrollLoader.js)

**职责**:
- 滚动加载历史消息
- 提取可见消息元素

**关键函数**:
```javascript
scrollToLoadAllMessages()    // 加载所有消息
loadDeepSeekMessages()       // DeepSeek专用加载
extractRenderedMessages()    // 提取已渲染消息
```

### 5. 后台脚本 (background/index.js)

**职责**:
- 处理下载请求
- 使用Chrome Downloads API

## 平台适配

### DeepSeek

**URL匹配**: `*://chat.deepseek.com/*`

**DOM结构特点**:
- 消息容器: `[class*="message"]`
- AI回答: `.ds-markdown`
- 思考过程: `.ds-think-content`

**特殊处理**:
- 深度思考过程分离
- 导出菜单（直接导出/导出思考过程）

### Gemini

**URL匹配**: `*://gemini.google.com/*`

**DOM结构特点**:
- 用户消息: `user-query`
- AI消息: `message-content`

## 数据流

```
用户点击按钮
    ↓
extractConversation()
    ↓
scrollToLoadAllMessages() → 加载所有消息
    ↓
遍历消息容器
    ↓
detectDeepSeekRole() → 识别角色（固定交替）
    ↓
extractDeepSeekContent() → 提取内容
    ↓
生成Markdown文本
    ↓
downloadContent() 或 copyToClipboard()
```

## 角色检测策略

采用**固定交替模式**，简单可靠：

```
消息索引 0 → 用户
消息索引 1 → AI
消息索引 2 → 用户
消息索引 3 → AI
...
```

## 构建命令

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build
```

## 调试技巧

1. 打开Chrome开发者工具 (F12)
2. 查看Console面板的 `[AI Exporter]` 日志
3. 使用 `console.log` 输出调试信息

## 常见问题

### 按钮位置不正确
- 原因：页面DOM未完全加载
- 解决：自动重试机制（最多5次）

### 消息丢失
- 原因：滚动加载不完整
- 解决：检查 `scrollLoader.js` 的滚动逻辑

### 角色识别错误
- 原因：DOM结构变化
- 解决：固定交替模式避免误判

## 扩展新平台

1. 在 `selectors.js` 添加平台选择器配置
2. 在 `manifest.json` 添加URL匹配规则
3. 在 `helpers.js` 的 `detectPlatform()` 添加平台检测
4. 测试并提交代码

## 更新日志

### v1.0.0 (2026-02-13)
- 初始版本
- 支持DeepSeek和Gemini
- 支持复制和导出功能
- 支持思考过程分离（DeepSeek）
