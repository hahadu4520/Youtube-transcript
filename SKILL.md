---
name: youtube-transcript
description: Extract, archive, translate, and hand off YouTube transcripts with timestamps. Use when the user asks to transcribe a YouTube video, get a YouTube transcript, save a video transcript as Markdown/JSON, translate an English YouTube transcript to Chinese, or prepare transcript chunks for Feishu/Lark. The underlying extractor is Defuddle and it can also extract clean article content when needed.
metadata:
  short-description: Extract YouTube transcripts
---

# YouTube Transcript

Use this skill to extract YouTube transcripts with timestamps and save them as Markdown/JSON. It can also translate English transcripts to Chinese and prepare long transcript content for Feishu/Lark upload.

The implementation is powered by Defuddle, so it can still extract clean article/page content when that is useful, but the primary product-facing name and workflow is **YouTube Transcript**.

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

Use YouTube Transcript for:

- YouTube transcript extraction with timestamps.
- Markdown or JSON archives of video transcripts.
- Optional English-to-Chinese translation of extracted content.
- Preparing long extracted content for Feishu/Lark upload.
- Proxy-enabled extraction when direct YouTube fetch fails.
- Clean article/page extraction without navigation, sidebars, and ads, as a secondary capability.

Do not use this skill when the user only needs a brief web lookup, current fact, or summary without transcript extraction; use normal browsing/search in those cases.

## Quick Workflow

1. Set `SKILL_DIR=/Users/duu/.openclaw/skills/defuddle`.
2. Check dependencies only if needed: if `node_modules` is missing, run `npm install` in `SKILL_DIR`.
3. Choose an output path. In Codex, prefer a task-local path under the current workspace, or use `/Users/duu/Documents/Defuddle` for durable personal archives.
4. Run `extract.mjs` with the URL and appropriate flags.
5. Return the title, word count, and generated file path to the user.

## Common Commands

Extract a YouTube transcript:

```bash
node /Users/duu/.openclaw/skills/defuddle/extract.mjs "https://youtube.com/watch?v=..." --output /absolute/path/transcript.md
```

Use proxy when direct YouTube fetch fails or the user asks for proxy:

```bash
node /Users/duu/.openclaw/skills/defuddle/extract.mjs "https://youtube.com/watch?v=..." --proxy --output /absolute/path/transcript.md
```

Use a one-off proxy when the user provides a specific proxy address:

```bash
node /Users/duu/.openclaw/skills/defuddle/extract.mjs "https://youtube.com/watch?v=..." --proxy-url http://127.0.0.1:7890 --output /absolute/path/transcript.md
```

Extract and translate an English YouTube transcript to Chinese:

```bash
node /Users/duu/.openclaw/skills/defuddle/extract.mjs "https://youtube.com/watch?v=..." --translate --output /absolute/path/bilingual.md
```

With `--translate`, the script does not call an external model API. It saves `/absolute/path/bilingual.source.md` and emits `AGENT_TASK: TRANSLATE_WITH_AGENT`; the current agent must read the source file and create `/absolute/path/bilingual.md` with Chinese inserted below each English paragraph.

Output JSON only:

```bash
node /Users/duu/.openclaw/skills/defuddle/extract.mjs "https://youtube.com/watch?v=..." --json-only
```

Secondary capability: extract a clean webpage/article:

```bash
node /Users/duu/.openclaw/skills/defuddle/extract.mjs "https://example.com/article" --output /absolute/path/article.md
```

Translation requires an active agent session. The Node script cannot directly call the current agent model; it emits a handoff task for the agent to complete.

## CLI Options

- `--proxy`: use the proxy configured in `config.json`.
- `--proxy-url <url>`: use a specific HTTP/HTTPS proxy for this run.
- `--no-async`: disable async extractors. Avoid this for YouTube transcripts.
- `--output <path>`: write Markdown to a specific path.
- `--json-only`: print the Defuddle JSON result.
- `--no-markdown`: disable Markdown conversion.
- `--translate`: request current-agent translation. The script emits `AGENT_TASK: TRANSLATE_WITH_AGENT` instead of calling external APIs.
- `--feishu`: emit a structured Feishu save task to stdout.
- `--feishu-folder <token>`: set the target Feishu folder token for the emitted task.
- `--open`: open the result file after extraction.
- `--debug`: include extra extraction diagnostics.

## Agent Compatibility

### Codex

This skill is Codex-compatible when available at:

```bash
/Users/duu/.codex/skills/youtube-transcript
```

The legacy alias `/Users/duu/.codex/skills/defuddle` may also exist and can keep working.

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
/Users/duu/.claude/skills/youtube-transcript
```

The legacy alias `/Users/duu/.claude/skills/defuddle` may also exist and can keep working.

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

- `proxy.autoDetectEnv`: when true, automatically uses `HTTPS_PROXY` or `HTTP_PROXY` from the current environment.
- `proxy.http` / `proxy.https`: optional fallback proxy URLs. Leave them null for public/shared installs.
- `proxy.enabled`: global proxy toggle. Prefer environment variables, `--proxy-url`, or per-run `--proxy` unless the user wants proxy always on.
- `defuddle.useAsync`: must stay `true` for YouTube transcript extraction.
- `output.defaultPath`: default archive folder.
- `output.saveJson`: also writes raw JSON next to Markdown.
- `feishu.chunkSize`: chunk size for document handoff.
- `translation.provider`: defaults to `agent`; translation is completed by the current agent model.

## Troubleshooting

- `fetch failed` or timeout: retry with `--proxy`; if it still fails, the local proxy may not be running.
- Wrong proxy port: check `HTTP_PROXY` / `HTTPS_PROXY`, or pass `--proxy-url http://host:port`.
- SOCKS proxy: this script currently expects HTTP/HTTPS proxy URLs for `undici` ProxyAgent. Use the HTTP/Mixed proxy port from the user's proxy app.
- YouTube has metadata but no transcript: ensure `defuddle.useAsync` is `true` and do not pass `--no-async`.
- `Module not found`: run `npm install` in `/Users/duu/.openclaw/skills/defuddle`.
- Translation output missing: ensure the agent consumed the `AGENT_TASK: TRANSLATE_WITH_AGENT` payload and wrote `output_path`.
- Feishu/Lark upload fails: save the local Markdown first, then upload chunks manually with the available document tools.

## References

- `README.md`: short human-facing overview.
- `WORKFLOW.md`: original implementation notes and OpenClaw workflow.
- `feishu-integration.md`: Feishu/Lark chunking approach.
- `TRANSLATION_GUIDE.md`: translation behavior and configuration.
