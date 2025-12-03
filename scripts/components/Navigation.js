export const Navigation = {
  data() {
    return {
      isNavExpanded: false,
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
  computed: {
    currentRoute() {
      return this.$route.path;
    },
    isCardOverview() {
      return this.currentRoute === '/' || this.currentRoute.startsWith('/?');
    },
    isFoilPage() {
      const query = this.$route.query.view;
      return query === 'foil';
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
        <a href="mailto:contact@sorcerersledger.com" class="contact-email" @click="closeNav">contact@sorcerersledger.com</a>
      </div>
      <div v-if="isNavExpanded && isMobileOrTablet()" 
           class="nav-backdrop" 
           @click="closeNav">
      </div>
    </nav>
  `
}

