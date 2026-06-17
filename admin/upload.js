// upload.js — 上传后台前端逻辑（四层：板块→栏→框→文章）
const $ = (id) => document.getElementById(id)
const drop = $('drop'), fileInput = $('fileInput'), fileName = $('fileName')
const sectionSel = $('section'), colSel = $('col'), boxSel = $('box')
const newColInput = $('newCol'), newBoxInput = $('newBox'), msg = $('msg')
const NEW = '__new__'
let tree = {}

// 拖拽
drop.addEventListener('click', () => fileInput.click())
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over') })
drop.addEventListener('dragleave', () => drop.classList.remove('over'))
drop.addEventListener('drop', (e) => {
  e.preventDefault(); drop.classList.remove('over')
  if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; showFile() }
})
fileInput.addEventListener('change', showFile)
function showFile() {
  const f = fileInput.files[0]
  fileName.textContent = f ? '已选择：' + f.name : ''
  if (f && !$('title').value) $('title').value = f.name.replace(/\.[^.]+$/, '')
}

// 加载板块树
fetch('/api/tree').then(r => r.json()).then(t => {
  tree = t
  sectionSel.innerHTML = Object.entries(t).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')
  renderCols()
})

sectionSel.addEventListener('change', renderCols)
colSel.addEventListener('change', () => { toggleNewCol(); renderBoxes() })
boxSel.addEventListener('change', toggleNewBox)

// 栏下拉：列出当前板块的二级文件夹 + “新建栏”
function renderCols() {
  const sec = tree[sectionSel.value]
  const opts = (sec.dirs || []).map(d => `<option value="${d.name}">${d.name}</option>`)
  opts.push(`<option value="${NEW}">+ 新建栏…</option>`)
  colSel.innerHTML = opts.join('')
  toggleNewCol()
  renderBoxes()
}
// 框下拉：列出当前栏的三级文件夹 + “新建框”
function renderBoxes() {
  const sec = tree[sectionSel.value]
  let boxes = []
  if (colSel.value !== NEW) {
    const col = (sec.dirs || []).find(d => d.name === colSel.value)
    boxes = (col && col.children) || []
  }
  const opts = boxes.map(b => `<option value="${b.name}">${b.name}</option>`)
  opts.push(`<option value="${NEW}">+ 新建框…</option>`)
  boxSel.innerHTML = opts.join('')
  toggleNewBox()
}
function toggleNewCol() {
  newColInput.style.display = colSel.value === NEW ? 'block' : 'none'
}
function toggleNewBox() {
  newBoxInput.style.display = boxSel.value === NEW ? 'block' : 'none'
}

function showMsg(text, ok) {
  msg.textContent = text
  msg.className = 'msg ' + (ok ? 'ok' : 'err')
}

// 发布
$('submit').addEventListener('click', async () => {
  const f = fileInput.files[0]
  if (!f) return showMsg('请先选择文件', false)

  // 解析栏
  const col = colSel.value === NEW ? newColInput.value.trim() : colSel.value
  if (!col) return showMsg('请选择或填写「栏」', false)
  // 解析框
  const box = boxSel.value === NEW ? newBoxInput.value.trim() : boxSel.value
  if (!box) return showMsg('请选择或填写「框」', false)

  // subPath = 栏/框
  const subPath = `${col}/${box}`
  const isNewBox = boxSel.value === NEW

  const fd = new FormData()
  fd.append('file', f)
  fd.append('section', sectionSel.value)
  fd.append('subPath', subPath)
  fd.append('title', $('title').value)
  // 新建框时把描述/标签写到框的 _meta.json
  if (isNewBox) {
    fd.append('newGroup', '')          // 不再额外拼接，subPath 已含框
    fd.append('groupDesc', $('groupDesc').value)
    fd.append('groupTag', $('groupTag').value)
    fd.append('groupTagType', 'new')
    fd.append('metaTarget', subPath)   // 告诉后端给这个框写 meta
  }

  $('submit').disabled = true
  try {
    const r = await fetch('/api/upload', { method: 'POST', body: fd })
    const j = await r.json()
    if (r.ok) {
      // 上传成功后自动发布上线（落本地 → 构建 → 同步服务器，一步到位）
      showMsg('✓ ' + j.message + '，正在发布上线…', true)
      fileInput.value = ''; fileName.textContent = ''; $('title').value = ''
      newColInput.value = ''; newBoxInput.value = ''
      $('groupDesc').value = ''; $('groupTag').value = ''
      fetch('/api/tree').then(r => r.json()).then(t => { tree = t; renderCols() })
      // 触发发布
      const br = await fetch('/api/build', { method: 'POST' })
      const bj = await br.json()
      showMsg('✓ 已上传并' + bj.message, bj.ok)
    } else {
      showMsg('✖ ' + (j.error || '上传失败'), false)
    }
  } catch (e) {
    showMsg('✖ ' + e.message, false)
  } finally {
    $('submit').disabled = false
  }
})

// 单独的「发布上线」按钮：仅重新发布（不上传新文件时用，如改了排序/删了文件）
$('rebuild').addEventListener('click', async () => {
  if (!confirm('确认发布上线？将构建并同步到 note.liuooo.com')) return
  const r = await fetch('/api/build', { method: 'POST' })
  const j = await r.json()
  showMsg(j.message, j.ok)
})

// ===== 管理 · 删除文章 =====
const mSection = $('mSection'), mCol = $('mCol'), mBox = $('mBox')
const docList = $('docList'), mMsg = $('mMsg')

function initManage() {
  mSection.innerHTML = Object.entries(tree).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')
  mRenderCols()
}
function mRenderCols() {
  const sec = tree[mSection.value]
  mCol.innerHTML = (sec.dirs || []).map(d => `<option value="${d.name}">${d.name}</option>`).join('') || '<option value="">（无栏）</option>'
  mRenderBoxes()
}
function mRenderBoxes() {
  const sec = tree[mSection.value]
  const col = (sec.dirs || []).find(d => d.name === mCol.value)
  const boxes = (col && col.children) || []
  mBox.innerHTML = boxes.map(b => `<option value="${b.name}">${b.name}</option>`).join('') || '<option value="">（无框）</option>'
  loadDocs()
}
async function loadDocs() {
  const subPath = [mCol.value, mBox.value].filter(Boolean).join('/')
  if (!subPath) { docList.innerHTML = '<li style="color:#999">该位置没有可删除的文章</li>'; return }
  const r = await fetch('/api/list', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section: mSection.value, subPath })
  })
  const j = await r.json()
  const docs = j.docs || []
  if (!docs.length) { docList.innerHTML = '<li style="color:#999">该框暂无文章</li>'; return }
  docList.innerHTML = docs.map(d =>
    `<li style="display:flex;justify-content:space-between;align-items:center;padding:.5rem .2rem;border-bottom:1px solid var(--vp-c-divider,#eee)">
      <span>${d.title}</span>
      <button data-file="${d.name}" class="del-btn" style="border:1px solid #c33;color:#c33;background:transparent;border-radius:4px;padding:.2rem .7rem;cursor:pointer">删除</button>
    </li>`).join('')
  docList.querySelectorAll('.del-btn').forEach(btn => btn.addEventListener('click', () => delDoc(btn.dataset.file)))
}
async function delDoc(file) {
  if (!confirm(`确认删除「${file.replace(/\.md$/, '')}」？此操作不可恢复。\n删除后需点"仅重新发布"才会同步到线上。`)) return
  const subPath = [mCol.value, mBox.value].filter(Boolean).join('/')
  const r = await fetch('/api/delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section: mSection.value, subPath, file })
  })
  const j = await r.json()
  if (r.ok) {
    mMsg.textContent = '✓ 已删除' + (j.removedDir ? '（空框已一并清理）' : '') + '，记得点"仅重新发布"同步线上'
    mMsg.className = 'msg ok'
    // 刷新树和列表
    const t = await (await fetch('/api/tree')).json(); tree = t
    if (j.removedDir) mRenderCols(); else loadDocs()
    renderCols() // 同步刷新上传区下拉
  } else {
    mMsg.textContent = '✖ ' + (j.error || '删除失败'); mMsg.className = 'msg err'
  }
}
mSection.addEventListener('change', mRenderCols)
mCol.addEventListener('change', mRenderBoxes)
mBox.addEventListener('change', loadDocs)

// tree 加载完成后初始化管理区（tree 在文件顶部 fetch）
const _initTree = setInterval(() => {
  if (Object.keys(tree).length) { clearInterval(_initTree); initManage() }
}, 100)
