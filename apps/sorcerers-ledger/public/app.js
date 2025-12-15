const { createApp } = Vue
const { createRouter, createWebHistory } = VueRouter

import { CardOverview } from '/core/frontend/components/CardOverview.js';
import { TermsOfService } from '/core/frontend/components/TermsOfService.js';
import { PrivacyPolicy } from '/core/frontend/components/PrivacyPolicy.js';
import { Navigation } from '/core/frontend/components/Navigation.js';
import * as gameConfigModule from '/apps/sorcerers-ledger/config/frontendConfig.js';

// Convert module exports to plain object for Vue props
const gameConfig = {
  GAME_ID: gameConfigModule.GAME_ID,
  GAME_TITLE: gameConfigModule.GAME_TITLE,
  GAME_NAME: gameConfigModule.GAME_NAME,
  PUBLISHER_NAME: gameConfigModule.PUBLISHER_NAME,
  CONTACT_EMAIL: gameConfigModule.CONTACT_EMAIL,
  RARITIES: gameConfigModule.RARITIES,
  RARITY_PRICE_THRESHOLDS: gameConfigModule.RARITY_PRICE_THRESHOLDS,
  SET_ICONS: gameConfigModule.SET_ICONS,
  SET_ORDER: gameConfigModule.SET_ORDER,
  TCGPLAYER_CATEGORY_SLUG: gameConfigModule.TCGPLAYER_CATEGORY_SLUG,
  SET_SLUG_MAP: gameConfigModule.SET_SLUG_MAP,
  PRECON_SOURCE_SETS: gameConfigModule.PRECON_SOURCE_SETS || []
};

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
    component: TermsOfService,
    props: route => ({ gameConfig })
  },
  {
    path: '/privacy-policy',
    component: PrivacyPolicy,
    props: route => ({ gameConfig })
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
      <Navigation :gameConfig="gameConfig" />
      <router-view />
    </div>
  `,
  data() {
    return {
      gameConfig
    }
  }
}).use(router).mount('#app')

