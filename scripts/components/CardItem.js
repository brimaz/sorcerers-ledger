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
  ],
  template: `
    <li>
      <span class="card-name">
        <a href="#"
           @mouseover="showHoverImage($event.target, imageUrl, isFoilPage)"
           @mouseleave="hideHoverImage()"
           @click.prevent="handleCardClick()">
          {{ card.name }}
        </a>
        <span v-if="showFluctuation" :class="'price-fluctuation-' + fluctuation.colorClass">{{ fluctuation.arrow }}</span>
      </span>
      <span class="card-price">{{ displayPrice }}</span>
    </li>
  `,
  computed: {
    displayPrice() {
      const price = parseFloat(this.card.price);
      if (price === 0 || isNaN(price)) {
        return 'N/A';
      }
      return `$ ${this.card.price}`;
    },
    imageUrl() {
      // Use local image based on slug
      if (this.card.slug && this.card.set_name) {
        const variant = this.isFoilPage ? 'b_f' : 'b_s';
        const imagePath = `card-data/images/${this.card.set_name}/${variant}/${this.card.slug}_${variant}.png`;
        return imagePath;
      }
      // Return null if image is not available
      return null;
    },
    fluctuation() {
      return this.getPriceFluctuation(this.card, this.setName);
    },
    showFluctuation() {
      return !this.filterPriceChangeStatus || (this.filterPriceChangeStatus && Math.abs(this.fluctuation.priceChange) >= 1);
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
        const currentPrice = parseFloat(currentCard.price.replace(',', ''));
        const oldPrice = parseFloat(oldCard.price.replace(',', ''));

        if (currentPrice > oldPrice) {
          return { arrow: '▲', colorClass: 'price-up', priceChange: currentPrice - oldPrice };
        } else if (currentPrice < oldPrice) {
          return { arrow: '▼', colorClass: 'price-down', priceChange: oldPrice - currentPrice };
        }
      }
      return { arrow: '', colorClass: '', priceChange: 0 };
    },
    handleCardClick() {
      if (this.isMobileOrTablet()) {
          // Use the same imageUrl computed property for mobile modal
          this.showMobileModal(this.imageUrl, this.isFoilPage);
      }
    },
    isMobileOrTablet() {
        return window.innerWidth <= 1024;
    },
  },
};
