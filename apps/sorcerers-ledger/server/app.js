const { createApp } = Vue
const { createRouter, createWebHistory } = VueRouter

import { CardOverview } from '../../../core/frontend/components/CardOverview.js';
import { TermsOfService } from '../../../core/frontend/components/TermsOfService.js';
import { PrivacyPolicy } from '../../../core/frontend/components/PrivacyPolicy.js';
import { Navigation } from '../../../core/frontend/components/Navigation.js';
import * as gameConfig from '../config/frontendConfig.js';

const routes = [
  {
    path: '/',
    component: CardOverview,
    props: route => ({ query: route.query, gameConfig })
  },
  {
    path: '/precon',
    component: CardOverview,
    props: route => ({ query: { ...route.query, view: 'precon' }, gameConfig })
  },
  {
    path: '/sealed',
    component: CardOverview,
    props: route => ({ query: { ...route.query, view: 'sealed' }, gameConfig })
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

