import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const docsRoot = path.resolve(__dirname, '..')

// 从 md 文件首个 # 标题或 frontmatter title 提取展示名，回退到文件名
function titleOf(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (fm) {
      const t = fm[1].match(/^title:\s*(.+)$/m)
      if (t) return t[1].trim().replace(/^["']|["']$/g, '')
    }
    const h1 = raw.match(/^#\s+(.+)$/m)
    if (h1) return h1[1].trim()
  } catch {}
  return fallback
}

// 递归把一个目录构建成 VitePress sidebar 结构
function buildTree(absDir, urlBase) {
  if (!fs.existsSync(absDir)) return []
  const entries = fs.readdirSync(absDir, { withFileTypes: true })

  const dirs = entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'index.md')
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))

  const items = []

  for (const d of dirs) {
    const children = buildTree(path.join(absDir, d.name), `${urlBase}${d.name}/`)
    if (children.length) {
      items.push({ text: d.name, collapsed: false, items: children })
    }
  }

  for (const f of files) {
    const name = f.name.replace(/\.md$/, '')
    const abs = path.join(absDir, f.name)
    items.push({ text: titleOf(abs, name), link: `${urlBase}${name}` })
  }

  return items
}

export const sidebarNotes = buildTree(path.join(docsRoot, 'notes'), '/notes/')
export const sidebarSolutions = buildTree(path.join(docsRoot, 'solutions'), '/solutions/')
