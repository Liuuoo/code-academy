/**
 * convert.mjs — Markdown 转换核心，CLI 与上传后台共用。
 * 纯函数 + 文件操作分离，便于复用与测试。
 */
import fs from 'node:fs'
import path from 'node:path'

// 文件名/标题 slug：保留中文，去掉对 URL 不友好的字符
export function slugify(s) {
  return s
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/[\\/:*?"<>|#]+/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim()
}

// VitePress 把 md 当 Vue 模板，正文 {{ }} 会被当插值导致构建失败。
// 围栏代码块原样保留；行内代码用零宽空格断开；普通文本转义为 HTML 实体。
export function escapeMustache(text) {
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g)
  return parts
    .map((seg, i) => {
      if (i % 2 === 1) {
        if (seg.startsWith('```')) return seg
        return seg.replace(/\{\{/g, '{​{').replace(/\}\}/g, '}​}')
      }
      return seg.replace(/\{\{/g, '&#123;&#123;').replace(/\}\}/g, '&#125;&#125;')
    })
    .join('')
}

// 把一段原始 md 文本转换为 VitePress 友好的内容。
// opts: { title, baseName, resolveImage(fname)->absPathOrNull, copyImage(absPath, baseName)->urlPath }
// 返回 { body, title, missingImages: [] }
export function transformMarkdown(rawInput, opts = {}) {
  const { title: titleArg, baseName = 'untitled', resolveImage, copyImage } = opts
  let raw = rawInput
  const missingImages = []

  // 1. Obsidian 图片 ![[name.png]] / ![[name.png|alt]]
  const embedRe = /!\[\[([^\]|]+?\.(?:png|jpe?g|gif|webp|svg))(\|[^\]]*)?\]\]/gi
  raw = raw.replace(embedRe, (_, fname, altPart) => {
    const alt = altPart ? altPart.slice(1).trim() : ''
    const found = resolveImage ? resolveImage(fname.trim()) : null
    if (!found) {
      missingImages.push(fname.trim())
      return `> （图片缺失，待补：${fname.trim()}）`
    }
    const urlPath = copyImage(found, baseName)
    return `![${alt}](${urlPath})`
  })

  // 2. 标题来源：参数 > 首个 # > 文件名
  const title = titleArg || raw.match(/^#\s+(.+)$/m)?.[1]?.trim() || baseName

  // 3. {{ }} 转义
  raw = escapeMustache(raw)

  // 4. frontmatter title
  let body = raw
  const hasFm = /^---\r?\n[\s\S]*?\r?\n---/.test(body)
  if (!hasFm) {
    body = `---\ntitle: ${title}\n---\n\n${body}`
  } else if (!/^title:/m.test(body)) {
    body = body.replace(/^---\r?\n/, `---\ntitle: ${title}\n`)
  }

  // 5. 确保正文有 # 一级标题
  const afterFm = body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, '')
  if (!/^#\s+/m.test(afterFm.split('\n').slice(0, 3).join('\n'))) {
    body = body.replace(/(^---\r?\n[\s\S]*?\r?\n---\r?\n)/, `$1\n# ${title}\n\n`)
  }

  return { body, title, missingImages }
}

// 在若干候选目录里查找图片（CLI 用：Obsidian 同目录/父级/vault 根递归）
export function makeFileImageResolver(srcDir) {
  return function resolveImage(fname) {
    const tries = [srcDir, path.resolve(srcDir, '..'), path.resolve(srcDir, '../..')]
    for (const d of tries) {
      const p = path.join(d, fname)
      if (fs.existsSync(p)) return p
    }
    const vroot = path.resolve(srcDir, '../..')
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
}

// 把图片复制到 docs/public/images 并返回站点内 URL
export function makeImageCopier(imagesDir) {
  fs.mkdirSync(imagesDir, { recursive: true })
  return function copyImage(absPath, baseName) {
    const ext = path.extname(absPath)
    const dest = `${slugify(baseName)}-${slugify(path.basename(absPath, ext))}${ext}`
    fs.copyFileSync(absPath, path.join(imagesDir, dest))
    return `/images/${dest}`
  }
}

// 写入 _meta.json（文件夹元数据），已存在则合并
export function writeMeta(dir, meta) {
  const p = path.join(dir, '_meta.json')
  let cur = {}
  if (fs.existsSync(p)) {
    try { cur = JSON.parse(fs.readFileSync(p, 'utf-8')) } catch {}
  }
  fs.writeFileSync(p, JSON.stringify({ ...cur, ...meta }, null, 2), 'utf-8')
}
