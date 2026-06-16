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
  console.error('  --proxy-url <url> Proxy URL for this run');
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
function readArgValue(flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function getEnvProxyUrl() {
  return process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    null;
}

function getProxyUrl() {
  return readArgValue('--proxy-url') ||
    getEnvProxyUrl() ||
    config.proxy.https ||
    config.proxy.http ||
    null;
}

const detectedProxyUrl = getProxyUrl();

const options = {
  proxy: args.includes('--proxy') || config.proxy.enabled || (config.proxy.autoDetectEnv !== false && Boolean(getEnvProxyUrl())),
  useAsync: !args.includes('--no-async') && config.defuddle.useAsync,
  markdown: !args.includes('--no-markdown') && config.defuddle.markdown,
  debug: args.includes('--debug') || config.defuddle.debug,
  jsonOnly: args.includes('--json-only'),
  autoOpen: args.includes('--open') || config.output.autoOpen,
  feishu: args.includes('--feishu') || config.feishu.enabled,
  translate: args.includes('--translate') || config.translation.enabled,
  feishuFolder: null,
  output: null,
  proxyUrl: detectedProxyUrl,
};

// 解析输出路径
const outputValue = readArgValue('--output');
if (outputValue) {
  options.output = outputValue;
}

// 解析飞书文件夹
const feishuFolderValue = readArgValue('--feishu-folder');
if (feishuFolderValue) {
  options.feishuFolder = feishuFolderValue;
} else {
  options.feishuFolder = config.feishu.folder_token;
}

// 配置代理（仅用于Defuddle）
let proxyAgent = null;
if (options.proxy) {
  const proxyUrl = options.proxyUrl;
  if (!proxyUrl) {
    console.error('❌ 代理已启用，但没有找到代理地址。请设置 HTTP_PROXY/HTTPS_PROXY，或使用 --proxy-url <url>。');
    process.exit(1);
  }
  if (/^socks/i.test(proxyUrl)) {
    console.error(`❌ 当前代理地址是 ${proxyUrl}，但此脚本的 undici ProxyAgent 需要 HTTP/HTTPS 代理。请改用 HTTP 代理，例如 http://127.0.0.1:7890。`);
    process.exit(1);
  }
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

// ============ 翻译交接工具函数 ============

function shouldTranslateWithAgent(language) {
  return config.translation.autoDetect &&
    config.translation.sourceLanguages.includes(language);
}

function emitAgentTranslationTask(result, url, sourcePath, outputPath) {
  console.log('\n=== AGENT_TASK: TRANSLATE_WITH_AGENT ===');
  console.log(JSON.stringify({
    task: 'translate_with_agent',
    mode: 'bilingual_markdown',
    title: result.title || 'Untitled',
    source_language: result.language || 'unknown',
    target_language: config.translation.targetLanguage || 'zh-CN',
    source_path: sourcePath,
    output_path: outputPath,
    instructions: [
      'Use the current agent model, not an external API.',
      'Read source_path and create output_path.',
      'Keep every English transcript paragraph in place.',
      'Insert the Chinese translation directly below the corresponding English paragraph.',
      'Use the marker: > **中文翻译**：',
      'Preserve timestamps, headings, metadata, and Markdown structure.'
    ],
    metadata: {
      url,
      wordCount: result.wordCount,
      author: result.author,
      published: result.published
    }
  }, null, 2));
  console.log('=== END_AGENT_TASK ===\n');
  console.log('💡 提示: Agent将使用当前会话模型生成中英对照稿，不调用外部翻译API。');
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

    // 5. 翻译由当前Agent处理。脚本只提取并输出交接任务，不调用外部模型API。
    const agentTranslationRequested = options.translate && result.content && result.language && shouldTranslateWithAgent(result.language);
    if (options.translate && !agentTranslationRequested) {
      console.log(`ℹ️  语言为 ${result.language || 'N/A'}，跳过翻译交接`);
    }

    // 6. 生成Markdown
    const markdown = generateMarkdown(result, url);

    // 7. 保存文件
    const outputPath = options.output || generateOutputPath(result);
    const sourcePath = agentTranslationRequested && outputPath.endsWith('.md')
      ? outputPath.replace(/\.md$/, '.source.md')
      : outputPath;
    mkdirSync(dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, markdown, 'utf-8');
    console.log(`\n💾 已保存: ${sourcePath}`);

    // 7. 保存JSON
    if (config.output.saveJson) {
      const jsonPath = sourcePath.replace(/\.md$/, '.json');
      writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`📦 JSON: ${jsonPath}`);
    }

    // 7.5. 清除代理（飞书API不需要代理）
    clearProxy();

    // 8. 飞书保存
    if (options.feishu) {
      await saveToFeishu(result, url, sourcePath);
    }

    // 8.5 Agent翻译交接
    if (agentTranslationRequested) {
      emitAgentTranslationTask(result, url, sourcePath, outputPath);
    }

    // 9. 自动打开
    if (options.autoOpen) {
      execFile('open', [sourcePath]);
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
