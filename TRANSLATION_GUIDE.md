# Defuddle 翻译功能使用指南

## 🎯 功能概述

Defuddle 现在支持**中英双语翻译**功能！提取英文 YouTube 视频或文章时，自动在每个段落后添加中文翻译。

## 📋 前置准备

### 1. 获取 Claude API Key

访问 [Anthropic Console](https://console.anthropic.com/) 获取 API Key。

### 2. 配置 API Key

**方式 A: 环境变量（推荐）**
```bash
export ANTHROPIC_API_KEY="sk-ant-xxx..."
```

**方式 B: config.json**
```bash
cd ~/.openclaw/skills/defuddle
nano config.json
```

修改 `translation.apiKey`:
```json
{
  "translation": {
    "apiKey": "sk-ant-xxx..."
  }
}
```

## 🚀 快速开始

### 基础用法

```bash
cd ~/.openclaw/skills/defuddle

# 提取YouTube视频并翻译
node extract.mjs "https://youtube.com/watch?v=rO3dIBMXD2g" --proxy --translate
```

### Agent 调用

**用户**: "用defuddle提取这个YouTube视频，要带中文翻译：https://youtube.com/watch?v=rO3dIBMXD2g"

**Agent 执行**:
```bash
cd ~/.openclaw/skills/defuddle
node extract.mjs "https://youtube.com/watch?v=rO3dIBMXD2g" --proxy --translate
```

### 保存到飞书（含翻译）

```bash
node extract.mjs "https://youtube.com/watch?v=..." --proxy --translate --feishu
```

Agent 会自动：
1. 提取 YouTube transcript
2. 逐段翻译成中文
3. 创建飞书文档（中英双语）
4. 返回飞书链接

## 📝 输出格式

### Markdown 输出

```markdown
# Blueprint to Build a $1M SaaS From Scratch

**Language**: en
**Translation**: Enabled (English → 中文)

---

> ℹ️ **本文档包含中英双语翻译**。每个英文段落后跟随中文翻译。

## Transcript

**0:00** · If you've ever wanted to build a SAS that pays your bills, today's episode is for you.

> **中文翻译**：
> 如果你曾经想建立一个能支付账单的 SaaS 产品，今天的这一集就是为你准备的。

**0:40** · I don't care. I want you to go build something that ends up changing your life.

> **中文翻译**：
> 我不在乎。我希望你去构建一些最终能改变你生活的东西。
```

### 飞书文档输出

飞书文档会包含：
- ✅ 完整的英文转录
- ✅ 每段后跟中文翻译
- ✅ 元数据（标题、作者、时间等）
- ✅ 全角符号（＄）避免显示问题

## ⚙️ 配置选项

编辑 `~/.openclaw/skills/defuddle/config.json`:

```json
{
  "translation": {
    "enabled": false,           // true = 自动翻译所有英文内容
    "autoDetect": true,         // 自动检测语言
    "sourceLanguages": ["en", "eng"],  // 需要翻译的语言
    "targetLanguage": "zh-CN",  // 目标语言
    "apiProvider": "claude",    // API 提供商
    "model": "claude-sonnet-4", // Claude 模型
    "apiKey": null,             // API Key（优先使用环境变量）
    "maxChunkSize": 3000        // 每次翻译最大字符数
  }
}
```

### 全局启用翻译

如果希望所有提取都自动翻译：

```json
{
  "translation": {
    "enabled": true
  }
}
```

之后无需 `--translate` 参数，自动翻译所有英文内容。

## 🔍 工作原理

1. **语言检测**: Defuddle 自动检测内容语言
2. **过滤判断**: 仅翻译英文内容（`en`/`eng`）
3. **分段翻译**: 按段落分割，逐段调用 Claude API
4. **格式保持**: 保留 Markdown 格式（加粗、链接、时间戳等）
5. **插入翻译**: 在每个英文段落后插入中文翻译

## 💰 成本估算

- **Claude Sonnet 模型**: ~$0.003/1K tokens
- **10,888 字英文视频**: 约 15K tokens
- **估算成本**: $0.05 - $0.10（约 ¥0.35 - ¥0.70）

## 📊 翻译质量

### ✅ 优点
- Claude 翻译质量高，自然流畅
- 保持原文格式和结构
- 逐段翻译，保留上下文

### ⚠️ 限制
- 代码块、表格不翻译（保持原样）
- 超长段落会自动分割（≤3000字符）
- 需要 API Key 和网络连接

## 🐛 故障排查

### 问题 1: "未配置Claude API Key"

**原因**: 缺少 API Key

**解决**:
```bash
# 方式 1: 环境变量
export ANTHROPIC_API_KEY="sk-ant-xxx..."

# 方式 2: config.json
nano ~/.openclaw/skills/defuddle/config.json
# 设置 translation.apiKey
```

### 问题 2: "翻译失败" / API 错误

**可能原因**:
- API Key 无效
- API 余额不足
- 网络连接问题

**解决**:
1. 检查 API Key 是否正确
2. 访问 [Anthropic Console](https://console.anthropic.com/) 查看余额
3. 检查网络连接（是否需要代理）

### 问题 3: 翻译跳过了某些段落

**正常现象**:
- 代码块（\`\`\`）不翻译
- 表格（`|...|`）不翻译
- 分隔线（`---`）不翻译

**检查**:
- 确保使用了 `--translate` 参数
- 检查内容语言是否为英文（`result.language === 'en'`）

### 问题 4: 翻译速度慢

**正常现象**: 每段约 1-3 秒

**优化**:
- 减少 `maxChunkSize`（但会增加 API 调用次数）
- 使用更快的模型（如 `claude-haiku`）

## 📚 完整示例

### 示例 1: 基础翻译

```bash
# 提取并翻译
cd ~/.openclaw/skills/defuddle
node extract.mjs "https://youtube.com/watch?v=rO3dIBMXD2g" --proxy --translate

# 输出：
# ✅ 提取完成！
# 📝 已翻译: 120/120 段落
# 💾 已保存: ~/Documents/Du/🦞OpenClaw研究室/Blueprint_to_Build_a_1M_SaaS_From_Scratch_2026-03-14.md
```

### 示例 2: 翻译并保存到飞书

```bash
node extract.mjs "https://youtube.com/watch?v=rO3dIBMXD2g" --proxy --translate --feishu
```

**输出**:
```
=== AGENT_TASK: FEISHU_SAVE ===
{
  "task": "feishu_save",
  "title": "Blueprint to Build a $1M SaaS From Scratch",
  "chunks": [...],  // 包含中英双语内容
  "metadata": {...}
}
=== END_AGENT_TASK ===
```

Agent 自动执行：
1. 创建飞书文档
2. 分段追加内容（中英双语）
3. 返回链接

### 示例 3: Agent 完整流程

**用户**: "帮我提取这个YouTube视频的transcript，要中英文对照，保存到飞书：https://youtube.com/watch?v=rO3dIBMXD2g"

**Agent 行为**:
1. 读取 `~/.openclaw/skills/defuddle/SKILL.md`
2. 检查依赖
3. 执行：
   ```bash
   node extract.mjs "https://youtube.com/watch?v=rO3dIBMXD2g" --proxy --translate --feishu
   ```
4. 解析 AGENT_TASK JSON
5. 调用 `feishu_doc` 创建文档并追加内容
6. 返回飞书链接给用户

## 🎓 最佳实践

1. **API Key 管理**: 使用环境变量（避免泄露到 git）
2. **成本控制**: 仅翻译需要的内容（避免全局启用）
3. **质量检查**: 翻译后人工审核重要内容
4. **备份原文**: 翻译不会删除原文，保留中英对照

## 📖 相关文档

- [Defuddle 主文档](./SKILL.md)
- [Feishu 保存说明](./SKILL.md#飞书文档保存)
- [故障排查](./SKILL.md#故障排查)

---

**版本**: v1.1.0  
**更新时间**: 2026-03-14  
**维护者**: OpenClaw Community
