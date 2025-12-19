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
    }
  },
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
        <router-link 
          :to="{ path: '/', query: {} }" 
          @click="closeNav"
          active-class=""
          exact-active-class=""
          :class="{ active: isCardOverview && !isFoilPage }">
          Non-Foil Overview
        </router-link>
        <router-link 
          :to="{ path: '/', query: { view: 'foil' } }" 
          @click="closeNav"
          active-class=""
          exact-active-class=""
          :class="{ active: isCardOverview && isFoilPage }">
          Foil Overview
        </router-link>
        <router-link 
          to="/precon" 
          @click="closeNav"
          active-class=""
          exact-active-class=""
          :class="{ active: isPreconPage }">
          Precon
        </router-link>
        <router-link 
          to="/sealed" 
          @click="closeNav"
          active-class=""
          exact-active-class=""
          :class="{ active: isSealedPage }">
          Sealed
        </router-link>
        <router-link 
          to="/deck-calculator" 
          @click="closeNav"
          active-class=""
          exact-active-class=""
          :class="{ active: isDeckCalculatorPage }">
          Deck Calculator
        </router-link>
        <router-link 
          to="/terms-of-service" 
          class="disclaimer-link" 
          @click="closeNav">
          Terms of Service
        </router-link>
        <router-link 
          to="/privacy-policy" 
          class="disclaimer-link" 
          @click="closeNav">
          Privacy Policy
        </router-link>
        <router-link 
          to="/whats-new" 
          class="contact-email"
          @click="closeNav">
          What's New
        </router-link>
        <a :href="'mailto:' + contactEmail" class="contact-email" @click="closeNav">{{ contactEmail }}</a>
      </div>
      <div v-if="isNavExpanded && isMobileOrTablet()" 
           class="nav-backdrop" 
           @click="closeNav">
      </div>
    </nav>
  `
}

