<script setup>
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const props = defineProps({
  base: { type: String, required: true }, // 如 '/notes/'
})

const { theme } = useData()
const info = computed(() => (theme.value.sectionInfo || {})[props.base.replace(/\//g, '')] || {})
const tree = computed(() => (theme.value.catalog || {})[props.base] || [])

// 二级栏（顶层分组）
const columns = computed(() => tree.value.filter((n) => n.type === 'group'))
// 板块根目录直接挂的文章（无栏归属）
const looseDocs = computed(() => tree.value.filter((n) => n.type === 'doc'))

function tagClass(t) {
  return `sv-tag sv-tag--${t || 'default'}`
}
// 一个「框」内所有层级的文章拉平
function flattenDocs(node) {
  const out = []
  for (const it of node.items || []) {
    if (it.type === 'doc') out.push(it)
    else if (it.type === 'group') out.push(...flattenDocs(it))
  }
  return out
}
// 一个二级栏下的「框」列表；若栏直接挂文章，归到一个同名隐式框
function boxesOf(col) {
  const boxes = (col.items || []).filter((n) => n.type === 'group')
  const direct = (col.items || []).filter((n) => n.type === 'doc')
  const res = boxes.map((b) => ({ title: b.text, tag: b.tag, tagType: b.tagType, description: b.description, docs: flattenDocs(b) }))
  if (direct.length) res.unshift({ title: col.text, docs: direct })
  return res
}
function anchor(col) {
  return 'col-' + col.text.replace(/\s+/g, '-')
}
</script>

<template>
  <div class="sv">
    <aside class="sv-aside">
      <div class="sv-head">
        <div class="sv-head__title">{{ info.title }}</div>
        <p class="sv-head__desc">{{ info.desc }}</p>
      </div>
      <nav class="sv-nav">
        <div class="sv-nav__title">分类导航</div>
        <a v-for="col in columns" :key="col.text" :href="`#${anchor(col)}`" class="sv-nav__item">{{ col.text }}</a>
      </nav>
    </aside>

    <div class="sv-main">
      <section v-for="col in columns" :key="col.text" :id="anchor(col)" class="sv-column">
        <h2 class="sv-column__title">{{ col.text }}</h2>
        <p v-if="col.description" class="sv-column__desc">{{ col.description }}</p>
        <div class="sv-cards">
          <div v-for="box in boxesOf(col)" :key="box.title" class="sv-card">
            <div class="sv-card__head">
              <span class="sv-card__title">{{ box.title }}</span>
              <span v-if="box.tag" :class="tagClass(box.tagType)">{{ box.tag }}</span>
            </div>
            <div v-if="box.description" class="sv-card__desc">{{ box.description }}</div>
            <div class="sv-card__list">
              <a v-for="d in box.docs" :key="d.link" :href="withBase(d.link)" class="sv-card__item">{{ d.text }}</a>
            </div>
          </div>
        </div>
      </section>

      <section v-if="looseDocs.length" class="sv-column">
        <h2 class="sv-column__title">未分类</h2>
        <div class="sv-cards">
          <div class="sv-card">
            <div class="sv-card__list">
              <a v-for="d in looseDocs" :key="d.link" :href="withBase(d.link)" class="sv-card__item">{{ d.text }}</a>
            </div>
          </div>
        </div>
      </section>

      <p v-if="!columns.length && !looseDocs.length" class="sv-empty">这个板块还没有内容。</p>
    </div>
  </div>
</template>

<style scoped>
.sv {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 2rem;
  max-width: 1440px;
  margin: 0 auto;
  padding: 1.5rem 3rem 3rem;
}

/* 左侧栏 */
.sv-aside {
  position: sticky;
  top: calc(var(--vp-nav-height) + 1.5rem);
  align-self: start;
  height: fit-content;
}
.sv-head {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 1.1rem;
  background: var(--ca-glass-bg);
  backdrop-filter: var(--ca-glass-blur);
  -webkit-backdrop-filter: var(--ca-glass-blur);
}
.sv-head__title { font-weight: 600; font-size: 1.05rem; }
.sv-head__desc { font-size: 0.8rem; color: var(--vp-c-text-2); margin: 0.5rem 0 0; line-height: 1.6; }
.sv-nav { margin-top: 1.2rem; }
.sv-nav__title {
  font-size: 0.75rem; font-weight: 600; color: var(--vp-c-text-3);
  letter-spacing: 0.05em; padding: 0 0.2rem 0.5rem;
}
.sv-nav__item {
  display: block; font-size: 0.875rem; padding: 0.4rem 0.6rem;
  border-radius: 6px; color: var(--vp-c-text-1); text-decoration: none;
}
.sv-nav__item:hover { background: var(--vp-c-default-soft); color: var(--ca-accent); }

/* 右侧主区 */
.sv-column { scroll-margin-top: calc(var(--vp-nav-height) + 1rem); margin-bottom: 2.5rem; }
.sv-column__title { font-size: 1.15rem; font-weight: 600; border: none; padding: 0; margin: 0; }
.sv-column__desc { font-size: 0.82rem; color: var(--vp-c-text-2); margin: 0.35rem 0 0; }
.sv-empty { color: var(--vp-c-text-2); }

/* 框卡片：四联网格 */
.sv-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(248px, 1fr));
  gap: 1rem;
  margin-top: 1.2rem;
}
.sv-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 1rem 1.1rem 0.6rem;
  background: var(--ca-glass-bg);
  backdrop-filter: var(--ca-glass-blur);
  -webkit-backdrop-filter: var(--ca-glass-blur);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.sv-card:hover { border-color: var(--ca-accent); box-shadow: 0 2px 14px var(--ca-accent-soft); }
.sv-card__head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.sv-card__title { font-weight: 600; font-size: 0.95rem; }
.sv-card__desc { font-size: 0.78rem; color: var(--vp-c-text-2); margin-top: 0.3rem; }
.sv-card__list {
  margin-top: 0.7rem; display: flex; flex-direction: column;
  max-height: 13rem; overflow-y: auto; padding-right: 4px;
  scrollbar-width: thin; scrollbar-color: transparent transparent;
  transition: scrollbar-color 0.3s ease;
}
.sv-card__list::-webkit-scrollbar { width: 5px; }
.sv-card__list::-webkit-scrollbar-track { background: transparent; }
.sv-card__list::-webkit-scrollbar-thumb { background: transparent; border-radius: 3px; transition: background 0.3s ease; }
.sv-card:hover .sv-card__list { scrollbar-color: var(--vp-c-divider) transparent; }
.sv-card:hover .sv-card__list::-webkit-scrollbar-thumb { background: var(--vp-c-divider); }
.sv-card__list:hover::-webkit-scrollbar-thumb { background: var(--ca-accent); }
.sv-card__item {
  font-size: 0.86rem; padding: 0.3rem 0; text-decoration: none;
  color: var(--vp-c-text-1); white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; transition: color 0.15s ease;
}
.sv-card__item:hover { color: var(--ca-accent); }

.sv-tag { font-size: 0.7rem; padding: 0.05rem 0.45rem; border-radius: 4px; font-weight: 600; line-height: 1.5; }
.sv-tag--default { color: var(--vp-c-text-2); background: var(--vp-c-default-soft); }
.sv-tag--new { color: #b4593a; background: rgba(180, 89, 58, 0.1); }
.sv-tag--info { color: #3a6a4a; background: rgba(58, 106, 74, 0.1); }
.sv-tag--year { color: #4a5a7a; background: rgba(74, 90, 122, 0.1); }

/* 移动端：左侧栏变顶部横滚，卡片单列 */
@media (max-width: 768px) {
  .sv { grid-template-columns: 1fr; gap: 1rem; padding: 1rem; }
  .sv-aside { position: static; }
  .sv-nav { display: flex; gap: 0.5rem; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 0.8rem; padding-bottom: 0.3rem; }
  .sv-nav__title { display: none; }
  .sv-nav__item { flex: 0 0 auto; border: 1px solid var(--vp-c-divider); padding: 0.35rem 0.8rem; }
  .sv-cards { grid-template-columns: 1fr; gap: 0.8rem; }
  .sv-card__list { max-height: none; }
  .sv-card__item { white-space: normal; overflow: visible; text-overflow: clip; padding: 0.45rem 0; }
}
</style>


