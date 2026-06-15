import DefaultTheme from 'vitepress/theme'
import CategoryIndex from './CategoryIndex.vue'
import LibraryView from './LibraryView.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('CategoryIndex', CategoryIndex)
    app.component('LibraryView', LibraryView)
  },
}
