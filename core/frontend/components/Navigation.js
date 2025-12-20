export const Navigation = {
  props: {
    gameConfig: {
      type: Object,
      default: () => ({
        CONTACT_EMAIL: "contact@sorcerersledger.com"
      })
    }
  },
  data() {
    return {
      isNavExpanded: false,
      expandedNavItems: new Set(), // Track which nested nav items are expanded
    }
  },
  mounted() {
    // Add click listener to close nested menus when clicking outside (desktop)
    this.handleDocumentClick = (event) => {
      if (!this.isMobileOrTablet()) {
        const navContainer = event.target.closest('.nav-nested-container');
        if (!navContainer && this.expandedNavItems.size > 0) {
          this.expandedNavItems.clear();
        }
      }
    };
    document.addEventListener('click', this.handleDocumentClick);
  },
  beforeUnmount() {
    // Clean up click listener
    if (this.handleDocumentClick) {
      document.removeEventListener('click', this.handleDocumentClick);
    }
  },
  // Removed auto-expand - nested menus should be collapsed by default
  computed: {
    contactEmail() {
      return this.gameConfig?.CONTACT_EMAIL || "contact@sorcerersledger.com";
    },
    currentRoute() {
      return this.$route.path;
    },
    isCardOverview() {
      return this.currentRoute === '/' || this.currentRoute.startsWith('/?');
    },
    isFoilPage() {
      const query = this.$route.query.view;
      return query === 'foil';
    },
    isPreconPage() {
      return this.currentRoute === '/precon' || this.$route.query.view === 'precon';
    },
    isSealedPage() {
      return this.currentRoute === '/sealed' || this.$route.query.view === 'sealed';
    },
    isDeckCalculatorPage() {
      return this.currentRoute === '/deck-calculator';
    },
    isTradeCalculatorPage() {
      return this.currentRoute === '/trade-calculator';
    },
    isPriceToolsActive() {
      return this.isDeckCalculatorPage || this.isTradeCalculatorPage;
    },
    // Navigation structure - abstracted for maintainability
    navigationItems() {
      return [
        {
          type: 'link',
          to: { path: '/', query: {} },
          label: 'Non-Foil Overview',
          isActive: () => this.isCardOverview && !this.isFoilPage
        },
        {
          type: 'link',
          to: { path: '/', query: { view: 'foil' } },
          label: 'Foil Overview',
          isActive: () => this.isCardOverview && this.isFoilPage
        },
        {
          type: 'link',
          to: '/precon',
          label: 'Precon',
          isActive: () => this.isPreconPage
        },
        {
          type: 'link',
          to: '/sealed',
          label: 'Sealed',
          isActive: () => this.isSealedPage
        },
        {
          type: 'nested',
          label: 'Price Tools',
          isActive: () => this.isPriceToolsActive,
          children: [
            {
              type: 'link',
              to: '/deck-calculator',
              label: 'Deck Calculator',
              isActive: () => this.isDeckCalculatorPage
            },
            {
              type: 'link',
              to: '/trade-calculator',
              label: 'Trade Calculator',
              isActive: () => this.isTradeCalculatorPage
            }
          ]
        },
        {
          type: 'link',
          to: '/terms-of-service',
          label: 'Terms of Service',
          cssClass: 'disclaimer-link'
        },
        {
          type: 'link',
          to: '/privacy-policy',
          label: 'Privacy Policy',
          cssClass: 'disclaimer-link'
        },
        {
          type: 'link',
          to: '/whats-new',
          label: "What's New",
          cssClass: 'contact-email'
        }
      ];
    }
  },
  methods: {
    toggleNav() {
      this.isNavExpanded = !this.isNavExpanded;
    },
    isMobileOrTablet() {
      return window.innerWidth <= 1024;
    },
    closeNav() {
      this.isNavExpanded = false;
      // Reset all expanded nested nav items
      this.expandedNavItems.clear();
    },
    toggleNestedNav(itemLabel) {
      if (this.expandedNavItems.has(itemLabel)) {
        this.expandedNavItems.delete(itemLabel);
      } else {
        this.expandedNavItems.add(itemLabel);
      }
    },
    isNestedNavExpanded(itemLabel) {
      return this.expandedNavItems.has(itemLabel);
    }
  },
  template: `
    <nav :class="{ 'nav-expanded': isNavExpanded }">
      <div class="nav-header" v-if="isMobileOrTablet()">
        <button 
           @click.stop.prevent="toggleNav" 
           class="nav-hamburger"
           :class="{ 'nav-hamburger-active': isNavExpanded }">
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
          <span class="hamburger-line"></span>
        </button>
      </div>
      <div class="nav-links" :class="{ 'nav-links-visible': !isMobileOrTablet() || isNavExpanded }">
        <template v-for="item in navigationItems" :key="item.label">
          <!-- Regular link items -->
          <router-link 
            v-if="item.type === 'link'"
            :to="typeof item.to === 'string' ? item.to : item.to"
            @click="closeNav"
            active-class=""
            exact-active-class=""
            :class="[item.cssClass || '', { active: item.isActive ? item.isActive() : false }]">
            {{ item.label }}
          </router-link>
          
          <!-- Nested navigation items -->
          <div v-else-if="item.type === 'nested'" class="nav-nested-container">
            <div 
              class="nav-nested-header"
              :class="{ active: item.isActive ? item.isActive() : false, expanded: isNestedNavExpanded(item.label) }"
              @click.stop="toggleNestedNav(item.label)">
              <span>{{ item.label }}</span>
              <span class="nav-nested-arrow">▼</span>
            </div>
            <div 
              class="nav-nested-children"
              :class="{ 'nav-nested-children-visible': isNestedNavExpanded(item.label) }">
              <router-link 
                v-for="child in item.children"
                :key="child.label"
                :to="typeof child.to === 'string' ? child.to : child.to"
                @click="closeNav"
                active-class=""
                exact-active-class=""
                :class="{ active: child.isActive ? child.isActive() : false }"
                class="nav-nested-child">
                {{ child.label }}
              </router-link>
            </div>
          </div>
        </template>
        <a :href="'mailto:' + contactEmail" class="contact-email" @click="closeNav">{{ contactEmail }}</a>
      </div>
      <div v-if="isNavExpanded && isMobileOrTablet()" 
           class="nav-backdrop" 
           @click="closeNav">
      </div>
    </nav>
  `
}

