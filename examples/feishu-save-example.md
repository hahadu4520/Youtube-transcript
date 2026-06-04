# 飞书保存示例

## 场景：YouTube长视频完整保存到飞书

### 1. 执行命令
```bash
cd ~/.openclaw/skills/defuddle
node extract.mjs "https://youtube.com/watch?v=rO3dIBMXD2g" --proxy --feishu
```

### 2. 脚本输出

```
🌐 代理已启用: http://127.0.0.1:7890

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

💾 已保存: ~/Documents/Defuddle/Blueprint_to_Build_2026-03-14.md
📦 JSON: ~/Documents/Defuddle/Blueprint_to_Build_2026-03-14.json

📄 准备保存到飞书...
  ✓ 已分段: 3个段落 (每段≤25000字符)

=== AGENT_TASK: FEISHU_SAVE ===
{
  "task": "feishu_save",
  "title": "Blueprint to Build a $1M SaaS From Scratch",
  "chunks": [
    "# Blueprint to Build a $1M SaaS From Scratch\n\n（第一段内容，<25K字符）...",
    "（第二段内容，<25K字符）...",
    "（第三段内容，<25K字符）..."
  ],
  "folder_token": null,
  "metadata": {
    "url": "https://youtube.com/watch?v=rO3dIBMXD2g",
    "wordCount": 10888,
    "author": "Greg Isenberg",
    "published": "2025-12-08T14:10:00-08:00",
    "localPath": "~/Documents/Defuddle/Blueprint_to_Build_2026-03-14.md"
  }
}
=== END_AGENT_TASK ===

💡 提示: Agent将自动创建飞书文档并分段保存内容
```

### 3. Agent处理

Agent识别到`AGENT_TASK: FEISHU_SAVE`后：

#### 步骤1: 创建文档（第一段）
```javascript
feishu_doc({
  action: 'create',
  title: 'Blueprint to Build a $1M SaaS From Scratch',
  content: chunks[0]  // 第一段，<25K字符
})

// 返回:
{
  doc_token: 'ABC123def456',
  url: 'https://xxx.feishu.cn/docx/ABC123def456'
}
```

#### 步骤2: 追加第二段
```javascript
feishu_doc({
  action: 'append',
  doc_token: 'ABC123def456',
  content: chunks[1]  // 第二段
})
```

#### 步骤3: 追加第三段
```javascript
feishu_doc({
  action: 'append',
  doc_token: 'ABC123def456',
  content: chunks[2]  // 第三段
})
```

### 4. 最终结果

✅ **飞书文档已创建**：https://xxx.feishu.cn/docx/ABC123def456

**内容**：
- ✅ 完整的10,888词transcript
- ✅ 带时间戳（`**0:00** · ...`）
- ✅ 结构化章节
- ✅ 元数据（作者/发布时间/本地路径）

**本地备份**：`~/Documents/Defuddle/Blueprint_to_Build_2026-03-14.md`

---

## 关键要点

### 为什么分3段？
- 原始内容：57,217字符
- 每段限制：25,000字符
- 分段数：3段（第1段25K，第2段25K，第3段7K）

### 为什么过滤表格？
- 飞书不支持Markdown表格
- 脚本自动替换为提示文本：`> **表格内容**（飞书不支持Markdown表格，请查看本地文件）`

### 为什么不用摘要？
- 用户要求完整保存
- 智能分段可以保留全部内容
- 本地 + 飞书双份备份

---

## 故障排查

### 问题1: Agent没有调用feishu_doc
**原因**: Agent可能没有识别到AGENT_TASK  
**解决**: 手动提示Agent："请创建飞书文档并分段保存上面的内容"

### 问题2: 飞书API 400错误
**原因**: 单段内容仍然太长  
**解决**: 修改config.json中的`feishu.chunkSize`（降低到15000）

### 问题3: 表格显示异常
**说明**: 这是预期行为（飞书不支持Markdown表格）  
**解决**: 查看本地文件获取完整表格

---

*创建时间: 2026-03-14*
