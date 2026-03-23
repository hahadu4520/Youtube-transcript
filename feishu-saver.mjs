#!/usr/bin/env node

/**
 * Feishu文档保存模块
 * 将Defuddle提取的内容智能分段保存到飞书
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf-8'));

/**
 * 过滤飞书不支持的Markdown语法
 */
function sanitizeMarkdownForFeishu(markdown) {
  let cleaned = markdown;
  
  // 1. 移除Markdown表格（飞书不支持）
  cleaned = cleaned.replace(/\|[^\n]+\|\n(\|[-:\s]+\|)+\n(\|[^\n]+\|\n)*/g, 
    '\n> **表格内容**（飞书不支持Markdown表格，请查看本地文件）\n\n');
  
  // 2. 转换图片链接为文本（避免自动上传失败）
  cleaned = cleaned.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, 
    '**图片**: $2');
  
  return cleaned;
}

/**
 * 智能分段：按章节或固定大小分割
 */
function chunkContent(markdown, maxSize = 25000) {
  const chunks = [];
  let currentChunk = '';
  
  // 按行分割
  const lines = markdown.split('\n');
  
  for (const line of lines) {
    const potentialChunk = currentChunk + line + '\n';
    
    // 如果超过限制
    if (potentialChunk.length > maxSize && currentChunk.length > 0) {
      // 保存当前chunk
      chunks.push(currentChunk.trim());
      currentChunk = line + '\n';
    } else {
      currentChunk = potentialChunk;
    }
  }
  
  // 保存最后一段
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * 调用feishu_doc工具（通过console.log JSON，由extract.mjs捕获）
 */
async function callFeishuDoc(action, params) {
  // 返回一个对象，由extract.mjs通过feishu_doc工具执行
  return {
    tool: 'feishu_doc',
    action: action,
    ...params
  };
}

/**
 * 保存到飞书（完整模式 + 智能分段）
 */
export async function saveToFeishu(result, url, localPath) {
  console.log('\n📄 准备保存到飞书文档...');
  
  try {
    // 1. 过滤Markdown
    const cleaned = sanitizeMarkdownForFeishu(result.content);
    console.log(`  ✓ Markdown已过滤`);
    
    // 2. 生成完整内容
    const fullContent = `# ${result.title || 'Untitled'}

**来源**: ${url}
**作者**: ${result.author || 'N/A'}
**发布时间**: ${result.published || 'N/A'}
**字数**: ${result.wordCount}
**语言**: ${result.language || 'N/A'}
**提取时间**: ${new Date().toISOString()}

---

## 描述
${result.description || 'N/A'}

---

${result.image ? `**缩略图**: ${result.image}\n\n---\n\n` : ''}

## 内容

${cleaned}

---

## 提取信息
- **解析时间**: ${result.parseTime}ms
- **提取器类型**: ${result.extractorType || 'default'}
- **本地文件**: \`${localPath}\`

---

*由Defuddle提取 | ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}*
`;

    // 3. 智能分段
    const chunkSize = config.feishu.chunkSize || 25000;
    const chunks = chunkContent(fullContent, chunkSize);
    
    console.log(`  ✓ 已分段: ${chunks.length}个段落 (每段≤${chunkSize}字符)`);
    
    // 4. 输出调用指令（由extract.mjs执行）
    const calls = [];
    
    // 第一段：创建文档
    calls.push({
      tool: 'feishu_doc',
      action: 'create',
      title: result.title || 'Untitled',
      content: chunks[0],
      folder_token: config.feishu.folder_token
    });
    
    // 后续段落：追加
    for (let i = 1; i < chunks.length; i++) {
      calls.push({
        tool: 'feishu_doc',
        action: 'append',
        doc_token: '{{DOC_TOKEN}}',  // 由extract.mjs替换
        content: chunks[i]
      });
    }
    
    // 输出JSON指令
    console.log('\n--- FEISHU_CALLS ---');
    console.log(JSON.stringify(calls, null, 2));
    console.log('--- END_FEISHU_CALLS ---\n');
    
    return {
      success: true,
      chunks: chunks.length,
      calls: calls
    };
    
  } catch (error) {
    console.error('❌ 飞书保存失败:', error.message);
    throw error;
  }
}

// CLI测试
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const testResult = {
    title: 'Test Document',
    content: '# Test\n\nThis is a test content with some text.\n\n## Section 2\n\nMore content here.',
    author: 'Test Author',
    published: '2026-03-14',
    wordCount: 100,
    parseTime: 50,
    extractorType: 'test'
  };
  
  await saveToFeishu(testResult, 'https://example.com', '/tmp/test.md');
}
