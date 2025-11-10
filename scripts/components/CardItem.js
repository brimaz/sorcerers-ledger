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
          {{ card.name }} ({{ card.condition }})
        </a>
        <span v-if="showFluctuation" :class="'price-fluctuation-' + fluctuation.colorClass">{{ fluctuation.arrow }}</span>
      </span>
      <span class="card-price">$ {{ card.price }}</span>
    </li>
  `,
  computed: {
    imageUrl() {
      return this.card.productID ? `https://tcgplayer-cdn.tcgplayer.com/product/${this.card.productID}_in_1000x1000.jpg` : '';
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
          const imageUrlForClick = this.card.productID ? `https://tcgplayer-cdn.tcgplayer.com/product/${this.card.productID}_in_1000x1000.jpg` : '';
          this.showMobileModal(imageUrlForClick, this.isFoilPage);
      }
    },
    isMobileOrTablet() {
        return window.innerWidth <= 1024;
    },
  },
};
