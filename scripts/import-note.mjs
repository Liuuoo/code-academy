#!/usr/bin/env node
/**
 * import-note.mjs — 把一篇 Obsidian md 转换并导入 VitePress 内容目录（命令行版）。
 * 转换逻辑见 scripts/lib/convert.mjs，与上传后台共用。
 *
 * 用法:
 *   node scripts/import-note.mjs <源md> <目标分类相对路径> [--title "展示标题"]
 * 例:
 *   node scripts/import-note.mjs "/path/方格覆盖.md" research/数据仓库 --title "方格覆盖题解"
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  slugify,
  transformMarkdown,
  makeFileImageResolver,
  makeImageCopier,
} from './lib/convert.mjs'

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

const srcDir = path.dirname(path.resolve(srcPath))
const baseName = path.basename(srcPath, '.md')
const raw = fs.readFileSync(srcPath, 'utf-8')

const { body, title, missingImages } = transformMarkdown(raw, {
  title: titleArg,
  baseName,
  resolveImage: makeFileImageResolver(srcDir),
  copyImage: makeImageCopier(imagesDir),
})

for (const m of missingImages) console.warn(`⚠ 找不到图片: ${m}（已留占位）`)

const targetDir = path.join(docsRoot, targetCat)
fs.mkdirSync(targetDir, { recursive: true })
const outPath = path.join(targetDir, `${slugify(title)}.md`)
fs.writeFileSync(outPath, body, 'utf-8')
console.log(`✓ 导入: ${path.relative(repoRoot, outPath)}`)
