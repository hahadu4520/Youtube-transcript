# Defuddle + 飞书文档集成方案

## 📋 现状分析

### feishu_doc工具能力
- ✅ `create`: 创建新文档（支持title + folder_token）
- ✅ `write`: 替换全部内容（Markdown，但不支持表格）
- ✅ `append`: 追加内容
- ❌ **限制**: Markdown表格不支持

### 之前遇到的问题
1. **400错误** - 可能原因：
   - 内容太长（10,888词 → 57KB Markdown）
   - 包含不支持的格式（表格）
   - API限制

---

## 🎯 集成方案设计

### 方案1: 智能分段（推荐）
**核心思想**: 长内容分段创建，短内容直接创建

```javascript
if (wordCount > 5000) {
  // 创建主文档（摘要）
  createDoc(title, summary);
  // 分段追加完整内容
  for (chunk of chunks) {
    appendDoc(doc_token, chunk);
  }
} else {
  // 直接创建
  createDoc(title, content);
}
```

**优点**:
- ✅ 适应长短内容
- ✅ 避免API限制
- ✅ 保留完整信息

**缺点**:
- ⚠️ 需要多次API调用
- ⚠️ 实现复杂

---

### 方案2: 摘要模式（快速）
**核心思想**: 只保存核心摘要，附上原始链接

```markdown
# 标题

**来源**: URL
**字数**: 10,888
**提取时间**: 2026-03-14

---

## 摘要
（AI生成的200字摘要）

---

## 完整内容
查看本地文件：~/Documents/xxx.md
或原始链接：https://...
```

**优点**:
- ✅ 快速
- ✅ 不受长度限制
- ✅ 飞书文档聚焦核心

**缺点**:
- ❌ 完整内容不在飞书

---

### 方案3: 双轨制（灵活）
**核心思想**: 提供CLI参数选择模式

```bash
# 完整模式（分段）
node extract.mjs <url> --feishu --mode full

# 摘要模式
node extract.mjs <url> --feishu --mode summary

# 不保存飞书（默认）
node extract.mjs <url>
```

**优点**:
- ✅ 用户可选
- ✅ 灵活性高

**缺点**:
- ⚠️ 参数复杂

---

## 🔧 实现细节

### 1. Markdown过滤（避免400错误）

```javascript
function sanitizeMarkdownForFeishu(markdown) {
  // 移除表格（飞书不支持）
  markdown = markdown.replace(/\|[^\n]+\|\n(\|[-:\s]+\|)+\n(\|[^\n]+\|\n)*/g, 
    '\n```\n表格（飞书不支持，请查看本地文件）\n```\n');
  
  // 转换不支持的图片语法
  markdown = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, 
    '图片: $2');
  
  return markdown;
}
```

### 2. 智能分段

```javascript
function chunkContent(content, maxChunkSize = 30000) {
  const chunks = [];
  let currentChunk = '';
  
  const lines = content.split('\n');
  for (const line of lines) {
    if ((currentChunk + line).length > maxChunkSize) {
      chunks.push(currentChunk);
      currentChunk = line + '\n';
    } else {
      currentChunk += line + '\n';
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  
  return chunks;
}
```

### 3. 摘要生成（可选）

```javascript
async function generateSummary(content, maxWords = 200) {
  // 选项1: 简单截取
  return content.split(' ').slice(0, maxWords).join(' ') + '...';
  
  // 选项2: AI生成（调用Claude/GPT）
  // return await callAI(`Summarize in 200 words: ${content}`);
}
```

---

## 📝 配置扩展

### config.json 新增字段

```json
{
  "feishu": {
    "enabled": false,
    "mode": "summary",  // "full" | "summary" | "auto"
    "autoMode": {
      "threshold": 5000,  // 超过5000词自动用summary模式
    },
    "folder_token": null,  // 默认文件夹
    "createTitle": "{{title}} - Defuddle提取",
    "chunkSize": 30000,  // 分段大小（字符）
    "summary": {
      "enabled": true,
      "maxWords": 300
    }
  }
}
```

---

## 🚀 CLI扩展

### 新增参数

```bash
# 启用飞书保存
--feishu

# 指定模式
--feishu-mode [full|summary|auto]

# 指定文件夹
--feishu-folder <token>

# 飞书+本地（默认）
--feishu --output ~/result.md
```

---

## 📊 流程图

```
用户触发
  ↓
extract.mjs 提取内容
  ↓
判断：--feishu?
  ↓ 是
判断模式：
  ├─ full → 分段创建
  ├─ summary → 创建摘要
  └─ auto → 根据字数自动选择
  ↓
调用 feishu_doc
  ├─ create (title + 第一段)
  └─ append (后续段落)
  ↓
返回飞书文档链接
```

---

## 🎨 输出示例

### 摘要模式输出（飞书）

```markdown
# Blueprint to Build a $1M SaaS From Scratch

**来源**: https://youtube.com/watch?v=rO3dIBMXD2g  
**作者**: Greg Isenberg  
**字数**: 10,888词  
**提取时间**: 2026-03-14 11:15

---

## 摘要

本期节目邀请Rob Hoffman分享6大SaaS获客策略：1) Waitlist Strategy（候补名单）
2) Wave Surfer（趋势劫持）3) Language Arbitrage（语言套利）4) AI Search（AI搜索优化）
5) Signal Search（信号搜索）6) High Ticket Ads（高价广告）。涵盖从$20K到$338K MRR的真实案例，
逆向工程获客流程，提供可复制的playbook。

---

## 核心要点

- Waitlist策略：Edgy Sales + 早鸟折扣 + 深度访谈（Kleo $61K MRR）
- 趋势劫持：48小时内发布产品搭顺风车（TrustMRR $24K）
- AI搜索转化率是Google的4-17倍（Tally $338K）
- YouTube转化率远超X，Loom视频也能转化（LocalRank $47K）

---

## 完整内容

📂 **本地文件**: `~/Documents/Defuddle/Blueprint_to_Build_2026-03-14.md`

📺 **原视频**: https://youtube.com/watch?v=rO3dIBMXD2g

📄 **字数**: 10,888词 | **字符**: 57,217

---

*由Defuddle提取 | 保存时间: 2026-03-14T11:15:30+08:00*
```

---

## 🔍 技术实现

### extract.mjs 修改点

```javascript
// 1. 导入feishu_doc（通过exec调用OpenClaw）
async function saveToFeishu(result, url, localPath) {
  const config = getFeishuConfig();
  
  if (!config.enabled) return;
  
  // 判断模式
  const mode = determineMode(result.wordCount, config);
  
  if (mode === 'summary') {
    await saveFeishuSummary(result, url, localPath);
  } else {
    await saveFeishuFull(result, url);
  }
}

// 2. 摘要模式
async function saveFeishuSummary(result, url, localPath) {
  const content = `# ${result.title}

**来源**: ${url}
**作者**: ${result.author || 'N/A'}
**字数**: ${result.wordCount}词
**提取时间**: ${new Date().toISOString()}

---

## 摘要
${generateSummary(result.content, 300)}

---

## 完整内容
📂 **本地文件**: \`${localPath}\`
📺 **原始链接**: ${url}
📄 **字数**: ${result.wordCount}词 | **字符**: ${result.content.length}

---
*由Defuddle提取*
`;

  // 调用feishu_doc create
  const createCmd = `openclaw tool feishu_doc '${JSON.stringify({
    action: 'create',
    title: result.title + ' - Defuddle提取',
    content: content
  })}'`;
  
  const { stdout } = await execAsync(createCmd);
  const response = JSON.parse(stdout);
  
  console.log(`\n📄 飞书文档已创建: ${response.url}`);
  return response;
}

// 3. 完整模式（分段）
async function saveFeishuFull(result, url) {
  const sanitized = sanitizeMarkdownForFeishu(result.content);
  const chunks = chunkContent(sanitized, 30000);
  
  // 创建文档（第一段）
  const createCmd = `openclaw tool feishu_doc '${JSON.stringify({
    action: 'create',
    title: result.title,
    content: chunks[0]
  })}'`;
  
  const { stdout } = await execAsync(createCmd);
  const response = JSON.parse(stdout);
  const docToken = response.doc_token;
  
  // 追加后续段落
  for (let i = 1; i < chunks.length; i++) {
    const appendCmd = `openclaw tool feishu_doc '${JSON.stringify({
      action: 'append',
      doc_token: docToken,
      content: chunks[i]
    })}'`;
    await execAsync(appendCmd);
    console.log(`  追加段落 ${i+1}/${chunks.length}...`);
  }
  
  console.log(`\n📄 飞书文档已创建: ${response.url}`);
  return response;
}
```

---

## 🎯 推荐方案

**方案3（双轨制）+ 摘要优先**

**理由**:
1. ✅ YouTube视频通常很长（10K+词）→ 摘要模式更合适
2. ✅ 普通文章（<5K词）→ 可以用完整模式
3. ✅ 用户可通过参数控制

**默认行为**:
```bash
# 默认：只本地
node extract.mjs <url>

# 飞书摘要（推荐）
node extract.mjs <url> --feishu

# 飞书完整（长内容会自动分段）
node extract.mjs <url> --feishu --mode full

# 自动判断（>5K词用摘要，否则完整）
node extract.mjs <url> --feishu --mode auto
```

---

## 📅 实施步骤

### Phase 1: 基础集成（30分钟）
- [ ] 扩展config.json（feishu字段）
- [ ] 实现sanitizeMarkdownForFeishu
- [ ] 实现saveFeishuSummary
- [ ] 添加--feishu参数

### Phase 2: 完整模式（1小时）
- [ ] 实现chunkContent
- [ ] 实现saveFeishuFull
- [ ] 添加--feishu-mode参数
- [ ] 错误处理 + 重试

### Phase 3: 优化（可选）
- [ ] AI摘要生成
- [ ] 进度条显示
- [ ] 飞书文件夹管理

---

## 🧪 测试用例

### 测试1: 短文章（<5K词）
```bash
node extract.mjs "https://example.com/short-article" --feishu
# 预期：飞书完整文档
```

### 测试2: YouTube长视频（>10K词）
```bash
node extract.mjs "https://youtube.com/..." --feishu
# 预期：飞书摘要 + 本地完整文件
```

### 测试3: 完整模式强制
```bash
node extract.mjs "https://youtube.com/..." --feishu --mode full
# 预期：飞书分段创建完整内容
```

---

**下一步**：您希望我先实现哪个方案？推荐从Phase 1开始（摘要模式）。
