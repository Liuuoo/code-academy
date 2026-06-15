<script setup>
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const props = defineProps({
  base: { type: String, required: true },
})

const { theme } = useData()

// catalog[base] 是富目录树：group 节点带 description/tag/tagType
const groups = computed(() => {
  const cat = theme.value.catalog
  if (!cat) return []
  return cat[props.base] || []
})

// 顶层若直接是文档（没有分组），单独收拢成一组
const looseDocs = computed(() => groups.value.filter((n) => n.type === 'doc'))
const cardGroups = computed(() => groups.value.filter((n) => n.type === 'group'))

function tagClass(t) {
  return `cat-tag cat-tag--${t || 'default'}`
}
</script>

<template>
  <div class="cat-grid">
    <div v-for="g in cardGroups" :key="g.text" class="cat-card">
      <div class="cat-card__head">
        <span class="cat-card__title">{{ g.text }}</span>
        <span v-if="g.tag" :class="tagClass(g.tagType)">{{ g.tag }}</span>
      </div>
      <div v-if="g.description" class="cat-card__desc">{{ g.description }}</div>
      <div class="cat-card__list">
        <template v-for="it in g.items" :key="it.link || it.text">
          <a v-if="it.link" :href="withBase(it.link)" class="cat-card__item">{{ it.text }}</a>
          <span v-else class="cat-card__subgroup">{{ it.text }}</span>
        </template>
      </div>
    </div>

    <div v-if="looseDocs.length" class="cat-card">
      <div class="cat-card__head"><span class="cat-card__title">未分类</span></div>
      <div class="cat-card__list">
        <a v-for="d in looseDocs" :key="d.link" :href="withBase(d.link)" class="cat-card__item">{{ d.text }}</a>
      </div>
    </div>

    <p v-if="!cardGroups.length && !looseDocs.length" class="cat-empty">这个分类还没有内容。</p>
  </div>
</template>

<style scoped>
.cat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}
.cat-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 1rem 1.1rem 0.6rem;
  background: var(--vp-c-bg-soft);
  display: flex;
  flex-direction: column;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.cat-card:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}
.cat-card__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.cat-card__title { font-weight: 600; font-size: 1rem; }
.cat-card__desc {
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
  margin-top: 0.3rem;
}
.cat-card__list {
  margin-top: 0.7rem;
  display: flex;
  flex-direction: column;
  max-height: 11rem;
  overflow-y: auto;
}
.cat-card__item {
  font-size: 0.875rem;
  padding: 0.32rem 0;
  text-decoration: none;
  color: var(--vp-c-text-1);
  border-bottom: 1px dashed transparent;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cat-card__item:hover { color: var(--vp-c-brand-1); }
.cat-card__subgroup {
  font-size: 0.78rem;
  color: var(--vp-c-text-3);
  font-weight: 600;
  margin-top: 0.4rem;
}
.cat-empty { color: var(--vp-c-text-2); }

/* 低饱和标签，避免 AI 味的高亮 */
.cat-tag {
  font-size: 0.7rem;
  padding: 0.05rem 0.45rem;
  border-radius: 4px;
  font-weight: 600;
  line-height: 1.5;
}
.cat-tag--default { color: var(--vp-c-text-2); background: var(--vp-c-default-soft); }
.cat-tag--new { color: #b4593a; background: rgba(180, 89, 58, 0.1); }
.cat-tag--info { color: #3a6a4a; background: rgba(58, 106, 74, 0.1); }
.cat-tag--year { color: #4a5a7a; background: rgba(74, 90, 122, 0.1); }

@media (max-width: 768px) {
  .cat-grid { grid-template-columns: 1fr; gap: 0.8rem; }
  .cat-card__list { max-height: none; }
}
</style>
