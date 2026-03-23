# 示例：YouTube视频提取

## 命令
```bash
node extract.mjs "https://youtube.com/watch?v=rO3dIBMXD2g" --proxy
```

## 输出预览

```
🌐 代理已启用: http://127.0.0.1:15236

⏳ 开始提取: https://youtube.com/watch?v=rO3dIBMXD2g
📥 获取HTML...
🔍 Defuddle解析...

✅ 提取完成！
📊 标题: Blueprint to Build a $1M SaaS From Scratch
👤 作者: Greg Isenberg
📅 发布: 2025-12-08T14:10:00-08:00
📝 字数: 10888
⏱️  解析: 2655ms
🔧 提取器: m
✅ 内容已提取: 57217 chars

💾 已保存: /Users/duu/Documents/Du/🦞OpenClaw研究室/Blueprint_to_Build_a_1M_SaaS_From_Scratch_2026-03-14.md
📦 JSON: /Users/duu/Documents/Du/🦞OpenClaw研究室/Blueprint_to_Build_a_1M_SaaS_From_Scratch_2026-03-14.json
```

## 提取内容特点

- ✅ **完整transcript**：57,217字符，10,888词
- ✅ **时间戳**：每段对话都有精确时间（如 `**0:00** · ...`）
- ✅ **章节分段**：自动识别章节（Intro, Waitlist Strategy等）
- ✅ **Metadata**：作者、发布时间、缩略图、语言等
- ✅ **Debug信息**：提取器类型、解析时间

## 生成的Markdown结构

```markdown
# Blueprint to Build a $1M SaaS From Scratch

**URL**: https://youtube.com/watch?v=rO3dIBMXD2g
**Author**: Greg Isenberg
**Published**: 2025-12-08T14:10:00-08:00
**Word Count**: 10888
...

## Description
Download the 6 SaaS playbooks...

## Thumbnail
![](https://i.ytimg.com/vi/rO3dIBMXD2g/maxresdefault.jpg)

## Content
![](https://www.youtube.com/watch?v=rO3dIBMXD2g)

## Transcript

### Intro

**0:00** · If you've ever wanted to build a SAS...
**0:40** · I don't care. I want you to go build...
...

### 1) Waitlist Strategy: Kleo & Mentions Case Study
...
```

## 关键发现

1. **YouTube专用extractor**：Defuddle检测到YouTube页面，使用type `m` extractor
2. **Transcript API调用**：通过代理成功调用第三方API获取字幕
3. **性能**：2.7秒完成（相比无代理的21秒超时）
4. **质量**：完整保留时间戳和章节结构
