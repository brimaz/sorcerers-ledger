import { CardItem } from './CardItem.js';

export const CardDisplay = {
  props: [
    'setsDataToRender',
    'RARITIES',
    'SET_ICONS',
    'isFoilPage',
    'filterPriceChangeStatus',
    'allOldSetsCardData',
    'allSetsCardData',
    'isGrouped',
    'showHoverImage',
    'hideHoverImage',
    'showMobileModal',
    'tcgplayerTrackingLink',
    'productInfoBySet',
  ],
  template: `
    <div class="card-columns">
      <div v-for="setName in orderedSetNames" :key="setName" class="card-column">
        <div v-if="setsDataToRender[setName] || hasSetData(setName)" class="card-section">
          <h2>
            <span v-if="SET_ICONS[setName]" class="set-icon">{{ SET_ICONS[setName] }}</span>
            {{ setName }}
          </h2>
          <ul v-if="setsDataToRender[setName] && (isGrouped ? hasCardsInGroupedSet(setName) : setsDataToRender[setName].length > 0)">
            <template v-if="isGrouped">
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
                    :showHoverImage="showHoverImage"
                    :hideHoverImage="hideHoverImage"
                    :showMobileModal="showMobileModal"
                    :tcgplayerTrackingLink="tcgplayerTrackingLink"
                    :productInfoBySet="productInfoBySet"
                  />
                </template>
                <li v-else>No cards available for this rarity.</li>
              </template>
            </template>
            <template v-else>
              <CardItem
                v-for="card in setsDataToRender[setName]"
                :key="card.name + card.condition"
                :card="card"
                :setName="setName"
                :isFoilPage="isFoilPage"
                :filterPriceChangeStatus="filterPriceChangeStatus"
                :allOldSetsCardData="allOldSetsCardData"
                :isGrouped="isGrouped"
                :showHoverImage="showHoverImage"
                :hideHoverImage="hideHoverImage"
                :showMobileModal="showMobileModal"
                :tcgplayerTrackingLink="tcgplayerTrackingLink"
                :productInfoBySet="productInfoBySet"
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
      // Define the chronological order of sets
      const setOrder = [
        'Alpha',
        'Beta',
        'Arthurian Legends',
        'Dragonlord'
      ];
      
      // Get all set names from both setsDataToRender and allSetsCardData
      // This ensures we show sets even if they have no cards for the current view
      const setsFromRender = Object.keys(this.setsDataToRender || {});
      const setsFromData = Object.keys(this.allSetsCardData || {});
      const allSetNames = [...new Set([...setsFromRender, ...setsFromData])];
      
      // Sort: first by defined order, then any remaining sets alphabetically
      return setOrder
        .filter(setName => allSetNames.includes(setName))
        .concat(allSetNames.filter(setName => !setOrder.includes(setName)).sort());
    },
  },
  methods: {
    sortedRarities(setCardsData) {
      return this.RARITIES.filter(rarity => setCardsData[rarity] && setCardsData[rarity].length > 0);
    },
    hasSetData(setName) {
      // Check if the set exists in the raw data
      return this.allSetsCardData && this.allSetsCardData[setName] && this.allSetsCardData[setName].length > 0;
    },
    hasCardsInGroupedSet(setName) {
      // Check if there are any cards in the grouped set data
      if (!this.setsDataToRender[setName]) return false;
      for (const rarity in this.setsDataToRender[setName]) {
        if (this.setsDataToRender[setName][rarity] && this.setsDataToRender[setName][rarity].length > 0) {
          return true;
        }
      }
      return false;
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
