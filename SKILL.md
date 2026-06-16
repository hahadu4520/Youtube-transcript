---
name: defuddle
description: Extract clean web content and YouTube transcripts with Defuddle. Use when the user asks to fetch, extract, transcribe, archive, or translate a webpage, article, or YouTube video, especially when YouTube transcript timestamps, proxy support, Markdown/JSON output, or Feishu/Lark handoff is needed.
metadata:
  short-description: Extract webpages and YouTube transcripts
---

# Defuddle

Use this skill to extract clean Markdown/JSON from webpages and YouTube videos. It is built around a local Node.js CLI and works from Codex, Claude Code, and OpenClaw when this folder is installed in the agent's skill directory.

## Location

Canonical folder:

```bash
/Users/duu/.openclaw/skills/defuddle
```

Main command:

```bash
node /Users/duu/.openclaw/skills/defuddle/extract.mjs "<url>" [options]
```

If the skill is symlinked into another agent's skill directory, still prefer the absolute command above so paths resolve consistently.

## When To Use

Use Defuddle for:

- YouTube transcript extraction with timestamps.
- Clean article/page extraction without navigation, sidebars, and ads.
- Markdown or JSON archives of web content.
- Proxy-enabled extraction when direct fetch fails.
- Optional English-to-Chinese translation of extracted content.
- Preparing long extracted content for Feishu/Lark upload.

Do not use this skill when the user only needs a brief web lookup or a current fact; use normal browsing/search in those cases.

## Quick Workflow

1. Set `SKILL_DIR=/Users/duu/.openclaw/skills/defuddle`.
2. Check dependencies only if needed: if `node_modules` is missing, run `npm install` in `SKILL_DIR`.
3. Choose an output path. In Codex, prefer a task-local path under the current workspace, or use `/Users/duu/Documents/Defuddle` for durable personal archives.
4. Run `extract.mjs` with the URL and appropriate flags.
5. Return the title, word count, and generated file path to the user.

## Common Commands

Extract a webpage:

```bash
node /Users/duu/.openclaw/skills/defuddle/extract.mjs "https://example.com/article" --output /absolute/path/result.md
```

Extract a YouTube transcript:

```bash
node /Users/duu/.openclaw/skills/defuddle/extract.mjs "https://youtube.com/watch?v=..." --output /absolute/path/transcript.md
```

Use proxy when direct YouTube/page fetch fails or the user asks for proxy:

```bash
node /Users/duu/.openclaw/skills/defuddle/extract.mjs "https://youtube.com/watch?v=..." --proxy --output /absolute/path/transcript.md
```

Output JSON only:

```bash
node /Users/duu/.openclaw/skills/defuddle/extract.mjs "https://example.com/article" --json-only
```

Extract and translate English content to Chinese:

```bash
node /Users/duu/.openclaw/skills/defuddle/extract.mjs "https://youtube.com/watch?v=..." --translate --output /absolute/path/bilingual.md
```

Translation requires `ANTHROPIC_API_KEY` or `translation.apiKey` in `config.json`.

## CLI Options

- `--proxy`: use the proxy configured in `config.json`.
- `--no-async`: disable async extractors. Avoid this for YouTube transcripts.
- `--output <path>`: write Markdown to a specific path.
- `--json-only`: print the Defuddle JSON result.
- `--no-markdown`: disable Markdown conversion.
- `--translate`: translate English extracted content to Chinese.
- `--feishu`: emit a structured Feishu save task to stdout.
- `--feishu-folder <token>`: set the target Feishu folder token for the emitted task.
- `--open`: open the result file after extraction.
- `--debug`: include extra extraction diagnostics.

## Agent Compatibility

### Codex

This skill is Codex-compatible when available at:

```bash
/Users/duu/.codex/skills/defuddle
```

For normal extraction, run the CLI directly and save outputs in the current workspace or `/Users/duu/Documents/Defuddle`.

For Feishu/Lark saving, `--feishu` only prepares content chunks. In Codex, parse the JSON between:

```text
=== AGENT_TASK: FEISHU_SAVE ===
=== END_AGENT_TASK ===
```

Then use the available Lark/Feishu document tools in the current environment to create the document and append chunks. Do not assume an OpenClaw-only `feishu_doc` tool exists.

### Claude Code

This skill is Claude Code-compatible when available at:

```bash
/Users/duu/.claude/skills/defuddle
```

Use the same CLI commands. Claude Code should treat `--feishu` as a handoff payload unless a matching Feishu MCP/tool is configured.

### OpenClaw

OpenClaw can use the original workflow. If `feishu_doc` is available, it may consume the `AGENT_TASK: FEISHU_SAVE` payload directly.

## Feishu/Lark Handoff

When the user asks to save to Feishu/Lark:

1. Run extraction with `--feishu`.
2. Capture stdout and parse the JSON payload.
3. Create a document using the first chunk.
4. Append remaining chunks in order.
5. Return the final document link plus the local Markdown path.

The CLI sanitizes Markdown for Feishu/Lark by removing unsupported tables, converting images to text links, and replacing `$` with full-width `＄` to avoid math rendering.

More detail is in `feishu-integration.md`.

## Configuration

Read or edit:

```bash
/Users/duu/.openclaw/skills/defuddle/config.json
```

Important fields:

- `proxy.http`: default proxy is usually `http://127.0.0.1:7890`.
- `proxy.enabled`: global proxy toggle. Prefer per-run `--proxy` unless the user wants proxy always on.
- `defuddle.useAsync`: must stay `true` for YouTube transcript extraction.
- `output.defaultPath`: default archive folder.
- `output.saveJson`: also writes raw JSON next to Markdown.
- `feishu.chunkSize`: chunk size for document handoff.
- `translation`: Claude API translation settings.

## Troubleshooting

- `fetch failed` or timeout: retry with `--proxy`; if it still fails, the local proxy may not be running.
- YouTube has metadata but no transcript: ensure `defuddle.useAsync` is `true` and do not pass `--no-async`.
- `Module not found`: run `npm install` in `/Users/duu/.openclaw/skills/defuddle`.
- Translation skipped: configure `ANTHROPIC_API_KEY` or `translation.apiKey`.
- Feishu/Lark upload fails: save the local Markdown first, then upload chunks manually with the available document tools.

## References

- `README.md`: short human-facing overview.
- `WORKFLOW.md`: original implementation notes and OpenClaw workflow.
- `feishu-integration.md`: Feishu/Lark chunking approach.
- `TRANSLATION_GUIDE.md`: translation behavior and configuration.
