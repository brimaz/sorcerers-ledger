import { CardItem } from './CardItem.js';

export const CardDisplay = {
  props: {
    setsDataToRender: { type: Object, default: () => ({}) },
    RARITIES: { type: Array, default: () => [] },
    SET_ICONS: { type: Object, default: () => ({}) },
    SET_ORDER: { type: Array, default: () => [] },
    excludedSets: { type: Array, default: () => [] },
    excludedRarities: { type: Array, default: () => [] },
    isFoilPage: { type: Boolean, default: false },
    isPreconPage: { type: Boolean, default: false },
    isSealedPage: { type: Boolean, default: false },
    filterPriceChangeStatus: { type: Boolean, default: false },
    allOldSetsCardData: { type: Object, default: () => ({}) },
    allSetsCardData: { type: Object, default: () => ({}) },
    allSetsCardDataByName: { type: Object, default: () => ({}) },
    isGrouped: { type: Boolean, default: true },
    priceType: { type: String, default: 'low' },
    sortBy: { type: String, default: 'price-desc' },
    showHoverImage: { type: Function },
    hideHoverImage: { type: Function },
    showMobileModal: { type: Function },
    tcgplayerTrackingLink: { type: String, default: '' },
    productInfoBySet: { type: Object, default: () => ({}) },
    setSlugMap: { type: Object, default: () => ({}) },
    tcgplayerCategorySlug: { type: String, default: 'sorcery-contested-realm' },
  },
  template: `
    <div class="card-columns">
      <div v-for="setName in orderedSetNames" :key="setName" class="card-column">
        <div v-if="setsDataToRender[setName] || hasSetData(setName)" class="card-section">
          <h2>
            <span v-if="SET_ICONS && SET_ICONS[setName]" class="set-icon">{{ SET_ICONS[setName] }}</span>
            {{ setName }}
          </h2>
          <ul v-if="setsDataToRender[setName] && ((isPreconstructedSet(setName) || isSealedSet(setName)) ? (isPreconstructedSet(setName) ? hasPreconstructedCards(setName) : hasSealedCards(setName)) : (isGrouped ? hasCardsInGroupedSet(setName) : setsDataToRender[setName].length > 0))">
            <template v-if="isGrouped && !isPreconstructedSet(setName) && !isSealedSet(setName)">
              <template v-for="rarity in sortedRarities(setsDataToRender[setName])">
                <h3 class="rarity-subheader">{{ setName }} - {{ rarity }}</h3>
                <template v-if="setsDataToRender[setName][rarity] && setsDataToRender[setName][rarity].length > 0">
                  <CardItem
                    v-for="card in setsDataToRender[setName][rarity]"
                    :key="card.name + card.condition"
                    :card="card"
                    :setName="setName"
                    :isFoilPage="isFoilPage"
                    :filterPriceChangeStatus="filterPriceChangeStatus"
                    :allOldSetsCardData="allOldSetsCardData"
                    :isGrouped="isGrouped"
                    :priceType="priceType"
                    :showHoverImage="showHoverImage"
                    :hideHoverImage="hideHoverImage"
                    :showMobileModal="showMobileModal"
                    :tcgplayerTrackingLink="tcgplayerTrackingLink"
                    :productInfoBySet="productInfoBySet"
                    :setSlugMap="setSlugMap"
                    :tcgplayerCategorySlug="tcgplayerCategorySlug"
                  />
                </template>
                <li v-else>No cards available for this rarity.</li>
              </template>
            </template>
            <template v-else>
              <CardItem
                v-for="card in getCardsForSet(setName)"
                :key="card.name + card.condition"
                :card="card"
                :setName="setName"
                :isFoilPage="isFoilPage"
                :filterPriceChangeStatus="filterPriceChangeStatus"
                :allOldSetsCardData="allOldSetsCardData"
                :isGrouped="isGrouped"
                :priceType="priceType"
                :showHoverImage="showHoverImage"
                :hideHoverImage="hideHoverImage"
                :showMobileModal="showMobileModal"
                    :tcgplayerTrackingLink="tcgplayerTrackingLink"
                    :productInfoBySet="productInfoBySet"
                    :setSlugMap="setSlugMap"
                    :tcgplayerCategorySlug="tcgplayerCategorySlug"
              />
            </template>
          </ul>
          <ul v-else>
            <li>{{ getNoCardsMessage(setName) }}</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  components: {
    CardItem,
  },
  computed: {
    orderedSetNames() {
      // Use set order from config
      const setOrder = this.SET_ORDER || [];
      
      // Get all set names from both setsDataToRender and allSetsCardData
      // This ensures we show sets even if they have no cards for the current view
      const setsFromRender = Object.keys(this.setsDataToRender || {});
      const setsFromData = Object.keys(this.allSetsCardData || {});
      const allSetNames = [...new Set([...setsFromRender, ...setsFromData])];
      
      // Filter sets based on page type
      let filteredSetNames = allSetNames;
      if (this.isFoilPage) {
        // On foil page, exclude preconstructed and sealed sets
        filteredSetNames = allSetNames.filter(setName => !setName.includes('(Preconstructed)'));
      } else if (this.isPreconPage) {
        // On precon page, only show preconstructed sets
        filteredSetNames = allSetNames.filter(setName => setName.includes('(Preconstructed)'));
      } else if (this.isSealedPage) {
        // On sealed page, show all sets (only sets with sealed products are loaded)
        filteredSetNames = allSetNames;
      } else {
        // On non-foil page, exclude preconstructed sets (they're on their own page now)
        // Sealed products are already excluded since we don't load them on non-foil page
        filteredSetNames = allSetNames.filter(setName => !setName.includes('(Preconstructed)'));
      }

      // Sort: first by defined order, then any remaining sets alphabetically
      const ordered = setOrder
        .filter(setName => filteredSetNames.includes(setName));
      const remaining = filteredSetNames
        .filter(setName => !setOrder.includes(setName))
        .sort();
      const allOrdered = ordered.concat(remaining);

      // Apply inclusion filters: if the user has selected any sets,
      // only show those selected sets. If none are selected, show all.
      if (!Array.isArray(this.excludedSets) || this.excludedSets.length === 0) {
        return allOrdered;
      }
      return allOrdered.filter(setName => this.isSetIncluded(setName));
    },
  },
  methods: {
    sortedRarities(setCardsData) {
      // Get all rarities that have cards, plus "Pledge Pack" if it exists
      const rarities = this.RARITIES.filter(
        rarity =>
          setCardsData[rarity] &&
          setCardsData[rarity].length > 0 &&
          this.isRarityIncluded(rarity)
      );
      // Add "Pledge Pack" at the end if it exists
      if (
        setCardsData['Pledge Pack'] &&
        setCardsData['Pledge Pack'].length > 0 &&
        this.isRarityIncluded('Pledge Pack')
      ) {
        rarities.push('Pledge Pack');
      }
      return rarities;
    },
    hasSetData(setName) {
      // Check if the set exists in the raw data
      return this.allSetsCardData && this.allSetsCardData[setName] && this.allSetsCardData[setName].length > 0;
    },
    hasCardsInGroupedSet(setName) {
      // Check if there are any cards in the grouped set data (including Pledge Pack section)
      if (!this.setsDataToRender[setName]) return false;
      for (const rarity in this.setsDataToRender[setName]) {
        if (this.setsDataToRender[setName][rarity] && this.setsDataToRender[setName][rarity].length > 0) {
          return true;
        }
      }
      return false;
    },
    isPreconstructedSet(setName) {
      return setName && setName.includes('(Preconstructed)');
    },
    isSealedSet(setName) {
      // Sealed sets are identified by checking if we're on the sealed page and the set has sealed products
      // Since on sealed page we only load sets with sealed products, all sets are sealed sets
      return this.isSealedPage;
    },
    hasPreconstructedCards(setName) {
      // For preconstructed sets, always check allSetsCardData (flat array) regardless of grouped mode
      return this.allSetsCardData && this.allSetsCardData[setName] && this.allSetsCardData[setName].length > 0;
    },
    hasSealedCards(setName) {
      // For sealed sets, always check allSetsCardData (flat array) regardless of grouped mode
      return this.allSetsCardData && this.allSetsCardData[setName] && this.allSetsCardData[setName].length > 0;
    },
    getCardsForSet(setName) {
      // For preconstructed and sealed sets: when not grouped, use setsDataToRender (sorted)
      // When grouped, setsDataToRender is an object, so sort allSetsCardData based on sortBy
      // For other sets, use setsDataToRender (which may be grouped or flat depending on isGrouped)
      if (this.isPreconstructedSet(setName) || this.isSealedSet(setName)) {
        // Check if setsDataToRender is an array (not grouped) - if so, use it for sorting
        const renderData = this.setsDataToRender[setName];
        if (Array.isArray(renderData)) {
          return this.filterCardsByRarity(renderData);
        }
        // Otherwise (grouped mode), sort the data based on sortBy
        const cards = this.allSetsCardData && this.allSetsCardData[setName] ? this.allSetsCardData[setName] : [];
        if (cards.length === 0) return [];
        
        const priceField = this.getPriceFieldName(this.priceType);
        
        let sortedCards;
        if (this.sortBy === 'name-asc') {
          // Use the pre-sorted by name array if available
          sortedCards = this.allSetsCardDataByName && this.allSetsCardDataByName[setName] 
            ? this.allSetsCardDataByName[setName] 
            : [...cards].sort((a, b) => {
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
              });
        } else if (this.sortBy === 'name-desc') {
          // Use the pre-sorted by name array and reverse it
          const sortedByName = this.allSetsCardDataByName && this.allSetsCardDataByName[setName] 
            ? this.allSetsCardDataByName[setName] 
            : [...cards].sort((a, b) => {
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
              });
          sortedCards = [...sortedByName].reverse();
        } else if (this.sortBy === 'price-asc') {
          sortedCards = [...cards].sort((a, b) => parseFloat(a[priceField] || 0) - parseFloat(b[priceField] || 0));
        } else {
          // price-desc (default)
          sortedCards = [...cards].sort((a, b) => parseFloat(b[priceField] || 0) - parseFloat(a[priceField] || 0));
        }

        return this.filterCardsByRarity(sortedCards);
      }
      const cardsForSet = this.setsDataToRender[setName] || [];
      return this.filterCardsByRarity(cardsForSet);
    },
    getPriceFieldName(priceType) {
      const priceFieldMap = {
        'low': 'tcgplayerLowPrice',
        'mid': 'tcgplayerMidPrice',
        'high': 'tcgplayerHighPrice',
        'market': 'tcgplayerMarketPrice'
      };
      return priceFieldMap[priceType] || 'tcgplayerLowPrice';
    },
    isSetIncluded(setName) {
      // Inclusion model: if no sets are selected, all are included.
      if (!Array.isArray(this.excludedSets) || this.excludedSets.length === 0) return true;
      return this.excludedSets.includes(setName);
    },
    isRarityIncluded(rarity) {
      // Inclusion model: if no rarities are selected, all are included.
      if (this.isPreconPage || this.isSealedPage) return true;
      if (!Array.isArray(this.excludedRarities) || this.excludedRarities.length === 0) return true;
      return this.excludedRarities.includes(rarity);
    },
    filterCardsByRarity(cards) {
      if (!Array.isArray(cards)) return cards;
      if (this.isPreconPage || this.isSealedPage) return cards;
      if (!this.excludedRarities || this.excludedRarities.length === 0) return cards;
      return cards.filter(card => this.isRarityIncluded(card.rarity));
    },
    getNoCardsMessage(setName) {
      // Check if the set has cards for the current view type
      const hasCardsForCurrentView = this.allSetsCardData && 
        this.allSetsCardData[setName] && 
        this.allSetsCardData[setName].length > 0;
      
      if (!hasCardsForCurrentView) {
        // No cards for current view - show specific message
        return this.isFoilPage ? 'No Foil cards in this set.' : 'No Non-Foil cards in this set.';
      }
      return 'No cards available for this set.';
    },
    applyMasonryLayout() {
      this.$nextTick(() => {
        const container = this.$el;
        if (!container) return;
        
        const items = container.querySelectorAll('.card-column');
        if (items.length === 0) return;
        
        // Reset any previous positioning
        items.forEach(item => {
          item.style.position = '';
          item.style.top = '';
          item.style.left = '';
        });
        
        // Get container width and calculate column width
        // Account for padding (20px on each side = 40px total)
        const containerPadding = 40;
        const containerWidth = container.offsetWidth - containerPadding;
        const gap = 20;
        const minColumnWidth = 350;
        const numColumns = Math.max(1, Math.floor((containerWidth + gap) / (minColumnWidth + gap)));
        const columnWidth = (containerWidth - (gap * (numColumns - 1))) / numColumns;
        
        // Initialize column heights
        const columnHeights = new Array(numColumns).fill(0);
        
        // Position each item
        items.forEach((item, index) => {
          // Find the shortest column
          const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights));
          
          // Position the item (account for container padding)
          item.style.position = 'absolute';
          item.style.width = `${columnWidth}px`;
          item.style.left = `${20 + shortestColumnIndex * (columnWidth + gap)}px`;
          item.style.top = `${columnHeights[shortestColumnIndex]}px`;
          
          // Update column height
          columnHeights[shortestColumnIndex] += item.offsetHeight + gap;
        });
        
        // Set container height to accommodate all items
        const maxHeight = Math.max(...columnHeights);
        container.style.position = 'relative';
        container.style.height = `${maxHeight}px`;
      });
    },
  },
  mounted() {
    this.applyMasonryLayout();
    // Reapply on window resize
    window.addEventListener('resize', this.applyMasonryLayout);
  },
  updated() {
    this.applyMasonryLayout();
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.applyMasonryLayout);
  },
};
