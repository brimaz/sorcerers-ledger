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
  ],
  data() {
    return {
    };
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
      const priceValue = this.card[priceField] || 0;
      const price = parseFloat(priceValue);
      if (price === 0 || isNaN(price)) {
        return 'N/A';
      }
      return `$ ${priceValue}`;
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
          return productInfo.imageUrl.replace(/200w/g, 'in_1000x1000');
        }
      }
      // Fallback: return null if image is not available
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
      if (!this.tcgplayerTrackingLink || !this.card.tcgplayerProductId) {
        return '#';
      }
      
      const cardProductId = this.card.tcgplayerProductId;
      const cardProductIdStr = String(cardProductId);
      let tcgplayerUrl = '';
      
      if (this.productInfoBySet && this.productInfoBySet[this.setName]) {
        const productInfo = this.productInfoBySet[this.setName][cardProductIdStr];
        if (productInfo && productInfo.url) {
          tcgplayerUrl = productInfo.url;
        }
      }
      
      if (!tcgplayerUrl) {
        const setSlug = this.getSetSlug(this.setName);
        let cardSlug = '';
        if (this.productInfoBySet && this.productInfoBySet[this.setName]) {
          const productInfo = this.productInfoBySet[this.setName][cardProductIdStr];
          if (productInfo && productInfo.cleanName) {
            cardSlug = productInfo.cleanName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          }
        }
        if (!cardSlug) {
          cardSlug = (this.card.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        }
        tcgplayerUrl = `https://www.tcgplayer.com/product/${cardProductId}/sorcery-contested-realm-${setSlug}-${cardSlug}?Language=English`;
      }
      
      const encodedUrl = encodeURIComponent(tcgplayerUrl);
      return `${this.tcgplayerTrackingLink}?u=${encodedUrl}`;
    },
  },
  methods: {
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
      // Convert set name to URL-friendly slug
      const setSlugMap = {
        'Alpha': 'alpha',
        'Beta': 'beta',
        'Arthurian Legends': 'arthurian-legends',
        'Arthurian Legends Promo': 'arthurian-legends-promo',
        'Dust Reward Promos': 'dust-reward-promos',
        'Dragonlord': 'dragonlord',
      };
      return setSlugMap[setName] || setName.toLowerCase().replace(/\s+/g, '-');
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
