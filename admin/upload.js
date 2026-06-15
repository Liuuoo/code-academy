// upload.js — 上传后台前端逻辑
const $ = (id) => document.getElementById(id)
const drop = $('drop'), fileInput = $('fileInput'), fileName = $('fileName')
const sectionSel = $('section'), groupSel = $('group'), msg = $('msg')
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
  if (f && !$('title').value) {
    $('title').value = f.name.replace(/\.[^.]+$/, '')
  }
}

// 加载板块/系列树
fetch('/api/tree').then(r => r.json()).then(t => {
  tree = t
  sectionSel.innerHTML = Object.entries(t).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')
  renderGroups()
})
sectionSel.addEventListener('change', renderGroups)
function flatten(dirs, depth = 0) {
  let out = []
  for (const d of dirs) {
    out.push({ path: d.path, label: '　'.repeat(depth) + d.name })
    if (d.children && d.children.length) out = out.concat(flatten(d.children, depth + 1))
  }
  return out
}
function renderGroups() {
  const sec = tree[sectionSel.value]
  const opts = ['<option value="">（板块根目录）</option>']
    .concat(flatten(sec.dirs).map(d => `<option value="${d.path}">${d.label}</option>`))
  groupSel.innerHTML = opts.join('')
}

function showMsg(text, ok) {
  msg.textContent = text
  msg.className = 'msg ' + (ok ? 'ok' : 'err')
}

// 发布
$('submit').addEventListener('click', async () => {
  const f = fileInput.files[0]
  if (!f) return showMsg('请先选择文件', false)
  const fd = new FormData()
  fd.append('file', f)
  fd.append('section', sectionSel.value)
  fd.append('subPath', groupSel.value)
  fd.append('title', $('title').value)
  fd.append('newGroup', $('newGroup').value)
  fd.append('groupDesc', $('groupDesc').value)
  fd.append('groupTag', $('groupTag').value)
  fd.append('groupTagType', 'new')
  $('submit').disabled = true
  try {
    const r = await fetch('/api/upload', { method: 'POST', body: fd })
    const j = await r.json()
    if (r.ok) {
      showMsg('✓ ' + j.message + (j.path ? '（' + j.path + '）' : ''), true)
      fileInput.value = ''; fileName.textContent = ''; $('title').value = ''
      $('newGroup').value = ''; $('groupDesc').value = ''; $('groupTag').value = ''
      fetch('/api/tree').then(r => r.json()).then(t => { tree = t; renderGroups() })
    } else {
      showMsg('✖ ' + (j.error || '上传失败'), false)
    }
  } catch (e) {
    showMsg('✖ ' + e.message, false)
  } finally {
    $('submit').disabled = false
  }
})

// 重建
$('rebuild').addEventListener('click', async () => {
  const r = await fetch('/api/build', { method: 'POST' })
  const j = await r.json()
  showMsg(j.message, j.ok)
})
