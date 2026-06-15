#!/usr/bin/env node
/**
 * import-note.mjs — 把一篇 Obsidian md 转换并导入 VitePress 内容目录。
 * 这是“上传后台”的核心转换引擎（命令行版，后台会复用同一套逻辑）。
 *
 * 用法:
 *   node scripts/import-note.mjs <源md> <目标分类相对路径> [--title "展示标题"]
 * 例:
 *   node scripts/import-note.mjs "/path/方格覆盖.md" research/数据仓库 --title "方格覆盖题解"
 *
 * 做的事:
 *   1. Obsidian 图片 ![[name.png]] -> ![](/images/<slug>.png)，并把图片拷到 docs/public/images/
 *   2. 若无 frontmatter title，补上（来自 --title 或首个 # 标题或文件名）
 *   3. 若正文无 # 一级标题，按 title 补一个
 *   4. 文件名规范化（去空格/特殊符号）写入目标目录
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const docsRoot = path.join(repoRoot, 'docs')
const imagesDir = path.join(docsRoot, 'public', 'images')

function arg(flag) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const srcPath = process.argv[2]
const targetCat = process.argv[3]
const titleArg = arg('--title')

if (!srcPath || !targetCat) {
  console.error('用法: node scripts/import-note.mjs <源md> <目标分类> [--title "标题"]')
  process.exit(1)
}

// 文件名/标题 slug：保留中文，去掉对 URL 不友好的字符
function slugify(s) {
  return s
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/[\\/:*?"<>|#]+/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim()
}

const srcDir = path.dirname(path.resolve(srcPath))
const baseName = path.basename(srcPath, '.md')
let raw = fs.readFileSync(srcPath, 'utf-8')

// --- 1. 处理 Obsidian 图片 ![[name.png]] 和 ![[name.png|alt]] ---
fs.mkdirSync(imagesDir, { recursive: true })
const embedRe = /!\[\[([^\]|]+?\.(?:png|jpe?g|gif|webp|svg))(\|[^\]]*)?\]\]/gi
raw = raw.replace(embedRe, (_, fname, altPart) => {
  const alt = altPart ? altPart.slice(1).trim() : ''
  const found = findImage(srcDir, fname.trim())
  if (!found) {
    console.warn(`⚠ 找不到图片: ${fname}（保留占位，请手动补）`)
    return `![${alt || fname}](/images/MISSING-${slugify(fname)}.png)`
  }
  const ext = path.extname(found)
  const dest = `${slugify(baseName)}-${slugify(path.basename(found, ext))}${ext}`
  fs.copyFileSync(found, path.join(imagesDir, dest))
  return `![${alt}](/images/${dest})`
})

// 在源目录附近递归找图片（Obsidian 常把图片放 vault 根或附件目录）
function findImage(startDir, fname) {
  const tries = [startDir, path.resolve(startDir, '..'), path.resolve(startDir, '../..')]
  for (const d of tries) {
    const p = path.join(d, fname)
    if (fs.existsSync(p)) return p
  }
  // 兜底：在 vault 根递归找同名文件
  const vroot = path.resolve(startDir, '../..')
  let hit = null
  const walk = (dir) => {
    if (hit) return
    let entries = []
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (hit) return
      if (e.name.startsWith('.')) continue
      const fp = path.join(dir, e.name)
      if (e.isDirectory()) walk(fp)
      else if (e.name === fname) hit = fp
    }
  }
  walk(vroot)
  return hit
}

// --- 2 & 3. frontmatter title + 一级标题 ---
const title = titleArg || (raw.match(/^#\s+(.+)$/m)?.[1]?.trim()) || baseName

// VitePress 把 md 当 Vue 模板，正文里的 {{ }} 会被当插值导致构建失败。
// 按 围栏代码块 / 行内代码 分段：代码内原样保留，其余处的 {{ }} 转义。
// （行内代码里的 {{ 用零宽分隔避免被当插值，又不影响显示）
function escapeMustache(text) {
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g)
  return parts
    .map((seg, i) => {
      if (i % 2 === 1) {
        // 代码段：行内代码用零宽空格断开 {{，围栏块原样
        if (seg.startsWith('```')) return seg
        return seg.replace(/\{\{/g, '{​{').replace(/\}\}/g, '}​}')
      }
      // 普通文本：转义为 HTML 实体
      return seg.replace(/\{\{/g, '&#123;&#123;').replace(/\}\}/g, '&#125;&#125;')
    })
    .join('')
}
raw = escapeMustache(raw)

let body = raw
const hasFm = /^---\r?\n[\s\S]*?\r?\n---/.test(body)
if (!hasFm) {
  body = `---\ntitle: ${title}\n---\n\n${body}`
} else if (!/^title:/m.test(body)) {
  body = body.replace(/^---\r?\n/, `---\ntitle: ${title}\n`)
}
// 确保正文有 # 一级标题（在 frontmatter 之后）
const afterFm = body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, '')
if (!/^#\s+/m.test(afterFm.split('\n').slice(0, 3).join('\n'))) {
  body = body.replace(/(^---\r?\n[\s\S]*?\r?\n---\r?\n)/, `$1\n# ${title}\n\n`)
}

// --- 4. 写入目标目录 ---
const targetDir = path.join(docsRoot, targetCat)
fs.mkdirSync(targetDir, { recursive: true })
const outName = `${slugify(title)}.md`
const outPath = path.join(targetDir, outName)
fs.writeFileSync(outPath, body, 'utf-8')
console.log(`✓ 导入: ${path.relative(repoRoot, outPath)}`)
