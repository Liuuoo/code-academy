#!/usr/bin/env node
/**
 * server.mjs — 本地上传后台（零外部依赖，Node 内置 http）。
 *
 * 功能：拖 .md/.pdf/.html 上传 → 填标题、选板块/系列/子分类 → 转换落位 → 可一键重建。
 * 安全：单密码登录（环境变量 ADMIN_PASSWORD），仅监听本地回环地址，不对公网开放。
 *
 * 启动：
 *   ADMIN_PASSWORD=你的密码 node admin/server.mjs
 *   然后浏览器打开 http://127.0.0.1:4321
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  slugify,
  transformMarkdown,
  makeImageCopier,
} from '../scripts/lib/convert.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const docsRoot = path.join(repoRoot, 'docs')
const imagesDir = path.join(docsRoot, 'public', 'images')
const pdfDir = path.join(docsRoot, 'public', 'pdf')
const demosDir = path.join(docsRoot, 'public', 'demos')

const SECTIONS = {
  notes: '课程笔记',
  solutions: '题解分享',
  research: '个人随笔',
}

const PORT = process.env.ADMIN_PORT || 4321
const HOST = '127.0.0.1' // 仅本地回环，公网访问需经反代/隧道
const PASSWORD = process.env.ADMIN_PASSWORD || ''
if (!PASSWORD) {
  console.error('✖ 必须设置环境变量 ADMIN_PASSWORD 再启动后台。')
  console.error('  例: ADMIN_PASSWORD=mypass node admin/server.mjs')
  process.exit(1)
}

// 简单会话：内存里存 token，重启即失效
const sessions = new Set()
function newToken() {
  const t = crypto.randomBytes(24).toString('hex')
  sessions.add(t)
  return t
}
function parseCookies(req) {
  const out = {}
  const raw = req.headers.cookie || ''
  for (const part of raw.split(';')) {
    const [k, v] = part.trim().split('=')
    if (k) out[k] = decodeURIComponent(v || '')
  }
  return out
}
function isAuthed(req) {
  const c = parseCookies(req)
  return c.session && sessions.has(c.session)
}

// 列出某板块下的文件夹树（供前端下拉选择系列/子分类）
function listDirs(absDir, rel = '') {
  if (!fs.existsSync(absDir)) return []
  return fs
    .readdirSync(absDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const childRel = rel ? `${rel}/${e.name}` : e.name
      return {
        name: e.name,
        path: childRel,
        children: listDirs(path.join(absDir, e.name), childRel),
      }
    })
}
function buildTree() {
  const tree = {}
  for (const s of Object.keys(SECTIONS)) {
    tree[s] = { label: SECTIONS[s], dirs: listDirs(path.join(docsRoot, s)) }
  }
  return tree
}

// 读取整个请求体为 Buffer
function readBody(req, limit = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// 极简 multipart/form-data 解析：返回 { fields:{}, files:[{name,filename,data}] }
function parseMultipart(buffer, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType || '')
  if (!m) return { fields: {}, files: [] }
  const boundary = '--' + (m[1] || m[2])
  const fields = {}
  const files = []

  let start = buffer.indexOf(boundary)
  if (start < 0) return { fields, files }
  start += boundary.length

  while (start < buffer.length) {
    if (buffer[start] === 0x2d && buffer[start + 1] === 0x2d) break // 结尾 --
    if (buffer[start] === 0x0d) start += 2 // 跳过 CRLF
    const headerEnd = buffer.indexOf('\r\n\r\n', start)
    if (headerEnd < 0) break
    const header = buffer.slice(start, headerEnd).toString('utf-8')
    const bodyStart = headerEnd + 4
    const next = buffer.indexOf(boundary, bodyStart)
    if (next < 0) break
    const bodyEnd = next - 2 // 去掉 part 末尾 CRLF
    const data = buffer.slice(bodyStart, bodyEnd)

    const nameM = /name="([^"]*)"/.exec(header)
    const fileM = /filename="([^"]*)"/.exec(header)
    const name = nameM ? nameM[1] : ''
    if (fileM && fileM[1]) {
      files.push({ name, filename: fileM[1], data })
    } else {
      fields[name] = data.toString('utf-8')
    }
    start = next + boundary.length
  }
  return { fields, files }
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers })
  res.end(body)
}
function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
}

// 安全地把相对分类路径解析为 docs 下的绝对路径，禁止越界
function resolveTarget(section, subPath) {
  if (!SECTIONS[section]) throw new Error('未知板块')
  const base = path.join(docsRoot, section)
  const clean = (subPath || '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/[\\/:*?"<>|]/g, '')) // 防路径注入
  const abs = path.join(base, ...clean)
  if (!abs.startsWith(base)) throw new Error('非法路径')
  return abs
}

// 列出某板块/栏/框下的文章（.md，不含 index.md）
function listDocs(section, subPath) {
  const dir = resolveTarget(section, subPath || '')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== 'index.md')
    .map((e) => ({ name: e.name, title: e.name.replace(/\.md$/, '') }))
}

// 删除一篇文章；若所在文件夹随之变空（仅剩 _meta.json/无内容），一并清理空框
function deleteDoc(section, subPath, fileName) {
  if (!fileName || !fileName.endsWith('.md') || fileName.includes('/') || fileName.includes('..')) {
    throw new Error('非法文件名')
  }
  if (fileName === 'index.md') throw new Error('板块入口页不可删除')
  if (!subPath || !subPath.trim()) throw new Error('不能删除板块根目录文件')
  const dir = resolveTarget(section, subPath || '')
  const target = path.join(dir, fileName)
  if (!target.startsWith(dir) || !fs.existsSync(target)) throw new Error('文件不存在')
  fs.unlinkSync(target)

  // 清理空框：若该目录下已无任何 .md（index.md 除外），删掉 _meta.json 和空目录
  const remaining = fs.readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'index.md')
  let removedDir = false
  if (remaining.length === 0 && dir !== resolveTarget(section, '')) {
    const leftover = fs.readdirSync(dir)
    // 只剩 _meta.json 或全空才删，避免误删含子目录的栏
    if (leftover.every((n) => n === '_meta.json')) {
      for (const n of leftover) fs.unlinkSync(path.join(dir, n))
      try { fs.rmdirSync(dir); removedDir = true } catch {}
    }
  }
  return { deleted: path.relative(repoRoot, target), removedDir }
}

// 处理一次上传：转换并落位，返回结果
function handleUpload(fields, files) {
  const { section, subPath = '', title: titleField = '', groupDesc = '', groupTag = '', groupTagType = 'default', metaTarget = '' } = fields
  const file = files.find((f) => f.name === 'file')
  if (!file) throw new Error('没有收到文件')

  // subPath 已是「栏/框」完整相对路径（前端拼好），逐段 slugify 防注入
  const safeSub = subPath
    .split('/')
    .map((s) => slugify(s.trim()))
    .filter(Boolean)
    .join('/')
  const targetDir = resolveTarget(section, safeSub)
  fs.mkdirSync(targetDir, { recursive: true })

  const ext = path.extname(file.filename).toLowerCase()
  const baseName = path.basename(file.filename, ext)

  // 非 md：pdf/html/图片直接落到 public 并给出引用提示
  if (ext === '.pdf') {
    fs.mkdirSync(pdfDir, { recursive: true })
    const dest = `${slugify(baseName)}${ext}`
    fs.writeFileSync(path.join(pdfDir, dest), file.data)
    return { type: 'pdf', ref: `/pdf/${dest}`, message: `PDF 已上传，可在 md 中引用 /pdf/${dest}` }
  }
  if (ext === '.html' || ext === '.htm') {
    fs.mkdirSync(demosDir, { recursive: true })
    const dest = `${slugify(baseName)}.html`
    fs.writeFileSync(path.join(demosDir, dest), file.data)
    return { type: 'html', ref: `/demos/${dest}`, message: `演示页已上传，可 iframe 引用 /demos/${dest}` }
  }

  // md：转换落位
  const raw = file.data.toString('utf-8')
  const { body, title, missingImages } = transformMarkdown(raw, {
    title: titleField.trim() || undefined,
    baseName,
    resolveImage: () => null, // 后台无法访问 vault，图片需单独上传后手动引用
    copyImage: makeImageCopier(imagesDir),
  })
  const outPath = path.join(targetDir, `${slugify(title)}.md`)
  fs.writeFileSync(outPath, body, 'utf-8')

  // 新建框时给该框写 _meta.json（描述/标签）
  if (metaTarget && (groupDesc || groupTag)) {
    const meta = {}
    if (groupDesc) meta.description = groupDesc
    if (groupTag) { meta.tag = groupTag; meta.tagType = groupTagType }
    fs.writeFileSync(path.join(targetDir, '_meta.json'), JSON.stringify(meta, null, 2))
  }

  return {
    type: 'md',
    path: path.relative(repoRoot, outPath),
    title,
    missingImages,
    message: missingImages.length
      ? `已发布，但有 ${missingImages.length} 张图缺失（需单独上传图片并改引用）`
      : '已发布',
  }
}

// 触发重建
let building = false
let lastBuildLog = ''
// 发布上线：跑 deploy.sh（本地构建 + 同步到服务器 + 重启容器），一步到位
function runBuild() {
  if (building) return { ok: false, message: '正在发布中…' }
  building = true
  lastBuildLog = ''
  const child = spawn('bash', ['deploy/deploy.sh'], { cwd: repoRoot })
  child.stdout.on('data', (d) => (lastBuildLog += d))
  child.stderr.on('data', (d) => (lastBuildLog += d))
  child.on('close', (code) => {
    building = false
    lastBuildLog += `\n[发布结束，退出码 ${code}${code === 0 ? '：已上线 https://note.liuooo.com' : '：失败，查看日志'}]`
  })
  return { ok: true, message: '发布已开始，约 10-30 秒后上线，可点"查看构建"看进度' }
}

// ---------- 页面 ----------
const loginPage = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>后台登录</title>
<style>
  body{font-family:-apple-system,"PingFang SC",sans-serif;background:#fbfaf8;display:flex;
    align-items:center;justify-content:center;min-height:100vh;margin:0;color:#2c2c2c}
  .box{background:#fff;border:1px solid #e8e4dd;border-radius:12px;padding:2rem;width:300px}
  h1{font-size:1.1rem;margin:0 0 1.2rem}
  input{width:100%;box-sizing:border-box;padding:.6rem .7rem;border:1px solid #ddd;
    border-radius:6px;font-size:1rem;margin-bottom:.8rem}
  button{width:100%;padding:.6rem;border:0;border-radius:6px;background:#3a5a8c;color:#fff;
    font-size:1rem;cursor:pointer}
  .err{color:#b4593a;font-size:.85rem;min-height:1.2em;margin-bottom:.5rem}
</style></head><body>
<form class="box" method="POST" action="/login">
  <h1>Code Academy 后台</h1>
  <div class="err">{{ERR}}</div>
  <input type="password" name="password" placeholder="管理密码" autofocus>
  <button type="submit">登录</button>
</form></body></html>`

const uploadHtml = fs.readFileSync(path.join(__dirname, 'upload.html'), 'utf-8')
const uploadJs = fs.readFileSync(path.join(__dirname, 'upload.js'), 'utf-8')

// ---------- 路由 ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const p = url.pathname

  try {
    // 登录
    if (p === '/login' && req.method === 'POST') {
      const body = (await readBody(req)).toString('utf-8')
      const pw = new URLSearchParams(body).get('password') || ''
      if (pw === PASSWORD) {
        const token = newToken()
        return send(res, 302, '', {
          'Set-Cookie': `session=${token}; HttpOnly; Path=/; SameSite=Strict`,
          Location: '/',
        })
      }
      return send(res, 401, loginPage.replace('{{ERR}}', '密码错误'))
    }
    if (p === '/logout') {
      const c = parseCookies(req)
      sessions.delete(c.session)
      return send(res, 302, '', { 'Set-Cookie': 'session=; Path=/; Max-Age=0', Location: '/' })
    }

    // 未登录一律回登录页
    if (!isAuthed(req)) {
      if (p === '/' || p === '/login') return send(res, 200, loginPage.replace('{{ERR}}', ''))
      return send(res, 302, '', { Location: '/' })
    }

    // 已登录
    if (p === '/' && req.method === 'GET') return send(res, 200, uploadHtml)
    if (p === '/upload.js') return send(res, 200, uploadJs, { 'Content-Type': 'application/javascript; charset=utf-8' })
    if (p === '/api/tree') return sendJson(res, 200, buildTree())

    if (p === '/api/upload' && req.method === 'POST') {
      const buf = await readBody(req)
      const { fields, files } = parseMultipart(buf, req.headers['content-type'])
      try {
        const result = handleUpload(fields, files)
        return sendJson(res, 200, result)
      } catch (e) {
        return sendJson(res, 400, { error: e.message })
      }
    }

    if (p === '/api/build' && req.method === 'POST') {
      return sendJson(res, 200, runBuild())
    }

    // 列出某板块/栏/框下的文章
    if (p === '/api/list' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf-8') || '{}')
      try {
        return sendJson(res, 200, { docs: listDocs(body.section, body.subPath) })
      } catch (e) {
        return sendJson(res, 400, { error: e.message })
      }
    }
    // 删除一篇文章（空框随之清理；三大类板块受 resolveTarget 保护，无法删）
    if (p === '/api/delete' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf-8') || '{}')
      try {
        return sendJson(res, 200, deleteDoc(body.section, body.subPath, body.file))
      } catch (e) {
        return sendJson(res, 400, { error: e.message })
      }
    }
    if (p === '/build-status') {
      return send(res, 200, `<pre style="padding:1.5rem;font-size:.85rem;white-space:pre-wrap">${
        (building ? '构建中…\n\n' : '') + (lastBuildLog || '（暂无构建日志）')
      }</pre><p style="padding:0 1.5rem"><a href="/">← 返回</a></p>`)
    }

    return send(res, 404, 'Not Found')
  } catch (e) {
    return send(res, 500, '服务器错误：' + e.message)
  }
})

server.listen(PORT, HOST, () => {
  console.log(`✓ 上传后台运行中： http://${HOST}:${PORT}`)
  console.log(`  （仅本地回环；远程使用请走 SSH 隧道或 Cloudflare Access）`)
})
