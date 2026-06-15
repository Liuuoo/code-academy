import { defineConfig } from 'vitepress'
import mathjax3 from 'markdown-it-mathjax3'
import { sidebarNotes, sidebarSolutions } from './sidebar.mjs'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Code Academy',
  description: '教学笔记与题解',
  cleanUrls: true,
  lastUpdated: true,

  head: [
    ['meta', { name: 'viewport', content: 'width=device-width,initial-scale=1' }],
  ],

  markdown: {
    math: true,
    lineNumbers: true,
    config: (md) => {
      md.use(mathjax3)
    },
  },

  themeConfig: {
    logo: undefined,
    outline: { level: [2, 3], label: '本页目录' },
    nav: [
      { text: '首页', link: '/' },
      { text: '笔记', link: '/notes/' },
      { text: '题解', link: '/solutions/' },
    ],
    sidebar: {
      '/notes/': sidebarNotes,
      '/solutions/': sidebarSolutions,
    },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: {
            displayDetails: '显示详情',
            resetButtonTitle: '清除',
            noResultsText: '没有找到结果',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
      },
    },
    docFooter: { prev: '上一篇', next: '下一篇' },
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '返回顶部',
    lastUpdated: { text: '最后更新于' },
  },
})
