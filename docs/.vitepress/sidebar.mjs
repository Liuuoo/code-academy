import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const docsRoot = path.resolve(__dirname, '..')

// 从 md 提取展示标题：frontmatter title > 首个 # > 文件名
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

// 读取文件夹可选元数据 _meta.json: { description, tag, tagType, order }
function metaOf(dir) {
  const p = path.join(dir, '_meta.json')
  if (fs.existsSync(p)) {
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch {}
  }
  return {}
}

// 构建“富目录树”：节点带 description/tag 等元数据，供首页索引用
function buildCatalog(absDir, urlBase) {
  if (!fs.existsSync(absDir)) return []
  const entries = fs.readdirSync(absDir, { withFileTypes: true })

  const dirs = entries.filter((e) => e.isDirectory())
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'index.md')

  // 排序：先按 _meta.order（仅目录），再按名称
  const dirNodes = dirs
    .map((d) => {
      const sub = path.join(absDir, d.name)
      const m = metaOf(sub)
      return {
        type: 'group',
        text: m.title || d.name,
        description: m.description || '',
        tag: m.tag || '',
        tagType: m.tagType || 'default',
        order: typeof m.order === 'number' ? m.order : 999,
        items: buildCatalog(sub, `${urlBase}${d.name}/`),
      }
    })
    .filter((n) => n.items.length)
    .sort((a, b) => a.order - b.order || a.text.localeCompare(b.text, 'zh'))

  const fileNodes = files
    .map((f) => {
      const name = f.name.replace(/\.md$/, '')
      return {
        type: 'doc',
        text: titleOf(path.join(absDir, f.name), name),
        link: `${urlBase}${name}`,
      }
    })
    .sort((a, b) => a.text.localeCompare(b.text, 'zh'))

  return [...dirNodes, ...fileNodes]
}

// 由富目录树派生 VitePress 左侧 sidebar（去掉元数据字段）
function toSidebar(nodes) {
  return nodes.map((n) =>
    n.type === 'group'
      ? { text: n.text, collapsed: false, items: toSidebar(n.items) }
      : { text: n.text, link: n.link }
  )
}

const sections = ['notes', 'solutions', 'research']

// 板块展示元数据（顺序即页面呈现顺序）
const sectionMeta = {
  notes: { title: '课程笔记', desc: '按班级与课程系列整理的日常教学笔记' },
  solutions: { title: '题解分享', desc: '竞赛与练习题目的解析，按赛事系列分组' },
  research: { title: '个人随笔', desc: '学习、研究与日常思考的记录' },
}

export const catalog = {}
export const sidebar = {}
for (const s of sections) {
  const tree = buildCatalog(path.join(docsRoot, s), `/${s}/`)
  catalog[`/${s}/`] = tree
  sidebar[`/${s}/`] = toSidebar(tree)
}

// 单页知识库用：按板块聚合的完整数据
export const library = sections.map((s) => ({
  id: s,
  title: sectionMeta[s].title,
  desc: sectionMeta[s].desc,
  groups: catalog[`/${s}/`],
}))

// 板块元数据（供独立页面 SectionView 读取标题/描述）
export const sectionInfo = sectionMeta

