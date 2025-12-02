export const CardItem = {
  props: [
    'card',
    'setName',
    'isFoilPage',
    'filterPriceChangeStatus',
    'allOldSetsCardData',
    'showHoverImage',
    'hideHoverImage',
    'showMobileModal',
    'tcgplayerTrackingLink',
    'productInfoBySet',
  ],
  data() {
    return {
      showDesktopBuyModal: false,
      modalPosition: { top: '50%', left: '50%' },
    };
  },
  template: `
    <li>
      <span class="card-name">
        <a :href="cardLink"
           @mouseover="showHoverImage($event.target, imageUrl, isFoilPage)"
           @mouseleave="hideHoverImage()"
           @click="handleCardClick($event)">
          {{ card.name }}
        </a>
        <span v-if="showFluctuation" :class="'price-fluctuation-' + fluctuation.colorClass">{{ fluctuation.arrow }}</span>
      </span>
      <span class="card-price">{{ displayPrice }}</span>
      
      <!-- Desktop Buy Options Modal -->
      <div v-if="showDesktopBuyModal && !isMobileOrTablet()" 
           class="modal-overlay buy-options-modal"
           @click="hideDesktopBuyModal">
        <div class="modal-content buy-options-content" 
             :style="{ top: modalPosition.top, left: modalPosition.left }"
             @click.stop>
          <button class="modal-close-button" @click="hideDesktopBuyModal">
            <img src="assets/sl-modal-close.png" alt="Close">
          </button>
          <div class="buy-options-header">
            <h3>{{ card.name }}</h3>
            <p class="buy-options-subtitle">{{ setName }}</p>
          </div>
          <div class="buy-options-buttons">
            <a :href="tcgplayerLink" 
               target="_blank" 
               rel="noopener noreferrer"
               class="buy-option-button buy-tcgplayer">
              Buy on TCGplayer
            </a>
            <a :href="ebayLink" 
               target="_blank" 
               rel="noopener noreferrer"
               class="buy-option-button buy-ebay">
              Buy on eBay
            </a>
          </div>
        </div>
      </div>
    </li>
  `,
  computed: {
    displayPrice() {
      // Use TCGplayer market price
      const price = parseFloat(this.card.tcgplayerMarketPrice || 0);
      if (price === 0 || isNaN(price)) {
        return 'N/A';
      }
      return `$ ${this.card.tcgplayerMarketPrice}`;
    },
    imageUrl() {
      // Use TCGplayer image URL from product info
      // Get product ID from card data
      const cardProductId = this.card.tcgplayerProductId;
      if (cardProductId && this.productInfoBySet && this.productInfoBySet[this.setName]) {
        // Convert to string for lookup (object keys are strings)
        const productInfo = this.productInfoBySet[this.setName][String(cardProductId)];
        if (productInfo && productInfo.imageUrl) {
          return productInfo.imageUrl;
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
      // On desktop, return # to trigger modal
      // On mobile/tablet, use # to trigger mobile modal
      return '#';
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
    ebayLink() {
      // Construct eBay search link
      // Format: "Sorcery Contested Realm {set} {card name}"
      const cardName = this.card.name || '';
      const setName = this.setName || '';
      const searchQuery = `Sorcery Contested Realm ${setName} ${cardName}`;
      const encodedQuery = encodeURIComponent(searchQuery);
      return `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}`;
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
        const currentPrice = parseFloat(currentCard.tcgplayerMarketPrice || 0);
        const oldPrice = parseFloat(oldCard.tcgplayerMarketPrice || oldCard.price || 0);

        if (currentPrice > oldPrice) {
          return { arrow: '▲', colorClass: 'price-up', priceChange: currentPrice - oldPrice };
        } else if (currentPrice < oldPrice) {
          return { arrow: '▼', colorClass: 'price-down', priceChange: oldPrice - currentPrice };
        }
      }
      return { arrow: '', colorClass: '', priceChange: 0 };
    },
    handleCardClick(event) {
      event.preventDefault();
      
      if (this.isMobileOrTablet()) {
          // On mobile/tablet, show image modal with card info
          this.showMobileModal(this.imageUrl, this.isFoilPage, this.card.name, this.setName);
      } else {
          // On desktop, show buy options modal directly below the link
          const linkElement = event.currentTarget;
          const linkRect = linkElement.getBoundingClientRect();
          
          // Calculate position: top of modal should be right below the link
          const modalWidth = 400; // max-width of buy-options-content
          const modalHeight = 250; // approximate height
          const padding = 20;
          const gap = 5; // Small gap between link and modal
          
          // Position modal below the link, aligned to left edge of link
          let left = linkRect.left;
          let top = linkRect.bottom + gap;
          
          // Keep modal within viewport bounds horizontally
          if (left < padding) left = padding;
          if (left + modalWidth > window.innerWidth - padding) {
            left = window.innerWidth - modalWidth - padding;
          }
          
          // If modal would go off bottom of screen, position it above the link instead
          if (top + modalHeight > window.innerHeight - padding) {
            top = linkRect.top - modalHeight - gap;
            // If it still doesn't fit above, position at top of viewport
            if (top < padding) {
              top = padding;
            }
          }
          
          this.modalPosition = {
            top: `${top}px`,
            left: `${left}px`
          };
          
          this.showDesktopBuyModal = true;
      }
    },
    hideDesktopBuyModal() {
      this.showDesktopBuyModal = false;
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
