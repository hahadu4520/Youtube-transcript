# Defuddle - 高级网页内容提取

提取任意网页的clean content，支持YouTube transcript、代理配置、HTML标准化、Debug模式。

## 🎯 核心功能

- ✅ **YouTube transcript提取**（带时间戳）
- ✅ **中英双语翻译**（自动翻译英文内容到中文）⭐️ 新功能
- ✅ **Clean content提取**（去除广告/侧边栏/导航）
- ✅ **代理支持**（突破网络限制）
- ✅ **HTML标准化**（统一格式：heading/code/footnote/math）
- ✅ **Debug模式**（查看提取逻辑）
- ✅ **多种输出格式**（Markdown/JSON）

## 🚀 快速开始

### 1. 安装依赖（首次使用）

```bash
cd ~/.openclaw/skills/defuddle
npm install
```

### 2. 基础用法

```bash
# 提取普通网页
node extract.mjs "https://example.com/article"

# 提取YouTube视频（需要代理）
node extract.mjs "https://youtube.com/watch?v=..." --proxy

# 提取并翻译英文内容到中文（每段后跟中文翻译）
node extract.mjs "https://youtube.com/watch?v=..." --proxy --translate

# 自定义输出路径
node extract.mjs <url> --output ~/Documents/result.md

# 禁用async（不获取transcript）
node extract.mjs <url> --no-async

# 输出JSON
node extract.mjs <url> --json-only
```

### 3. Agent调用示例

#### 基础提取（仅本地）
**用户**: "用defuddle提取这个YouTube视频的transcript: https://youtube.com/watch?v=rO3dIBMXD2g"

**Agent行为**:
1. 读取此SKILL.md
2. 检查依赖（defuddle/linkedom/undici）
3. 读取config.json获取代理配置
4. 执行：`node extract.mjs <url> --proxy --output <obsidian-path>`
5. 返回结果路径

#### 保存到飞书（完整内容）
**用户**: "用defuddle提取并保存到飞书"

**Agent行为**:
1. 执行：`node extract.mjs <url> --proxy --feishu`
2. 脚本输出包含`=== AGENT_TASK: FEISHU_SAVE ===`的JSON
3. **解析JSON获取chunks和metadata**
4. **调用feishu_doc创建文档**:
   ```javascript
   feishu_doc({
     action: 'create',
     title: task.title,
     content: task.chunks[0],
     folder_token: task.folder_token
   })
   ```
5. **获取doc_token后，分段append**:
   ```javascript
   for (let i = 1; i < task.chunks.length; i++) {
     feishu_doc({
       action: 'append',
       doc_token: doc_token,
       content: task.chunks[i]
     })
   }
   ```
6. 返回飞书文档链接

**关键**: 脚本会自动分段（每段≤25K字符），Agent只需按顺序调用feishu_doc即可

## 📋 配置文件

`config.json` 包含：
- **proxy**: 代理配置（http/https/enabled）
- **defuddle**: Defuddle选项（useAsync/markdown/debug等）
- **output**: 默认输出路径、格式、是否自动打开

编辑配置：
```bash
nano ~/.openclaw/skills/defuddle/config.json
```

## 🔧 CLI参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--proxy` | 启用代理 | false |
| `--no-async` | 禁用异步extractor | false |
| `--output <path>` | 输出路径 | config.output.defaultPath |
| `--feishu` | 保存到飞书文档（完整内容） | false |
| `--feishu-folder <token>` | 指定飞书文件夹 | config.feishu.folder_token |
| `--json-only` | 只输出JSON | false |
| `--no-markdown` | 禁用Markdown转换 | false |
| `--translate` | 翻译英文到中文 | false |
| `--open` | 自动打开结果 | false |
| `--debug` | 启用debug模式 | true |

## 🌐 中英双语翻译

### 功能说明

当使用 `--translate` 参数时，脚本会：
1. ✅ 自动检测内容语言（基于Defuddle的language字段）
2. ✅ 仅翻译英文内容（`en`/`eng`语言）
3. ✅ 调用Claude API逐段翻译
4. ✅ 在每个英文段落后插入中文翻译
5. ✅ 保持原文格式（Markdown/链接/加粗等）

### 输出格式

翻译后的文档格式如下：

```markdown
# 视频标题

**Language**: en
**Translation**: Enabled (English → 中文)

---

> ℹ️ **本文档包含中英双语翻译**。每个英文段落后跟随中文翻译。

## Content

**0:00** · If you've ever wanted to build a SaaS that pays your bills...

> **中文翻译**：
> 如果你曾经想建立一个能支付账单的 SaaS 产品...

**0:40** · I don't care. I want you to go build something...

> **中文翻译**：
> 我不在乎。我希望你去构建一些能改变你生活的东西...
```

### 配置

在 `config.json` 中配置翻译：

```json
{
  "translation": {
    "enabled": false,          // 全局启用（或使用 --translate）
    "autoDetect": true,        // 自动检测语言
    "sourceLanguages": ["en", "eng"],  // 需要翻译的源语言
    "targetLanguage": "zh-CN", // 目标语言
    "apiProvider": "claude",   // API提供商
    "model": "claude-sonnet-4",// Claude模型
    "apiKey": null,            // API Key（优先使用环境变量）
    "maxChunkSize": 3000       // 每次翻译最大字符数
  }
}
```

### API Key 配置

翻译功能需要 Claude API Key，有两种配置方式：

**方式1: 环境变量（推荐）**
```bash
export ANTHROPIC_API_KEY="sk-ant-xxx..."
```

**方式2: config.json**
```json
{
  "translation": {
    "apiKey": "sk-ant-xxx..."
  }
}
```

### 使用示例

#### 示例1: 翻译YouTube视频转录
```bash
node extract.mjs "https://youtube.com/watch?v=..." --proxy --translate
```

**结果**: 完整transcript + 每段中文翻译

#### 示例2: 翻译并保存到飞书
```bash
node extract.mjs "https://youtube.com/watch?v=..." --proxy --translate --feishu
```

**结果**: 飞书文档包含中英双语内容

#### 示例3: 全局启用翻译
编辑 `config.json`:
```json
{
  "translation": {
    "enabled": true
  }
}
```

之后所有英文内容都会自动翻译：
```bash
node extract.mjs "https://example.com/english-article"
# 自动检测到英文并翻译
```

### 翻译质量

- ✅ 使用 Claude API 翻译，质量高
- ✅ 保持原文 Markdown 格式
- ✅ 逐段翻译，避免丢失上下文
- ⚠️ 超长段落会自动分割（每段≤3000字符）
- ⚠️ 代码块、表格、分隔线不会翻译

### 性能和成本

- **速度**: 每段落约 1-3 秒（取决于 API 响应）
- **成本**: 按 Claude API 计费（约 $0.003/1K tokens）
- **优化**: 自动跳过非英文内容，减少不必要的API调用

### 故障排查

**问题: "未配置Claude API Key"**
- 解决: 设置环境变量 `ANTHROPIC_API_KEY` 或在 config.json 中配置

**问题: "翻译失败" / API错误**
- 检查API Key是否有效
- 检查网络连接
- 查看API余额是否充足

**问题: 翻译跳过了某些段落**
- 正常现象：代码块、表格、分隔线等特殊格式不翻译
- 确保启用了 `--translate` 参数
- 检查内容语言是否为英文

---

## 📄 飞书文档保存

### 完整内容保存（智能分段）

当使用`--feishu`参数时，脚本会：
1. ✅ 过滤飞书不支持的格式（Markdown表格）
2. ✅ 智能分段（每段≤25K字符，避免API限制）
3. ✅ 输出AGENT_TASK格式的JSON
4. ✅ Agent自动调用feishu_doc创建并追加内容

### Agent处理流程

```javascript
// 1. 执行脚本
const { stdout } = await exec('node extract.mjs <url> --feishu --proxy');

// 2. 提取AGENT_TASK JSON
const match = stdout.match(/=== AGENT_TASK: FEISHU_SAVE ===([\s\S]+)=== END_AGENT_TASK ===/);
const task = JSON.parse(match[1]);

// 3. 创建飞书文档（第一段）
const createResult = await feishu_doc({
  action: 'create',
  title: task.title,
  content: task.chunks[0],
  folder_token: task.folder_token
});

const doc_token = createResult.doc_token;

// 4. 追加后续段落
for (let i = 1; i < task.chunks.length; i++) {
  await feishu_doc({
    action: 'append',
    doc_token: doc_token,
    content: task.chunks[i]
  });
}

// 5. 返回文档链接
return createResult.url;
```

### 为什么不用摘要模式？

用户要求完整保存，所以采用智能分段方案：
- ✅ 保留全部内容
- ✅ 自动过滤不支持格式
- ✅ 分段避免API限制
- ✅ 一次性完整保存

### 飞书内容格式

```markdown
# 标题

**来源**: URL
**作者**: 作者名
**发布时间**: 时间
**字数**: 10,888
**语言**: en
**提取时间**: 2026-03-14

---

## 描述
（描述内容）

---

## 内容
（完整提取内容，已过滤表格）

---

## 提取信息
- 解析时间: 2655ms
- 提取器类型: m
- 本地文件: /path/to/file.md
```

---

## 📊 输出格式

### Markdown输出
```markdown
# {{title}}

**URL**: {{url}}
**Author**: {{author}}
**Published**: {{published}}
**Word Count**: {{wordCount}}

---

## Description
{{description}}

---

## Content
{{content}}

---

## Debug Info
- Selector: {{debug.contentSelector}}
- Removals: {{debug.removals.length}}
```

### JSON输出
完整的Defuddle返回对象，包含：
- content（HTML/Markdown）
- title, author, description
- wordCount, parseTime
- debug信息

## 🎬 使用场景

### 场景1: YouTube视频转录
```bash
node extract.mjs "https://youtube.com/watch?v=..." --proxy --output ~/Videos/transcript.md
```

**结果**: 完整transcript，带时间戳（如 `**0:00** · 内容...`）

### 场景2: 博客文章提取
```bash
node extract.mjs "https://blog.example.com/post" --output ~/Articles/clean.md
```

**结果**: Clean markdown，无广告/侧边栏

### 场景3: Batch processing
```bash
# 创建URL列表
echo "https://example.com/1" > urls.txt
echo "https://example.com/2" >> urls.txt

# 批量处理
while read url; do
  node extract.mjs "$url" --output "$(basename $url).md"
done < urls.txt
```

### 场景4: 集成到workflow
```javascript
// 在其他脚本中调用
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function extractWithDefuddle(url) {
  const { stdout } = await execAsync(
    `node ~/.openclaw/skills/defuddle/extract.mjs "${url}" --json-only`
  );
  return JSON.parse(stdout);
}
```

## ⚙️ 高级配置

### 自定义Defuddle选项

编辑 `config.json`:
```json
{
  "defuddle": {
    "useAsync": true,           // 启用第三方API（YouTube transcript）
    "markdown": true,           // 输出Markdown
    "debug": true,              // Debug模式
    "removeImages": false,      // 保留图片
    "removeSmallImages": true,  // 移除小图片（图标/tracking）
    "standardize": true,        // HTML标准化
    "removeLowScoring": true    // 移除低质量块
  }
}
```

### 自定义代理

```json
{
  "proxy": {
    "http": "http://127.0.0.1:7890",
    "https": "http://127.0.0.1:7890",
    "enabled": true
  }
}
```

支持的代理类型：
- HTTP: `http://host:port`
- HTTPS: `https://host:port`
- SOCKS5: `socks5://host:port`（需要额外配置）

### 输出路径模板

```json
{
  "output": {
    "defaultPath": "~/Documents/Du/🦞OpenClaw研究室",
    "template": "{{title}}_{{date}}.md",  // 支持变量
    "autoOpen": false,
    "saveJson": true
  }
}
```

## 🐛 故障排查

### 问题1: "fetch failed" / "Connect Timeout"
**原因**: 网络限制（墙）  
**解决**: 启用代理 `--proxy`

### 问题2: "Word Count: 0" / 无transcript
**原因1**: YouTube页面，但useAsync=false  
**解决**: 启用async：移除 `--no-async`

**原因2**: 代理未生效  
**解决**: 检查config.json中的proxy配置

### 问题3: "Module not found"
**原因**: 依赖未安装  
**解决**: `cd ~/.openclaw/skills/defuddle && npm install`

### 问题4: 提取内容质量差
**解决**: 启用debug模式查看移除记录
```bash
node extract.mjs <url> --debug --output result.md
# 查看 result.md 的 Debug Info 部分
```

## 📚 与web_fetch的对比

| 功能 | web_fetch | defuddle |
|------|-----------|----------|
| 普通网页 | ✅ | ✅ |
| YouTube transcript | ❌ | ✅ |
| 代理支持 | 部分 | ✅ 完整 |
| Debug模式 | ❌ | ✅ |
| HTML标准化 | ❌ | ✅ |
| 配置灵活性 | 低 | 高 |
| Math公式支持 | ❌ | ✅ |

**建议**:
- 快速提取 → web_fetch
- 高质量提取/YouTube → defuddle

## 🔗 相关技能

- **business-writer**: 可用defuddle改进文章提取
- **video-slicer**: 可用defuddle获取YouTube metadata
- **obsidian**: 提取内容可直接保存到vault

## 📝 依赖清单

- **defuddle**: ^1.0.0 - 核心提取引擎
- **linkedom**: ^0.16.0 - DOM实现
- **undici**: ^6.0.0 - HTTP客户端（代理支持）

## 🚀 版本历史

- **v1.0.0** (2026-03-14)
  - 初始版本
  - YouTube transcript支持
  - 代理配置
  - Debug模式

---

**维护者**: OpenClaw Community  
**许可**: MIT  
**文档更新**: 2026-03-14
