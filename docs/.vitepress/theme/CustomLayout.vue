<script setup>
import { ref, onMounted, watch } from 'vue'
import DefaultTheme from 'vitepress/theme'
import { useRoute, useData } from 'vitepress'

const { Layout } = DefaultTheme
const { frontmatter } = useData()
const collapsed = ref(false)
const route = useRoute()

// 是否文档阅读页（非 home / 非 page 布局）
function isDoc() {
  const l = frontmatter.value.layout
  return l !== 'home' && l !== 'page'
}

function apply() {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('sidebar-collapsed', collapsed.value)
  document.documentElement.classList.toggle('is-doc-page', isDoc())
}
function toggle() {
  collapsed.value = !collapsed.value
  try { localStorage.setItem('ca-sidebar-collapsed', collapsed.value ? '1' : '0') } catch {}
  apply()
}
onMounted(() => {
  try { collapsed.value = localStorage.getItem('ca-sidebar-collapsed') === '1' } catch {}
  apply()
})
watch(() => route.path, apply)
watch(() => frontmatter.value.layout, apply)
</script>

<template>
  <Layout>
    <template #layout-top>
      <!-- 独立浮动折叠按钮：仅在带侧栏的文档页显示，fixed 不随侧栏移动 -->
      <button
        v-if="frontmatter.layout !== 'home' && frontmatter.layout !== 'page'"
        class="ca-fab"
        type="button"
        @click="toggle"
        :title="collapsed ? '展开目录' : '折叠目录'"
      >{{ collapsed ? '»' : '«' }}</button>
    </template>
  </Layout>
</template>
