#!/usr/bin/env node

import { parseHTML } from 'linkedom';
import { Defuddle } from 'defuddle/node';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';

const execAsync = promisify(exec);
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
  console.error('  --json-only       Output JSON only');
  console.error('  --no-markdown     Disable Markdown conversion');
  console.error('  --open            Auto-open result file');
  console.error('  --debug           Enable debug mode');
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
  output: null,
};

// 解析输出路径
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1 && args[outputIndex + 1]) {
  options.output = args[outputIndex + 1];
}

// 配置代理
if (options.proxy && config.proxy.enabled) {
  const proxyUrl = config.proxy.http;
  const proxyAgent = new ProxyAgent(proxyUrl);
  setGlobalDispatcher(proxyAgent);
  console.log(`🌐 代理已启用: ${proxyUrl}`);
}

// 主函数
async function extract() {
  console.log(`\n⏳ 开始提取: ${url}`);
  
  try {
    // 1. 获取HTML
    console.log('📥 获取HTML...');
    const { stdout: html } = await execAsync(
      `curl -sL -A "${config.http.userAgent}" "${url}"`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
    );

    if (!html || html.length < 100) {
      throw new Error('HTML内容为空或过短');
    }

    // 2. Defuddle解析
    console.log('🔍 Defuddle解析...');
    const { document } = parseHTML(html);
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

    // 5. 生成Markdown
    const markdown = generateMarkdown(result, url);

    // 6. 保存文件
    const outputPath = options.output || generateOutputPath(result);
    writeFileSync(outputPath, markdown, 'utf-8');
    console.log(`\n💾 已保存: ${outputPath}`);

    // 7. 保存JSON（可选）
    if (config.output.saveJson) {
      const jsonPath = outputPath.replace(/\.md$/, '.json');
      writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`📦 JSON: ${jsonPath}`);
    }

    // 8. 自动打开
    if (options.autoOpen) {
      exec(`open "${outputPath}"`);
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

// 生成Markdown
function generateMarkdown(result, url) {
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

---

## Description
${result.description || 'N/A'}

---

${result.image ? `## Thumbnail\n![](${result.image})\n\n---\n\n` : ''}

## Content
${result.content || '(No content extracted)'}

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
