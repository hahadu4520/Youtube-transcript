# YouTube Transcript Skill

YouTube 视频转录提取工具，支持带时间戳的 transcript、Markdown/JSON 归档、代理、英文转中文翻译，以及 Feishu/Lark 分块交接。底层由 Defuddle 驱动，也保留普通网页 clean content 提取能力。

## 安装

```bash
# 克隆到 OpenClaw/Codex/Claude Code 都能复用的本地位置
git clone git@github.com:hahadu4520/openclaw-defuddle.git ~/.openclaw/skills/defuddle

# 安装依赖
cd ~/.openclaw/skills/defuddle
npm install
```

### Codex

```bash
ln -s ~/.openclaw/skills/defuddle ~/.codex/skills/youtube-transcript
```

### Claude Code

```bash
ln -s ~/.openclaw/skills/defuddle ~/.claude/skills/youtube-transcript
```

## 快速开始

```bash
# 提取 YouTube 视频 transcript
node extract.mjs "https://youtube.com/watch?v=..."

# 网络受限时启用代理
node extract.mjs "https://youtube.com/watch?v=..." --proxy

# 临时指定代理
node extract.mjs "https://youtube.com/watch?v=..." --proxy-url http://127.0.0.1:7890

# 输出到指定文件
node extract.mjs "https://youtube.com/watch?v=..." --output ~/Documents/transcript.md

# 输出 JSON
node extract.mjs "https://youtube.com/watch?v=..." --json-only

# 英文内容翻译成中文（由当前 Agent 内置模型完成）
node extract.mjs "https://youtube.com/watch?v=..." --translate

# 次要能力：提取普通网页正文
node extract.mjs "https://example.com/article"
```

## 与 web_fetch 的区别

| 功能 | web_fetch | YouTube Transcript |
|------|-----------|----------|
| YouTube transcript | ❌ | ✅ |
| 代理支持 | 部分 | ✅ 完整 |
| Debug模式 | ❌ | ✅ |
| HTML标准化 | ❌ | ✅ |
| Markdown/JSON归档 | 部分 | ✅ |
| Feishu/Lark分块交接 | ❌ | ✅ |

## 配置

编辑 `config.json`:
- `proxy`: 代理设置。默认自动读取 `HTTPS_PROXY` / `HTTP_PROXY` 环境变量；也可用 `--proxy-url` 临时指定
- `defuddle`: Defuddle选项
- `output`: 输出配置
- `translation`: 翻译配置。默认由当前 Agent 内置模型完成，脚本只输出翻译交接任务，不调用外部模型 API
- `feishu`: Feishu/Lark 分块配置

## 文档

- `SKILL.md`: Agent 使用入口，包含 YouTube Transcript 触发说明和 Codex / Claude Code / OpenClaw 兼容说明
- `WORKFLOW.md`: 原始实现流程和技术细节
- `feishu-integration.md`: Feishu/Lark 分块保存方案
- `TRANSLATION_GUIDE.md`: 翻译配置和使用方式

## 示例

### YouTube视频
```bash
node extract.mjs "https://youtube.com/watch?v=rO3dIBMXD2g" \
  --proxy \
  --output ~/Videos/transcript.md
```

### 博客文章
```bash
node extract.mjs "https://blog.example.com/post" \
  --output ~/Articles/clean.md
```

### Feishu/Lark 交接

```bash
node extract.mjs "https://youtube.com/watch?v=..." --feishu
```

脚本会在 stdout 输出 `AGENT_TASK: FEISHU_SAVE` JSON。Agent 需要读取其中的 `chunks`，再用当前环境可用的 Feishu/Lark 文档工具创建文档并依次追加内容。

## License

MIT
