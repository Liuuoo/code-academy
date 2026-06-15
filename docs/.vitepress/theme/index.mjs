import DefaultTheme from 'vitepress/theme'
import SectionView from './SectionView.vue'
import CustomLayout from './CustomLayout.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: CustomLayout,
  enhanceApp({ app }) {
    app.component('SectionView', SectionView)
  },
}
