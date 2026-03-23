# Defuddle Skill for OpenClaw

高级网页内容提取工具，支持YouTube transcript、代理、Debug模式。

## 快速开始

```bash
# 1. 安装依赖
cd ~/.openclaw/skills/defuddle
npm install

# 2. 提取网页
node extract.mjs "https://example.com/article"

# 3. 提取YouTube视频（需要代理）
node extract.mjs "https://youtube.com/watch?v=..." --proxy
```

## 与web_fetch的区别

| 功能 | web_fetch | defuddle |
|------|-----------|----------|
| YouTube transcript | ❌ | ✅ |
| 代理支持 | 部分 | ✅ 完整 |
| Debug模式 | ❌ | ✅ |
| HTML标准化 | ❌ | ✅ |

## 配置

编辑 `config.json`:
- `proxy`: 代理设置
- `defuddle`: Defuddle选项
- `output`: 输出配置

## 文档

详见 `SKILL.md`

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

## License

MIT
