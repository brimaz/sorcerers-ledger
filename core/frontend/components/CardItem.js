import { generateTcgplayerCardLink } from '/core/frontend/utils/cardLinkUtils.js';
import { formatPrice, getSelectedCurrency } from '/core/frontend/utils/currencyUtils.js';

export const CardItem = {
  props: [
    'card',
    'setName',
    'isFoilPage',
    'filterPriceChangeStatus',
    'allOldSetsCardData',
    'priceType',
    'showHoverImage',
    'hideHoverImage',
    'showMobileModal',
    'tcgplayerTrackingLink',
    'productInfoBySet',
    'setSlugMap',
    'tcgplayerCategorySlug',
    'gameConfig',
  ],
  data() {
    return {
      selectedCurrency: getSelectedCurrency()
    };
  },
  mounted() {
    // Listen for currency changes
    window.addEventListener('currency-changed', this.handleCurrencyChange);
    window.addEventListener('currency-updated', this.handleCurrencyUpdate);
  },
  beforeUnmount() {
    window.removeEventListener('currency-changed', this.handleCurrencyChange);
    window.removeEventListener('currency-updated', this.handleCurrencyUpdate);
  },
  watch: {
    tcgplayerTrackingLink(newVal, oldVal) {
      // When tracking link changes from empty to a value, force update
      // This ensures links update when the tracking link loads asynchronously
      if (newVal && newVal !== oldVal) {
        // Force re-evaluation of computed properties
        this.$forceUpdate();
      }
    }
  },
  template: `
    <li>
      <span class="card-name">
        <a :href="cardLink"
           :target="isMobileOrTablet() ? '_self' : '_blank'"
           :rel="isMobileOrTablet() ? '' : 'noopener noreferrer'"
           @mouseover="showHoverImage($event.target, imageUrl, isFoilPage)"
           @mouseleave="hideHoverImage()"
           @click="handleCardClick($event)">
          {{ card.name }}
        </a>
        <span v-if="showFluctuation" :class="'price-fluctuation-' + fluctuation.colorClass">{{ fluctuation.arrow }}</span>
      </span>
      <span class="card-price">{{ displayPrice }}</span>
    </li>
  `,
  computed: {
    displayPrice() {
      // Use selected price type (low, mid, high, or market)
      const priceFieldMap = {
        'low': 'tcgplayerLowPrice',
        'mid': 'tcgplayerMidPrice',
        'high': 'tcgplayerHighPrice',
        'market': 'tcgplayerMarketPrice'
      };
      const priceField = priceFieldMap[this.priceType] || 'tcgplayerLowPrice';
      
      // Special handling for market price: if it's 0, it means TCGplayer doesn't track market price for this card
      if (this.priceType === 'market') {
        const marketPrice = parseFloat(this.card.tcgplayerMarketPrice || 0);
        
        // If market price is 0, show N/A (market price not tracked by TCGplayer)
        if (marketPrice === 0 || isNaN(marketPrice)) {
          return 'N/A';
        }
        // Otherwise, show the actual market price with currency formatting
        return formatPrice(marketPrice, { currency: this.selectedCurrency });
      }
      
      // For other price types, use standard logic
      const priceValue = this.card[priceField] || 0;
      const price = parseFloat(priceValue);
      if (price === 0 || isNaN(price)) {
        return 'N/A';
      }
      return formatPrice(price, { currency: this.selectedCurrency });
    },
    imageUrl() {
      // Use TCGplayer image URL from product info
      // Get product ID from card data
      const cardProductId = this.card.tcgplayerProductId;
      if (cardProductId && this.productInfoBySet && this.productInfoBySet[this.setName]) {
        // Convert to string for lookup (object keys are strings)
        const productInfo = this.productInfoBySet[this.setName][String(cardProductId)];
        if (productInfo && productInfo.imageUrl) {
          // Replace "200w" with "in_1000x1000" for larger hover images
          // TCGplayer images maintain their aspect ratio, so Site cards will display horizontally
          // when the CSS horizontal class is applied
          return productInfo.imageUrl.replace(/200w/g, 'in_1000x1000');
        }
      }
      // Fallback: return null if image is not available
      return null;
    },
    cardType() {
      // Get card type from product info
      const cardProductId = this.card.tcgplayerProductId;
      if (cardProductId && this.productInfoBySet && this.productInfoBySet[this.setName]) {
        const productInfo = this.productInfoBySet[this.setName][String(cardProductId)];
        if (productInfo) {
          const ct = productInfo.cardType;
          if (ct && ct.trim() !== "") {
            return ct.trim();
          }
        }
      }
      return null;
    },
    fluctuation() {
      return this.getPriceFluctuation(this.card, this.setName);
    },
    showFluctuation() {
      return !this.filterPriceChangeStatus || (this.filterPriceChangeStatus && Math.abs(this.fluctuation.priceChange) >= 1);
    },
    isDesktopLink() {
      // This is no longer used since we show a modal on desktop
      // Keeping for backwards compatibility but always returns false
      return false;
    },
    cardLink() {
      // On desktop, navigate directly to TCGplayer link
      // On mobile/tablet, use # to trigger mobile modal
      if (this.isMobileOrTablet()) {
        return '#';
      }
      return this.tcgplayerLink;
    },
    tcgplayerLink() {
      // Access the prop directly - Vue computed properties are reactive to props
      const trackingLink = this.tcgplayerTrackingLink;
      
      // If tracking link is not available yet, return '#' (will update when it loads)
      if (!trackingLink || !this.card || !this.card.tcgplayerProductId || !this.setName) {
        return '#';
      }
      
      // Build gameConfig object from props (CardItem receives individual props, not gameConfig)
      const gameConfig = {
        SET_SLUG_MAP: this.setSlugMap || {},
        TCGPLAYER_CATEGORY_SLUG: this.tcgplayerCategorySlug || 'sorcery-contested-realm'
      };
      
      // If gameConfig prop is provided, merge it (for future compatibility)
      if (this.gameConfig) {
        Object.assign(gameConfig, this.gameConfig);
      }
      
      // Use utility function to generate the link
      try {
        const link = generateTcgplayerCardLink({
          card: this.card,
          setName: this.setName,
          cardName: this.card?.name,
          gameConfig,
          productInfoBySet: this.productInfoBySet || {},
          tcgplayerTrackingLink: trackingLink
        });
        return link;
      } catch (error) {
        console.error('CardItem.tcgplayerLink: Error calling generateTcgplayerCardLink', error);
        return '#';
      }
    },
  },
  methods: {
    handleCurrencyChange(event) {
      this.selectedCurrency = event.detail.currency;
    },
    handleCurrencyUpdate() {
      this.selectedCurrency = getSelectedCurrency();
      this.$forceUpdate();
    },
    getPriceFluctuation(currentCard, setName) {
      if (!this.allOldSetsCardData[setName]) {
        return { arrow: '', colorClass: '', priceChange: 0 };
      }

      const oldCardDataForSet = this.allOldSetsCardData[setName];
      const oldCard = oldCardDataForSet.find(card => card.name === currentCard.name && card.condition === currentCard.condition);

      if (oldCard) {
        // Use selected price type for current price
        const priceFieldMap = {
          'low': 'tcgplayerLowPrice',
          'mid': 'tcgplayerMidPrice',
          'high': 'tcgplayerHighPrice',
          'market': 'tcgplayerMarketPrice'
        };
        const priceField = priceFieldMap[this.priceType] || 'tcgplayerLowPrice';
        const currentPrice = parseFloat(currentCard[priceField] || 0);
        // For old price, try to use the same field, fallback to old field names
        const oldPrice = parseFloat(oldCard[priceField] || oldCard.tcgplayerMarketPrice || oldCard.price || 0);

        if (currentPrice > oldPrice) {
          return { arrow: '▲', colorClass: 'price-up', priceChange: currentPrice - oldPrice };
        } else if (currentPrice < oldPrice) {
          return { arrow: '▼', colorClass: 'price-down', priceChange: oldPrice - currentPrice };
        }
      }
      return { arrow: '', colorClass: '', priceChange: 0 };
    },
    handleCardClick(event) {
      if (this.isMobileOrTablet()) {
          // On mobile/tablet, prevent default and show image modal with card info
          event.preventDefault();
          this.showMobileModal(this.imageUrl, this.isFoilPage, this.card.name, this.setName);
      }
      // On desktop, let the link navigate naturally (no preventDefault needed)
    },
    isMobileOrTablet() {
        return window.innerWidth <= 1024;
    },
    getSetSlug(setName) {
      // Convert set name to URL-friendly slug using config
      if (this.setSlugMap && this.setSlugMap[setName]) {
        return this.setSlugMap[setName];
      }
      return setName.toLowerCase().replace(/\s+/g, '-');
    },
    getCardProductId(cardName, setName) {
      // Get product ID directly from card data (stored in tcgplayerProductId)
      if (this.card && this.card.tcgplayerProductId) {
        return this.card.tcgplayerProductId;
      }
      return null;
    },
  },
};
