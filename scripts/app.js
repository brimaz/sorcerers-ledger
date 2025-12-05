const { createApp } = Vue
const { createRouter, createWebHistory } = VueRouter

import { CardOverview } from './components/CardOverview.js';
import { TermsOfService } from './components/TermsOfService.js';
import { PrivacyPolicy } from './components/PrivacyPolicy.js';
import { Navigation } from './components/Navigation.js';

const routes = [
  {
    path: '/',
    component: CardOverview,
    props: route => ({ query: route.query })
  },
  {
    path: '/precon',
    component: CardOverview,
    props: route => ({ query: { ...route.query, view: 'precon' } })
  },
  {
    path: '/sealed',
    component: CardOverview,
    props: route => ({ query: { ...route.query, view: 'sealed' } })
  },
  {
    path: '/terms-of-service',
    component: TermsOfService
  },
  {
    path: '/privacy-policy',
    component: PrivacyPolicy
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

createApp({
  components: {
    Navigation,
    CardOverview,
    TermsOfService,
    PrivacyPolicy
  },
  template: `
    <div>
      <Navigation />
      <router-view />
    </div>
  `
}).use(router).mount('#app')
