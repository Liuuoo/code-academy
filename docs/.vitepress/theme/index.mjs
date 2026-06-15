import DefaultTheme from 'vitepress/theme'
import CategoryIndex from './CategoryIndex.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('CategoryIndex', CategoryIndex)
  },
}
