<script setup>
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const props = defineProps({
  base: { type: String, required: true },
})

const { theme } = useData()

const groups = computed(() => {
  const sb = theme.value.sidebar
  if (!sb) return []
  return sb[props.base] || []
})
</script>

<template>
  <div class="cat-index">
    <div v-for="g in groups" :key="g.text" class="cat-group">
      <template v-if="g.items">
        <h2 class="cat-group-title">{{ g.text }}</h2>
        <ul class="cat-list">
          <li v-for="it in g.items" :key="it.link || it.text">
            <a v-if="it.link" :href="withBase(it.link)">{{ it.text }}</a>
            <span v-else class="cat-subgroup">{{ it.text }}</span>
          </li>
        </ul>
      </template>
      <template v-else-if="g.link">
        <ul class="cat-list">
          <li><a :href="withBase(g.link)">{{ g.text }}</a></li>
        </ul>
      </template>
    </div>
    <p v-if="!groups.length" class="cat-empty">这个分类还没有内容。</p>
  </div>
</template>

<style scoped>
.cat-index { margin-top: 1.5rem; }
.cat-group { margin-bottom: 2rem; }
.cat-group-title {
  font-size: 1.15rem;
  font-weight: 600;
  border: none;
  padding: 0 0 0.5rem 0;
  margin: 0 0 0.75rem 0;
  border-bottom: 1px solid var(--vp-c-divider);
}
.cat-list { list-style: none; padding: 0; margin: 0; }
.cat-list li { margin: 0.4rem 0; }
.cat-list a { font-weight: 500; text-decoration: none; }
.cat-list a:hover { text-decoration: underline; }
.cat-subgroup { color: var(--vp-c-text-2); font-weight: 600; }
.cat-empty { color: var(--vp-c-text-2); }
</style>
