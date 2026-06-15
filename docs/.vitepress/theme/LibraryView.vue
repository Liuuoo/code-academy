<script setup>
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const { theme } = useData()
const library = computed(() => theme.value.library || [])

function tagClass(t) {
  return `lib-tag lib-tag--${t || 'default'}`
}
function cards(section) {
  return section.groups.filter((n) => n.type === 'group')
}
function loose(section) {
  return section.groups.filter((n) => n.type === 'doc')
}
</script>

<template>
  <div class="lib">
    <aside class="lib-aside">
      <div class="lib-welcome">
        <div class="lib-welcome__title">Code Academy 知识库</div>
        <p class="lib-welcome__desc">日常教学的笔记与题解都在这里，按板块浏览或用顶部搜索查找。</p>
      </div>
      <nav class="lib-nav">
        <div class="lib-nav__title">板块导航</div>
        <a
          v-for="sec in library"
          :key="sec.id"
          :href="`#sec-${sec.id}`"
          class="lib-nav__item"
        >{{ sec.title }}</a>
      </nav>
    </aside>

    <div class="lib-main">
      <section v-for="sec in library" :key="sec.id" :id="`sec-${sec.id}`" class="lib-section">
        <h2 class="lib-section__title">{{ sec.title }}</h2>
        <p class="lib-section__desc">{{ sec.desc }}</p>

        <div class="lib-cards">
          <div v-for="g in cards(sec)" :key="g.text" class="lib-card">
            <div class="lib-card__head">
              <span class="lib-card__title">{{ g.text }}</span>
              <span v-if="g.tag" :class="tagClass(g.tagType)">{{ g.tag }}</span>
            </div>
            <div v-if="g.description" class="lib-card__desc">{{ g.description }}</div>
            <div class="lib-card__list">
              <template v-for="it in g.items" :key="it.link || it.text">
                <!-- 子分类：小标题分段 + 段内文章 -->
                <div v-if="it.type === 'group'" class="lib-card__seg">
                  <div class="lib-card__seg-title">{{ it.text }}</div>
                  <template v-for="sub in it.items" :key="sub.link || sub.text">
                    <a v-if="sub.link" :href="withBase(sub.link)" class="lib-card__item">{{ sub.text }}</a>
                    <div v-else class="lib-card__seg lib-card__seg--nested">
                      <div class="lib-card__seg-title lib-card__seg-title--sub">{{ sub.text }}</div>
                      <a v-for="leaf in sub.items" :key="leaf.link" :href="withBase(leaf.link)" class="lib-card__item">{{ leaf.text }}</a>
                    </div>
                  </template>
                </div>
                <!-- 直接文章 -->
                <a v-else :href="withBase(it.link)" class="lib-card__item">{{ it.text }}</a>
              </template>
            </div>
          </div>

          <div v-if="loose(sec).length" class="lib-card">
            <div class="lib-card__head"><span class="lib-card__title">未分类</span></div>
            <div class="lib-card__list">
              <a v-for="d in loose(sec)" :key="d.link" :href="withBase(d.link)" class="lib-card__item">{{ d.text }}</a>
            </div>
          </div>
        </div>

        <p v-if="!cards(sec).length && !loose(sec).length" class="lib-empty">这个板块还没有内容。</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.lib {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 3rem;
}

/* 左侧栏 */
.lib-aside {
  position: sticky;
  top: calc(var(--vp-nav-height) + 1.5rem);
  align-self: start;
  height: fit-content;
}
.lib-welcome {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 1.1rem;
  background: var(--vp-c-bg-soft);
}
.lib-welcome__title { font-weight: 600; font-size: 1.02rem; }
.lib-welcome__desc {
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
  margin: 0.5rem 0 0;
  line-height: 1.6;
}
.lib-nav { margin-top: 1.2rem; }
.lib-nav__title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--vp-c-text-3);
  letter-spacing: 0.05em;
  padding: 0 0.2rem 0.5rem;
}
.lib-nav__item {
  display: block;
  font-size: 0.875rem;
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
  color: var(--vp-c-text-1);
  text-decoration: none;
}
.lib-nav__item:hover { background: var(--vp-c-default-soft); color: var(--vp-c-brand-1); }

/* 右侧主区 */
.lib-section { scroll-margin-top: calc(var(--vp-nav-height) + 1rem); margin-bottom: 2.5rem; }
.lib-section__title {
  font-size: 1.15rem;
  font-weight: 600;
  border: none;
  padding: 0;
  margin: 0;
}
.lib-section__desc {
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
  margin: 0.35rem 0 0;
}
.lib-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1.2rem;
}
.lib-card {
  flex: 0 0 300px;
  width: 300px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 1rem 1.1rem 0.6rem;
  background: var(--vp-c-bg-soft);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.lib-card:hover {
  border-color: var(--ca-accent);
  box-shadow: 0 2px 14px var(--ca-accent-soft);
}
.lib-card__head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.lib-card__title { font-weight: 600; font-size: 0.95rem; }
.lib-card__desc { font-size: 0.78rem; color: var(--vp-c-text-2); margin-top: 0.3rem; }
.lib-card__list {
  margin-top: 0.7rem;
  display: flex;
  flex-direction: column;
  max-height: 11rem;
  overflow-y: auto;
  scrollbar-width: thin;
}
.lib-card__list::-webkit-scrollbar { width: 6px; }
.lib-card__list::-webkit-scrollbar-thumb {
  background: var(--vp-c-divider);
  border-radius: 3px;
}
.lib-card__item {
  font-size: 0.86rem;
  padding: 0.3rem 0;
  text-decoration: none;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.15s ease;
}
.lib-card__item:hover { color: var(--ca-accent); }
.lib-card__subgroup { font-size: 0.76rem; color: var(--vp-c-text-3); font-weight: 600; margin-top: 0.4rem; }
.lib-empty { color: var(--vp-c-text-2); }

/* 卡内子分类分段 */
.lib-card__seg { margin-top: 0.5rem; }
.lib-card__seg-title {
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--vp-c-text-3);
  letter-spacing: 0.02em;
  padding: 0.2rem 0;
  border-bottom: 1px solid var(--vp-c-divider);
  margin-bottom: 0.2rem;
}
.lib-card__seg-title--sub {
  border-bottom: none;
  padding-left: 0.6rem;
  color: var(--vp-c-text-3);
  font-weight: 500;
}
.lib-card__seg--nested { margin-left: 0.4rem; }
.lib-card__seg--nested .lib-card__item { padding-left: 0.6rem; }

.lib-tag { font-size: 0.7rem; padding: 0.05rem 0.45rem; border-radius: 4px; font-weight: 600; line-height: 1.5; }
.lib-tag--default { color: var(--vp-c-text-2); background: var(--vp-c-default-soft); }
.lib-tag--new { color: #b4593a; background: rgba(180, 89, 58, 0.1); }
.lib-tag--info { color: #3a6a4a; background: rgba(58, 106, 74, 0.1); }
.lib-tag--year { color: #4a5a7a; background: rgba(74, 90, 122, 0.1); }

/* 移动端：单列，锚点栏变横向滚动条 */
@media (max-width: 768px) {
  .lib { grid-template-columns: 1fr; gap: 1rem; padding: 1rem; }
  .lib-aside { position: static; }
  .lib-nav { margin-top: 0.8rem; }
  .lib-nav__title { display: none; }
  .lib-nav {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 0.3rem;
  }
  .lib-nav__item {
    flex: 0 0 auto;
    border: 1px solid var(--vp-c-divider);
    padding: 0.35rem 0.8rem;
  }
  .lib-cards { gap: 0.8rem; }
  .lib-card { flex: 1 1 100%; width: 100%; }
  .lib-card__list { max-height: none; }
}
</style>


