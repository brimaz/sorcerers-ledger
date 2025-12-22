/**
 * Currency Selector Component
 * Allows users to select their preferred currency
 */

import { 
  getSelectedCurrency, 
  setSelectedCurrency, 
  SUPPORTED_CURRENCIES,
  getCurrencyInfo 
} from '/core/frontend/utils/currencyUtils.js';

export const CurrencySelector = {
  data() {
    return {
      selectedCurrency: getSelectedCurrency(),
      isOpen: false
    };
  },
  mounted() {
    // Listen for currency changes from other components
    window.addEventListener('currency-changed', this.handleCurrencyChange);
  },
  beforeUnmount() {
    window.removeEventListener('currency-changed', this.handleCurrencyChange);
  },
  computed: {
    currentCurrencyInfo() {
      return getCurrencyInfo(this.selectedCurrency);
    },
    currencyOptions() {
      return SUPPORTED_CURRENCIES.map(code => ({
        code,
        ...getCurrencyInfo(code)
      }));
    }
  },
  methods: {
    handleCurrencyChange(event) {
      this.selectedCurrency = event.detail.currency;
    },
    selectCurrency(currencyCode) {
      setSelectedCurrency(currencyCode);
      this.selectedCurrency = currencyCode;
      this.isOpen = false;
      // Force Vue to re-render components that use currency
      this.$forceUpdate();
      // Also trigger a global event
      window.dispatchEvent(new CustomEvent('currency-updated'));
    },
    toggleDropdown() {
      this.isOpen = !this.isOpen;
    },
    closeDropdown() {
      this.isOpen = false;
    },
    isMobileOrTablet() {
      return window.innerWidth <= 1024;
    }
  },
  template: `
    <div class="currency-selector" 
         @click.stop
         :class="{ 'currency-selector-open': isOpen }">
      <button 
        class="currency-selector-button"
        @click="toggleDropdown"
        :aria-expanded="isOpen"
        aria-haspopup="true">
        <span class="currency-selector-symbol">{{ currentCurrencyInfo.symbol }}</span>
        <span class="currency-selector-code">{{ currentCurrencyInfo.code }}</span>
        <span class="currency-selector-arrow">▼</span>
      </button>
      <div 
        v-if="isOpen"
        class="currency-selector-dropdown"
        @click.stop>
        <div 
          v-for="option in currencyOptions"
          :key="option.code"
          class="currency-selector-option"
          :class="{ 'currency-selector-option-selected': option.code === selectedCurrency }"
          @click="selectCurrency(option.code)">
          <span class="currency-selector-option-symbol">{{ option.symbol }}</span>
          <span class="currency-selector-option-code">{{ option.code }}</span>
          <span class="currency-selector-option-name">{{ option.name }}</span>
          <span v-if="option.code === selectedCurrency" class="currency-selector-check">✓</span>
        </div>
      </div>
      <div 
        v-if="isOpen"
        class="currency-selector-backdrop"
        @click="closeDropdown">
      </div>
    </div>
  `
};

