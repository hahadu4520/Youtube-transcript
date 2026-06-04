#!/usr/bin/env node

import { parseHTML } from 'linkedom';
import { Defuddle } from 'defuddle/node';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { ProxyAgent, setGlobalDispatcher, Agent } from 'undici';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 加载配置
const configPath = join(__dirname, 'config.json');
const config = JSON.parse(readFileSync(configPath, 'utf-8'));

// CLI参数解析
const args = process.argv.slice(2);
const url = args[0];

if (!url || url.startsWith('--')) {
  console.error('Usage: node extract.mjs <url> [options]');
  console.error('');
  console.error('Options:');
  console.error('  --proxy           Enable proxy');
  console.error('  --no-async        Disable async extractors');
  console.error('  --output <path>   Output file path');
  console.error('  --feishu          Save to Feishu document');
  console.error('  --feishu-folder <token>  Feishu folder token');
  console.error('  --json-only       Output JSON only');
  console.error('  --no-markdown     Disable Markdown conversion');
  console.error('  --open            Auto-open result file');
  console.error('  --debug           Enable debug mode');
  console.error('  --translate       Translate English to Chinese');
  process.exit(1);
}

// 解析参数
const options = {
  proxy: args.includes('--proxy') || config.proxy.enabled,
  useAsync: !args.includes('--no-async') && config.defuddle.useAsync,
  markdown: !args.includes('--no-markdown') && config.defuddle.markdown,
  debug: args.includes('--debug') || config.defuddle.debug,
  jsonOnly: args.includes('--json-only'),
  autoOpen: args.includes('--open') || config.output.autoOpen,
  feishu: args.includes('--feishu') || config.feishu.enabled,
  translate: args.includes('--translate') || config.translation.enabled,
  feishuFolder: null,
  output: null,
};

// 解析输出路径
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1 && args[outputIndex + 1]) {
  options.output = args[outputIndex + 1];
}

// 解析飞书文件夹
const feishuFolderIndex = args.indexOf('--feishu-folder');
if (feishuFolderIndex !== -1 && args[feishuFolderIndex + 1]) {
  options.feishuFolder = args[feishuFolderIndex + 1];
} else {
  options.feishuFolder = config.feishu.folder_token;
}

// 配置代理（仅用于Defuddle）
let proxyAgent = null;
if (options.proxy) {
  const proxyUrl = config.proxy.http;
  proxyAgent = new ProxyAgent(proxyUrl);
  setGlobalDispatcher(proxyAgent);
  console.log(`🌐 代理已启用: ${proxyUrl}`);
}

// 清除代理的函数
function clearProxy() {
  if (proxyAgent) {
    const defaultAgent = new Agent();  // 创建默认Agent
    setGlobalDispatcher(defaultAgent);  // 恢复默认dispatcher
    console.log('🔓 代理已清除（飞书API不需要代理）');
  }
}

// ============ 翻译工具函数 ============

async function translateToChineseWithClaude(text) {
  try {
    // 使用 OpenClaw 的 Claude API
    // 这里假设环境变量中有 ANTHROPIC_API_KEY
    const apiKey = config.translation.apiKey || process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️  未配置Claude API Key，跳过翻译');
      return null;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.translation.model || 'claude-sonnet-4',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `请将以下英文内容翻译成中文。保持原文的格式和结构，包括换行、加粗、链接等Markdown格式。只输出翻译结果，不要添加任何解释或评论。

${text}`
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API错误: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
    
  } catch (error) {
    console.error('翻译失败:', error.message);
    return null;
  }
}

async function translateContent(content, language, enableTranslation = true) {
  // 检查是否需要翻译
  if (!enableTranslation) return content;
  
  const shouldTranslate = config.translation.autoDetect && 
    config.translation.sourceLanguages.includes(language);
  
  if (!shouldTranslate) {
    console.log(`ℹ️  语言为 ${language}，跳过翻译`);
    return content;
  }

  console.log('\n🌐 开始翻译到中文...');
  
  // 分段翻译（按段落）
  const paragraphs = content.split(/\n\n+/);
  const maxChunkSize = config.translation.maxChunkSize || 3000;
  let translatedContent = '';
  let processedCount = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();
    if (!para) continue;

    // 跳过代码块和特殊格式
    if (para.startsWith('```') || para.startsWith('---') || para.startsWith('|')) {
      translatedContent += para + '\n\n';
      continue;
    }

    // 分批翻译（避免超过API限制）
    if (para.length > maxChunkSize) {
      // 超长段落，按句子分割
      const sentences = para.split(/(?<=[.!?])\s+/);
      let batch = '';
      
      for (const sentence of sentences) {
        if (batch.length + sentence.length > maxChunkSize && batch) {
          const translation = await translateToChineseWithClaude(batch);
          if (translation) {
            translatedContent += `${batch}\n\n> **中文翻译**：\n> ${translation}\n\n`;
          } else {
            translatedContent += batch + '\n\n';
          }
          batch = sentence;
          processedCount++;
        } else {
          batch += (batch ? ' ' : '') + sentence;
        }
      }
      
      if (batch) {
        const translation = await translateToChineseWithClaude(batch);
        if (translation) {
          translatedContent += `${batch}\n\n> **中文翻译**：\n> ${translation}\n\n`;
        } else {
          translatedContent += batch + '\n\n';
        }
        processedCount++;
      }
      
    } else {
      // 正常段落，直接翻译
      const translation = await translateToChineseWithClaude(para);
      if (translation) {
        translatedContent += `${para}\n\n> **中文翻译**：\n> ${translation}\n\n`;
      } else {
        translatedContent += para + '\n\n';
      }
      processedCount++;
    }

    // 进度提示
    if ((i + 1) % 10 === 0 || i === paragraphs.length - 1) {
      console.log(`  📝 已翻译: ${processedCount}/${paragraphs.length} 段落`);
    }
  }

  console.log('✅ 翻译完成！\n');
  return translatedContent.trim();
}

// ============ 飞书工具函数 ============

function sanitizeMarkdownForFeishu(markdown) {
  let cleaned = markdown;
  
  // 移除Markdown表格
  cleaned = cleaned.replace(/\|[^\n]+\|\n(\|[-:\s]+\|)+\n(\|[^\n]+\|\n)*/g, 
    '\n> **表格内容**（飞书不支持Markdown表格，请查看本地文件）\n\n');
  
  // 转换图片为文本链接
  cleaned = cleaned.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, 
    '**图片**: $2');
  
  // ⚠️ 修复飞书LaTeX解析问题：$ → ＄（全角）
  // 飞书将 $...$ 识别为数学公式，导致内容丢失
  cleaned = cleaned.replace(/\$/g, '＄');
  
  return cleaned;
}

function chunkContent(markdown, maxSize = 25000) {
  const chunks = [];
  let currentChunk = '';
  const lines = markdown.split('\n');
  
  for (const line of lines) {
    const potentialChunk = currentChunk + line + '\n';
    if (potentialChunk.length > maxSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = line + '\n';
    } else {
      currentChunk = potentialChunk;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

function generateFeishuContent(result, url, localPath) {
  const contentToUse = result.translatedContent || result.content;
  const cleaned = sanitizeMarkdownForFeishu(contentToUse);
  const translationNote = result.translatedContent ? 
    '\n\n> ℹ️ **本文档包含中英双语翻译**。每个英文段落后跟随中文翻译。\n' : '';
  
  return `# ${result.title || 'Untitled'}

> ⚠️ **AI自动提取草稿** - 内容未经人工审核，仅供参考。价格符号已转换为全角（＄）以避免显示问题。
${translationNote}

**来源**: ${url}
**作者**: ${result.author || 'N/A'}
**发布时间**: ${result.published || 'N/A'}
**字数**: ${result.wordCount}
**语言**: ${result.language || 'N/A'}
${result.translatedContent ? '**翻译**: 已启用（英文 → 中文）' : ''}
**提取时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

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

*由Defuddle提取*
`;
}

// ============ 主函数 ============

async function extract() {
  console.log(`\n⏳ 开始提取: ${url}`);
  
  try {
    // 1. 获取HTML
    console.log('📥 获取HTML...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.http.timeout || 30000);
    const response = await fetch(url, {
      headers: {
        'user-agent': config.http.userAgent,
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP请求失败: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    if (!html || html.length < 100) {
      throw new Error('HTML内容为空或过短');
    }

    // 2. Defuddle解析
    console.log('🔍 Defuddle解析...');
    const { document, window } = parseHTML(html);
    if (!window.getComputedStyle) {
      window.getComputedStyle = () => ({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        getPropertyValue: () => '',
      });
    }

    const result = await Defuddle(document, url, {
      markdown: options.markdown,
      debug: options.debug,
      useAsync: options.useAsync,
      removeImages: config.defuddle.removeImages,
      removeSmallImages: config.defuddle.removeSmallImages,
      removeHiddenElements: config.defuddle.removeHiddenElements,
      removeLowScoring: config.defuddle.removeLowScoring,
      standardize: config.defuddle.standardize,
    });

    // 3. 输出结果
    console.log('\n✅ 提取完成！');
    console.log(`📊 标题: ${result.title || 'N/A'}`);
    console.log(`👤 作者: ${result.author || 'N/A'}`);
    console.log(`📅 发布: ${result.published || 'N/A'}`);
    console.log(`📝 字数: ${result.wordCount}`);
    console.log(`⏱️  解析: ${result.parseTime}ms`);
    console.log(`🔧 提取器: ${result.extractorType || 'default'}`);

    if (result.content && result.content.length > 500) {
      console.log(`✅ 内容已提取: ${result.content.length} chars`);
    } else {
      console.log(`⚠️  内容较少: ${result.content?.length || 0} chars`);
    }

    // 4. JSON输出
    if (options.jsonOnly) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // 5. 翻译内容（如果启用）
    if (options.translate && result.content && result.language) {
      result.translatedContent = await translateContent(result.content, result.language, true);
    }

    // 6. 生成Markdown
    const markdown = generateMarkdown(result, url);

    // 7. 保存文件
    const outputPath = options.output || generateOutputPath(result);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, markdown, 'utf-8');
    console.log(`\n💾 已保存: ${outputPath}`);

    // 7. 保存JSON
    if (config.output.saveJson) {
      const jsonPath = outputPath.replace(/\.md$/, '.json');
      writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`📦 JSON: ${jsonPath}`);
    }

    // 7.5. 清除代理（飞书API不需要代理）
    clearProxy();

    // 8. 飞书保存
    if (options.feishu) {
      await saveToFeishu(result, url, outputPath);
    }

    // 9. 自动打开
    if (options.autoOpen) {
      execFile('open', [outputPath]);
      console.log('📂 已打开文件');
    }

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    if (options.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 保存到飞书
async function saveToFeishu(result, url, localPath) {
  console.log('\n📄 准备保存到飞书...');
  
  try {
    // 生成飞书内容
    const feishuContent = generateFeishuContent(result, url, localPath);
    
    // 智能分段
    const chunkSize = config.feishu.chunkSize || 25000;
    const chunks = chunkContent(feishuContent, chunkSize);
    
    console.log(`  ✓ 已分段: ${chunks.length}个段落 (每段≤${chunkSize}字符)`);
    
    // 输出飞书调用指令（Agent识别并执行）
    console.log('\n=== AGENT_TASK: FEISHU_SAVE ===');
    console.log(JSON.stringify({
      task: 'feishu_save',
      title: result.title || 'Untitled',
      chunks: chunks,
      folder_token: options.feishuFolder,
      metadata: {
        url: url,
        wordCount: result.wordCount,
        author: result.author,
        published: result.published,
        localPath: localPath
      }
    }, null, 2));
    console.log('=== END_AGENT_TASK ===\n');
    
    console.log('💡 提示: Agent将自动创建飞书文档并分段保存内容');
    
  } catch (error) {
    console.error('❌ 飞书保存准备失败:', error.message);
  }
}

// 生成Markdown
function generateMarkdown(result, url) {
  const contentSection = result.translatedContent || result.content || '(No content extracted)';
  const translationNote = result.translatedContent ? 
    '\n\n> ℹ️ **本文档包含中英双语翻译**。每个英文段落后跟随中文翻译。\n' : '';
  
  return `# ${result.title || 'Untitled'}

**URL**: ${url}
**Author**: ${result.author || 'N/A'}
**Published**: ${result.published || 'N/A'}
**Word Count**: ${result.wordCount}
**Extractor Type**: ${result.extractorType || 'default'}
**Site**: ${result.site || 'N/A'}
**Domain**: ${result.domain || 'N/A'}
**Language**: ${result.language || 'N/A'}
**Parse Time**: ${result.parseTime}ms
${result.translatedContent ? '**Translation**: Enabled (English → 中文)' : ''}

---

## Description
${result.description || 'N/A'}

---

${result.image ? `## Thumbnail\n![](${result.image})\n\n---\n\n` : ''}
${translationNote}

## Content
${contentSection}

---

## Debug Info
- **Content Selector**: \`${result.debug?.contentSelector || 'N/A'}\`
- **Removals**: ${result.debug?.removals?.length || 0} elements removed

${result.debug?.removals?.length > 0 ? `
### Sample Removals (first 5)
${result.debug.removals.slice(0, 5).map((r, i) => 
  `${i + 1}. **${r.step}** (${r.reason})
   - Selector: \`${r.selector}\`
   - Text: ${r.text?.substring(0, 100) || 'N/A'}...`
).join('\n\n')}
` : ''}

---

*Extracted with Defuddle on ${new Date().toISOString()}*
${options.proxy ? `*Via proxy: ${config.proxy.http}*` : ''}
`;
}

// 生成输出路径
function generateOutputPath(result) {
  const basePath = config.output.defaultPath.replace(/^~/, process.env.HOME);
  const timestamp = new Date().toISOString().split('T')[0];
  const safeTitle = (result.title || 'untitled')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  
  const filename = `${safeTitle}_${timestamp}.md`;
  return join(basePath, filename);
}

// 执行
extract();
