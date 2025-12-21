/**
 * Core Trade Calculator Component
 * 
 * Generic component for evaluating card trades. Provides card search,
 * trade side management (Mine/Theirs), and trade value calculation.
 * Can be extended with game-specific configurations.
 */
import { normalizeToAmericanEnglish } from '/core/frontend/utils/textUtils.js';
import { generateTcgplayerCardLink } from '/core/frontend/utils/cardLinkUtils.js';
import { Info } from 'lucide-vue-next';

export const TradeCalculatorCore = {
  components: {
    Info
  },
  props: {
    gameConfig: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      cardData: {},
      searchQuery: '',
      searchResults: [],
      isSearching: false,
      addToSide: 'mine', // 'mine' or 'theirs'
      myCards: [], // Array of { card, setName, isFoil, quantity }
      theirCards: [], // Array of { card, setName, isFoil, quantity }
      priceType: 'low', // 'low', 'mid', 'high', or 'market'
      tcgplayerTrackingLink: '',
      productInfoBySet: {},
      // Hover image state
      hoverImageUrl: null,
      hoverImagePosition: { top: 0, left: 0 },
      showImageError: false,
      isHoverImageHorizontal: false,
      hoverImageIsFoil: false,
      // Mobile modal state for editing card properties
      editingCard: null, // The card being edited { result, availableSets, selectedSet, isFoil, quantity }
      // Track which fallback tooltip is visible
      visibleFallbackTooltip: null,
      // Track search debounce
      searchTimeout: null
    }
  },
  computed: {
    gameTitle() {
      return this.gameConfig?.GAME_TITLE || "Trade Calculator";
    },
    hasSearchResults() {
      return this.searchResults.length > 0;
    },
    hasMyCards() {
      return this.myCards.length > 0;
    },
    hasTheirCards() {
      return this.theirCards.length > 0;
    }
  },
  async mounted() {
    document.title = `${this.gameTitle} - Trade Calculator`;
    await this.loadCardData();
    // Load TCGplayer data (don't block on it, but start loading)
    this.loadTcgplayerData();
  },
  watch: {
    priceType() {
      // Recalculate totals when price type changes
      // The computed properties will automatically update
    }
  },
  methods: {
    async loadCardData() {
      try {
        const response = await fetch('card-data/card_data.json');
        this.cardData = await response.json();
      } catch (error) {
        console.error('Failed to load card data:', error);
      }
    },
    async loadTcgplayerData() {
      try {
        // Load TCGplayer tracking link
        const configResponse = await fetch('/api/config');
        const config = await configResponse.json();
        this.tcgplayerTrackingLink = config.tcgplayerTrackingLink || '';
        if (!this.tcgplayerTrackingLink) {
          console.warn('TradeCalculatorCore: TCGplayer tracking link is empty or not found in config', { tcgplayerTrackingLink: this.tcgplayerTrackingLink });
        }
      } catch (error) {
        console.warn('TradeCalculatorCore: Failed to load TCGplayer tracking link from /api/config', error);
      }
      
      try {
        // Load product info files for all sets
        const sets = Object.keys(this.cardData);
        const productInfoPromises = sets.map(async (setName) => {
          try {
            // Match the naming convention used by CardOverview: product-info/product_info_${setName}.json
            const response = await fetch(`card-data/product-info/product_info_${setName.replace(/\s+/g, '_')}.json`);
            if (response.ok) {
              const data = await response.json();
              return { setName, data };
            }
          } catch (error) {
            console.warn(`TradeCalculatorCore: Failed to load product info for set "${setName}"`, error);
          }
          return null;
        });
        
        const results = await Promise.all(productInfoPromises);
        const productInfoBySet = {};
        for (const result of results) {
          if (result && result.data) {
            // Convert array to map keyed by productId (same as CardOverview)
            const productMap = {};
            for (const product of result.data) {
              productMap[String(product.productId)] = product;
            }
            productInfoBySet[result.setName] = productMap;
          }
        }
        this.productInfoBySet = productInfoBySet;
      } catch (error) {
        console.warn('TradeCalculatorCore: Failed to process product info files', error);
      }
    },
    getCardImageUrl(cardEntry) {
      // Get TCGplayer image URL from product info
      if (!cardEntry || !cardEntry.setName || !cardEntry.card || !cardEntry.card.tcgplayerProductId) {
        return null;
      }
      
      const cardProductId = cardEntry.card.tcgplayerProductId;
      const setName = cardEntry.setName;
      
      if (!this.productInfoBySet || !this.productInfoBySet[setName]) {
        return null;
      }
      
      const productInfo = this.productInfoBySet[setName][String(cardProductId)];
      if (productInfo && productInfo.imageUrl) {
        // Replace "200w" with "in_1000x1000" for larger hover images
        return productInfo.imageUrl.replace(/200w/g, 'in_1000x1000');
      }
      
      return null;
    },
    handleCardHover(event, cardEntry) {
      const imageUrl = this.getCardImageUrl(cardEntry);
      if (imageUrl) {
        this.showHoverImage(event.target, imageUrl, cardEntry.isFoil);
      }
    },
    showHoverImage(element, imageUrl, isFoil) {
      if (this.isMobileOrTablet() || !imageUrl) return;
      
      const rect = element.getBoundingClientRect();
      this.hoverImagePosition = {
        top: rect.bottom + 5,
        left: rect.left,
      };
      this.hoverImageUrl = imageUrl;
      this.hoverImageIsFoil = isFoil || false;
      this.showImageError = false;
      this.isHoverImageHorizontal = false;
    },
    hideHoverImage() {
      this.hoverImageUrl = null;
      this.showImageError = false;
    },
    handleHoverImageLoad(event) {
      // Check if image is wider than it is tall (horizontal card)
      const img = event.target;
      if (img.naturalWidth > img.naturalHeight) {
        this.isHoverImageHorizontal = true;
      }
    },
    handleImageError() {
      this.showImageError = true;
      this.hoverImageUrl = null;
    },
    getCardLink(cardEntry) {
      // Generate TCGplayer link for a card
      if (!cardEntry || !cardEntry.card || !cardEntry.setName || !cardEntry.card.tcgplayerProductId || !this.tcgplayerTrackingLink) {
        return '#';
      }
      
      return generateTcgplayerCardLink({
        card: cardEntry.card,
        setName: cardEntry.setName,
        cardName: cardEntry.card.name,
        gameConfig: this.gameConfig,
        productInfoBySet: this.productInfoBySet,
        tcgplayerTrackingLink: this.tcgplayerTrackingLink
      });
    },
    isMobileOrTablet() {
      return window.innerWidth <= 768;
    },
    searchCards() {
      // Clear previous timeout
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }

      // Debounce search to avoid excessive searching while typing
      this.searchTimeout = setTimeout(() => {
        this.performSearch();
      }, 200);
    },
    performSearch() {
      const query = this.searchQuery.trim();
      
      if (!query) {
        this.searchResults = [];
        return;
      }

      this.isSearching = true;
      const normalizedQuery = normalizeToAmericanEnglish(query.toLowerCase());
      const results = [];

      // Search through all sets
      for (const setName in this.cardData) {
        const setData = this.cardData[setName];
        if (!setData) continue;

        // Search nonFoil cards (prioritize non-foil)
        if (setData.nonFoil && Array.isArray(setData.nonFoil)) {
          for (const card of setData.nonFoil) {
            if (card && card.name) {
              const normalizedCardName = normalizeToAmericanEnglish(card.name.toLowerCase());
              // Partial match: check if query is contained in card name
              if (normalizedCardName.includes(normalizedQuery)) {
                // Check if we already have this card in results (avoid duplicates)
                const existingResult = results.find(r => 
                  r.card.name === card.name && r.setName === setName && !r.isFoil
                );
                if (!existingResult) {
                  results.push({
                    card: { ...card },
                    setName,
                    isFoil: false
                  });
                }
              }
            }
          }
        }

        // Search foil cards - always add them so foil data is available in the modal
        // They'll be grouped with non-foil versions in the next step
        if (setData.foil && Array.isArray(setData.foil)) {
          for (const card of setData.foil) {
            if (card && card.name) {
              // Strip "(Foil)" from the card name before normalizing for comparison
              const cardNameWithoutFoil = card.name.replace(/\s*\(Foil\)\s*/gi, '').trim();
              const normalizedCardName = normalizeToAmericanEnglish(cardNameWithoutFoil.toLowerCase());
              // Partial match: check if query is contained in card name
              if (normalizedCardName.includes(normalizedQuery)) {
                // Always add foil cards to results (they'll be grouped with non-foil)
                // Check if we already have this foil card in results
                const existingResult = results.find(r => 
                  r.card.name === card.name && r.setName === setName && r.isFoil
                );
                if (!existingResult) {
                  results.push({
                    card: { ...card },
                    setName,
                    isFoil: true
                  });
                }
              }
            }
          }
        }
      }

      // Group results by card name (normalized, removing "(Foil)" suffix)
      // This ensures foil and non-foil versions of the same card are grouped together
      const groupedResults = {};
      for (const result of results) {
        // Normalize card name by removing "(Foil)" suffix for grouping
        const normalizedCardName = result.card.name.replace(/\s*\(Foil\)\s*/gi, '').trim();
        
        if (!groupedResults[normalizedCardName]) {
          groupedResults[normalizedCardName] = {
            cardName: normalizedCardName,
            availableSets: {}
          };
        }
        // Store both foil and non-foil versions for each set
        if (!groupedResults[normalizedCardName].availableSets[result.setName]) {
          groupedResults[normalizedCardName].availableSets[result.setName] = {
            nonFoil: null,
            foil: null
          };
        }
        if (result.isFoil) {
          groupedResults[normalizedCardName].availableSets[result.setName].foil = result.card;
        } else {
          groupedResults[normalizedCardName].availableSets[result.setName].nonFoil = result.card;
        }
      }

      // Convert grouped results back to array, sorted by card name
      const sortedGroupedResults = Object.keys(groupedResults)
        .sort((a, b) => {
          const aName = normalizeToAmericanEnglish(a.toLowerCase());
          const bName = normalizeToAmericanEnglish(b.toLowerCase());
          const queryLower = normalizedQuery;
          
          // Exact match gets priority
          const aExact = aName === queryLower;
          const bExact = bName === queryLower;
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          
          // Then sort by name
          if (aName < bName) return -1;
          if (aName > bName) return 1;
          return 0;
        })
        .map(cardName => ({
          cardName,
          availableSets: groupedResults[cardName].availableSets
        }));

      this.searchResults = sortedGroupedResults;
      this.isSearching = false;
    },
    getMostRecentSet(availableSets) {
      /**
       * Find the most recent set from available sets based on SET_ORDER.
       * Returns the set name that appears last in SET_ORDER, or the first available set if none match.
       */
      const setOrder = this.gameConfig?.SET_ORDER || [];
      const setNames = Object.keys(availableSets);
      
      if (setOrder.length === 0) {
        // No SET_ORDER defined, return first available set
        return setNames[0];
      }
      
      // Find the most recent set (last in SET_ORDER that exists in availableSets)
      let mostRecentSet = null;
      let mostRecentIndex = -1;
      
      for (const setName of setNames) {
        const index = setOrder.indexOf(setName);
        if (index !== -1 && index > mostRecentIndex) {
          mostRecentIndex = index;
          mostRecentSet = setName;
        }
      }
      
      // If we found a set in SET_ORDER, return it; otherwise return first available
      return mostRecentSet || setNames[0];
    },
    getCardImageForSearchResult(result) {
      // Get the most recent set's non-foil image for a search result (prefer non-foil, fallback to foil)
      // This is used for the mobile image grid display
      if (!result || !result.availableSets) return null;
      
      const mostRecentSet = this.getMostRecentSet(result.availableSets);
      if (!mostRecentSet) return null;
      
      const setData = result.availableSets[mostRecentSet];
      // Prefer non-foil for search results display, but use foil if non-foil doesn't exist
      const card = setData?.nonFoil || setData?.foil;
      if (!card || !card.tcgplayerProductId) return null;
      
      return this.getCardImageForSet(result, mostRecentSet, !setData?.nonFoil); // Use foil only if non-foil doesn't exist
    },
    getCardImageForSet(result, setName, isFoil) {
      // Get card image for a specific set and foil/non-foil version
      if (!result || !result.availableSets || !result.availableSets[setName]) {
        return null;
      }
      
      const setData = result.availableSets[setName];
      const card = isFoil ? setData.foil : setData.nonFoil;
      
      if (!card || !card.tcgplayerProductId) {
        return null;
      }
      
      if (!this.productInfoBySet || !this.productInfoBySet[setName]) {
        return null;
      }
      
      const productId = String(card.tcgplayerProductId);
      const productInfo = this.productInfoBySet[setName][productId];
      
      if (productInfo && productInfo.imageUrl) {
        // Replace "200w" with "in_1000x1000" for larger images
        return productInfo.imageUrl.replace(/200w/g, 'in_1000x1000');
      }
      
      return null;
    },
    openCardEditModal(result) {
      // Open modal to edit card properties
      const availableSets = Object.keys(result.availableSets);
      const mostRecentSet = this.getMostRecentSet(result.availableSets);
      
      this.editingCard = {
        cardName: result.cardName,
        availableSets: availableSets,
        selectedSet: mostRecentSet,
        isFoil: false, // Default to non-foil
        quantity: 1,
        availableSetsData: result.availableSets
      };
    },
    closeCardEditModal() {
      this.editingCard = null;
    },
    getSelectedCard() {
      // Get the card object for the currently selected set and foil/non-foil
      if (!this.editingCard) return null;
      
      const setData = this.editingCard.availableSetsData[this.editingCard.selectedSet];
      if (!setData) return null;
      
      return this.editingCard.isFoil ? setData.foil : setData.nonFoil;
    },
    getSelectedCardImage() {
      // Get the image URL for the currently selected card
      if (!this.editingCard) return null;
      
      return this.getCardImageForSet(
        { availableSets: this.editingCard.availableSetsData },
        this.editingCard.selectedSet,
        this.editingCard.isFoil
      );
    },
    confirmAddCard() {
      // Add the card to the trade with the selected properties
      const card = this.getSelectedCard();
      if (!card) return;
      
      const cardEntry = {
        card: { ...card },
        setName: this.editingCard.selectedSet,
        isFoil: this.editingCard.isFoil,
        quantity: this.editingCard.quantity
      };

      if (this.addToSide === 'mine') {
        // Check if card already exists in myCards
        const existingIndex = this.myCards.findIndex(c => 
          c.card.name === this.editingCard.cardName && 
          c.setName === this.editingCard.selectedSet && 
          c.isFoil === this.editingCard.isFoil
        );
        
        if (existingIndex >= 0) {
          // Increment quantity
          this.myCards[existingIndex].quantity += this.editingCard.quantity;
        } else {
          // Add new card
          this.myCards.push(cardEntry);
        }
      } else {
        // Check if card already exists in theirCards
        const existingIndex = this.theirCards.findIndex(c => 
          c.card.name === this.editingCard.cardName && 
          c.setName === this.editingCard.selectedSet && 
          c.isFoil === this.editingCard.isFoil
        );
        
        if (existingIndex >= 0) {
          // Increment quantity
          this.theirCards[existingIndex].quantity += this.editingCard.quantity;
        } else {
          // Add new card
          this.theirCards.push(cardEntry);
        }
      }

      // Close modal and clear search
      this.closeCardEditModal();
      this.searchQuery = '';
      this.searchResults = [];
    },
    toggleSide(event) {
      // Toggle based on checkbox state
      this.addToSide = event.target.checked ? 'theirs' : 'mine';
    },
    addCardToTrade(result) {
      // Always open the edit modal (both desktop and mobile)
      this.openCardEditModal(result);
    },
    removeCardFromTrade(cardEntry, side) {
      if (side === 'mine') {
        const index = this.myCards.findIndex(c => 
          c.card.name === cardEntry.card.name && 
          c.setName === cardEntry.setName && 
          c.isFoil === cardEntry.isFoil
        );
        if (index >= 0) {
          if (this.myCards[index].quantity > 1) {
            this.myCards[index].quantity -= 1;
          } else {
            this.myCards.splice(index, 1);
          }
        }
      } else {
        const index = this.theirCards.findIndex(c => 
          c.card.name === cardEntry.card.name && 
          c.setName === cardEntry.setName && 
          c.isFoil === cardEntry.isFoil
        );
        if (index >= 0) {
          if (this.theirCards[index].quantity > 1) {
            this.theirCards[index].quantity -= 1;
          } else {
            this.theirCards.splice(index, 1);
          }
        }
      }
    },
    getCardPrice(cardEntry) {
      // Map price type to TCGplayer price field
      const priceFieldMap = {
        'low': 'tcgplayerLowPrice',
        'mid': 'tcgplayerMidPrice',
        'high': 'tcgplayerHighPrice',
        'market': 'tcgplayerMarketPrice'
      };
      const priceField = priceFieldMap[this.priceType] || 'tcgplayerLowPrice';
      const price = parseFloat(cardEntry.card[priceField] || 0);
      return isNaN(price) ? 0 : price;
    },
    getCardPriceForResult(result, setName, isFoil) {
      // Get price for a card in search results
      if (!result || !result.availableSets || !result.availableSets[setName]) {
        return { price: 0, usingFallback: false, fallbackReason: '' };
      }
      
      const setData = result.availableSets[setName];
      const card = isFoil ? setData.foil : setData.nonFoil;
      if (!card) {
        return { price: 0, usingFallback: false, fallbackReason: '' };
      }
      
      const priceFieldMap = {
        'low': 'tcgplayerLowPrice',
        'mid': 'tcgplayerMidPrice',
        'high': 'tcgplayerHighPrice',
        'market': 'tcgplayerMarketPrice'
      };
      const priceField = priceFieldMap[this.priceType] || 'tcgplayerLowPrice';
      
      let usingFallback = false;
      let fallbackReason = '';
      let priceValue = card[priceField] || '0';
      
      // Special handling for market price: if it's 0, TCGplayer doesn't track it
      if (this.priceType === 'market') {
        const marketPriceStr = card.tcgplayerMarketPrice;
        const marketPrice = marketPriceStr ? parseFloat(marketPriceStr) : 0;
        // Check if market price is missing, null, undefined, empty string, "0", "0.00", or parses to 0
        if (!marketPriceStr || 
            marketPriceStr === '0' || 
            marketPriceStr === '0.00' || 
            marketPrice === 0 || 
            isNaN(marketPrice)) {
          // Market price is 0, meaning TCGplayer doesn't track it
          // Fall back to low price
          priceValue = card.tcgplayerLowPrice || '0';
          usingFallback = true;
          fallbackReason = 'Market price not tracked by TCGplayer, using TCGplayer Low price';
        } else {
          // Market price exists, use it
          priceValue = card.tcgplayerMarketPrice || '0';
        }
      } else if (!priceValue || parseFloat(priceValue) === 0) {
        // For other price types, fall back to low price if missing/0
        priceValue = card.tcgplayerLowPrice || '0';
        if (this.priceType === 'mid' && (!card.tcgplayerMidPrice || parseFloat(card.tcgplayerMidPrice) === 0)) {
          usingFallback = true;
          fallbackReason = 'Mid price not available, using TCGplayer Low price';
        } else if (this.priceType === 'high' && (!card.tcgplayerHighPrice || parseFloat(card.tcgplayerHighPrice) === 0)) {
          usingFallback = true;
          fallbackReason = 'High price not available, using TCGplayer Low price';
        }
      }
      
      const price = parseFloat(priceValue) || 0;
      return { 
        price: isNaN(price) ? 0 : price, 
        usingFallback, 
        fallbackReason 
      };
    },
    getCardPriceInfo() {
      // Get price info for the currently selected card in the modal
      if (!this.editingCard) return { price: 0, usingFallback: false, fallbackReason: '' };
      
      return this.getCardPriceForResult(
        { availableSets: this.editingCard.availableSetsData },
        this.editingCard.selectedSet,
        this.editingCard.isFoil
      );
    },
    toggleFallbackTooltip() {
      // Toggle the fallback tooltip (for mobile)
      if (this.isMobileOrTablet()) {
        this.visibleFallbackTooltip = this.visibleFallbackTooltip === 'modal' ? null : 'modal';
      }
    },
    showFallbackTooltip() {
      // Show the fallback tooltip (for desktop)
      if (!this.isMobileOrTablet()) {
        this.visibleFallbackTooltip = 'modal';
      }
    },
    hideFallbackTooltip() {
      // Hide the fallback tooltip (for desktop)
      if (!this.isMobileOrTablet()) {
        this.visibleFallbackTooltip = null;
      }
    },
    getTotalValue(cards) {
      return cards.reduce((total, cardEntry) => {
        const price = this.getCardPrice(cardEntry);
        return total + (price * cardEntry.quantity);
      }, 0);
    },
    getMyTotal() {
      return this.getTotalValue(this.myCards);
    },
    getTheirTotal() {
      return this.getTotalValue(this.theirCards);
    },
    getTradeDifference() {
      return this.getTheirTotal() - this.getMyTotal();
    },
    formatPrice(price) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(price);
    }
  },
  template: `
    <div class="trade-calculator-container">
      <h1>Trade Calculator</h1>
      
      <div class="calculator-section">
        <!-- Price Type Selector -->
        <div class="price-type-selector">
          <label for="price-type">Price Type:</label>
          <select id="price-type" v-model="priceType">
            <option value="low">Low</option>
            <option value="mid">Mid</option>
            <option value="high">High</option>
            <option value="market">Market</option>
          </select>
        </div>

        <!-- Search Section -->
        <div class="trade-search-section">
          <label for="card-search" class="search-label">Search for a card:</label>
          <input
            id="card-search"
            type="text"
            v-model="searchQuery"
            @input="searchCards"
            placeholder="Enter card name..."
            class="card-search-input"
          />
        </div>

        <!-- Toggle Slider -->
        <div class="trade-toggle-section">
          <div class="toggle-container">
            <span class="toggle-label" :class="{ active: addToSide === 'mine' }">Add to Mine</span>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="addToSide === 'theirs'"
                @change="toggleSide($event)"
              />
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label" :class="{ active: addToSide === 'theirs' }">Add to Theirs</span>
          </div>
        </div>

        <!-- Search Results -->
        <div v-if="hasSearchResults" class="search-results-section">
          <h3>Search Results</h3>
          <!-- Image-based results for both desktop and mobile -->
          <div class="search-results-grid">
            <div
              v-for="(result, index) in searchResults"
              :key="index"
              class="search-result-card"
              @click="addCardToTrade(result)"
            >
              <div class="search-result-image-wrapper">
                <img 
                  v-if="getCardImageForSearchResult(result)"
                  :src="getCardImageForSearchResult(result)"
                  :alt="result.cardName"
                  class="search-result-image"
                  @mouseover="!isMobileOrTablet() && handleCardHover($event, { card: (result.availableSets[getMostRecentSet(result.availableSets)]?.nonFoil || result.availableSets[getMostRecentSet(result.availableSets)]?.foil), setName: getMostRecentSet(result.availableSets), isFoil: false })"
                  @mouseleave="!isMobileOrTablet() && hideHoverImage()"
                />
                <div v-else class="search-result-image-placeholder">
                  {{ result.cardName }}
                </div>
              </div>
              <div class="search-result-card-name">
                <a 
                  v-if="!isMobileOrTablet()"
                  :href="getCardLink({ card: (result.availableSets[getMostRecentSet(result.availableSets)]?.nonFoil || result.availableSets[getMostRecentSet(result.availableSets)]?.foil), setName: getMostRecentSet(result.availableSets), isFoil: false })"
                  target="_blank"
                  rel="noopener noreferrer"
                  @mouseover="handleCardHover($event, { card: (result.availableSets[getMostRecentSet(result.availableSets)]?.nonFoil || result.availableSets[getMostRecentSet(result.availableSets)]?.foil), setName: getMostRecentSet(result.availableSets), isFoil: false })"
                  @mouseleave="hideHoverImage()"
                  @click.stop>
                  {{ result.cardName }}
                </a>
                <span v-else>{{ result.cardName }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Trade Summary -->
        <div class="trade-summary-section">
          <div class="trade-side mine-side">
            <h3>My Cards</h3>
            <div v-if="hasMyCards" class="trade-cards-list">
              <div
                v-for="(cardEntry, index) in myCards"
                :key="index"
                class="trade-card-item"
              >
                <div class="card-info">
                  <div class="card-name">
                    <a 
                      v-if="!isMobileOrTablet()"
                      :href="getCardLink(cardEntry)"
                      target="_blank"
                      rel="noopener noreferrer"
                      @mouseover="handleCardHover($event, cardEntry)"
                      @mouseleave="hideHoverImage()"
                      @click.stop>
                      {{ cardEntry.card.name }}
                    </a>
                    <span v-else>{{ cardEntry.card.name }}</span>
                  </div>
                  <div class="card-details">
                    <span>{{ cardEntry.setName }}</span>
                    <span v-if="cardEntry.isFoil" class="foil-badge">Foil</span>
                    <span class="card-price">{{ formatPrice(getCardPrice(cardEntry)) }}</span>
                  </div>
                </div>
                <div class="card-quantity-controls">
                  <span class="quantity">Qty: {{ cardEntry.quantity }}</span>
                  <button
                    @click.stop="removeCardFromTrade(cardEntry, 'mine')"
                    class="remove-card-btn"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="empty-trade-side">
              <p>No cards added yet</p>
            </div>
            <div class="side-total">
              <strong>Total: {{ formatPrice(getMyTotal()) }}</strong>
            </div>
          </div>

          <div class="trade-side theirs-side">
            <h3>Their Cards</h3>
            <div v-if="hasTheirCards" class="trade-cards-list">
              <div
                v-for="(cardEntry, index) in theirCards"
                :key="index"
                class="trade-card-item"
              >
                <div class="card-info">
                  <div class="card-name">
                    <a 
                      v-if="!isMobileOrTablet()"
                      :href="getCardLink(cardEntry)"
                      target="_blank"
                      rel="noopener noreferrer"
                      @mouseover="handleCardHover($event, cardEntry)"
                      @mouseleave="hideHoverImage()"
                      @click.stop>
                      {{ cardEntry.card.name }}
                    </a>
                    <span v-else>{{ cardEntry.card.name }}</span>
                  </div>
                  <div class="card-details">
                    <span>{{ cardEntry.setName }}</span>
                    <span v-if="cardEntry.isFoil" class="foil-badge">Foil</span>
                    <span class="card-price">{{ formatPrice(getCardPrice(cardEntry)) }}</span>
                  </div>
                </div>
                <div class="card-quantity-controls">
                  <span class="quantity">Qty: {{ cardEntry.quantity }}</span>
                  <button
                    @click.stop="removeCardFromTrade(cardEntry, 'theirs')"
                    class="remove-card-btn"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="empty-trade-side">
              <p>No cards added yet</p>
            </div>
            <div class="side-total">
              <strong>Total: {{ formatPrice(getTheirTotal()) }}</strong>
            </div>
          </div>
        </div>

        <!-- Trade Difference -->
        <div v-if="hasMyCards || hasTheirCards" class="trade-difference-section">
          <div class="difference-display" :class="{ positive: getTradeDifference() > 0, negative: getTradeDifference() < 0, even: getTradeDifference() === 0 }">
            <h3>Trade Difference</h3>
            <div class="difference-amount">
              {{ formatPrice(Math.abs(getTradeDifference())) }}
              <span v-if="getTradeDifference() > 0" class="difference-label">in your favor</span>
              <span v-else-if="getTradeDifference() < 0" class="difference-label">in their favor</span>
              <span v-else class="difference-label">even trade</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Hover Image -->
      <div v-if="hoverImageUrl !== null && hoverImageUrl !== ''" 
           class="hover-image show-hover-image"
           :class="{ 'hover-image-horizontal': isHoverImageHorizontal }"
           :style="{ position: 'fixed', top: hoverImagePosition.top + 'px', left: hoverImagePosition.left + 'px', zIndex: 1000 }">
        <div v-if="hoverImageUrl && hoverImageIsFoil" class="foil-image-wrapper">
          <img :src="hoverImageUrl" 
               alt="Card Image"
               @error="handleImageError"
               @load="handleHoverImageLoad">
        </div>
        <img v-else-if="hoverImageUrl" 
             :src="hoverImageUrl" 
             alt="Card Image"
             @error="handleImageError"
             @load="handleHoverImageLoad">
        <div v-if="showImageError" class="hover-image-text">Image Not Available</div>
      </div>

      <!-- Card Edit Modal (Desktop and Mobile) -->
      <div 
        v-if="editingCard"
        class="mobile-card-modal-overlay"
        @click="closeCardEditModal">
        <div class="mobile-card-modal-content" @click.stop>
          <button class="mobile-card-modal-close" @click="closeCardEditModal">
            <img src="assets/sl-modal-close.png" alt="Close">
          </button>
          
          <!-- Card Image -->
          <div class="modal-image-container">
            <div v-if="getSelectedCardImage() && editingCard.isFoil" class="foil-image-wrapper">
              <img 
                :src="getSelectedCardImage()" 
                alt="Card Image" 
                class="modal-image"
                oncontextmenu="return false;">
            </div>
            <img 
              v-else-if="getSelectedCardImage()" 
              :src="getSelectedCardImage()" 
              alt="Card Image" 
              class="modal-image"
              oncontextmenu="return false;">
            <div v-if="!getSelectedCardImage()" class="modal-no-image-text">Image Not Available</div>
          </div>
          
          <!-- Card Properties -->
          <div class="mobile-card-modal-grid">
            <div class="mobile-card-modal-item">
              <div class="mobile-card-modal-label">Card Name</div>
              <div class="mobile-card-modal-value">{{ editingCard.cardName }}</div>
            </div>
            
            <div class="mobile-card-modal-item">
              <div class="mobile-card-modal-label">Set</div>
              <div class="mobile-card-modal-value">
                <select 
                  v-if="editingCard.availableSets.length > 1"
                  v-model="editingCard.selectedSet"
                  class="set-selector">
                  <option v-for="setName in editingCard.availableSets" :key="setName" :value="setName">
                    {{ setName }}
                  </option>
                </select>
                <span v-else>{{ editingCard.selectedSet }}</span>
              </div>
            </div>
            
            <div class="mobile-card-modal-item">
              <div class="mobile-card-modal-label">Version</div>
              <div class="mobile-card-modal-value">
                <div class="foil-toggle-container">
                  <span class="foil-toggle-label-left">Non-Foil</span>
                  <label class="foil-toggle-switch">
                    <input
                      type="checkbox"
                      v-model="editingCard.isFoil"
                    />
                    <span class="foil-toggle-slider"></span>
                  </label>
                  <span class="foil-toggle-label-right">Foil</span>
                </div>
              </div>
            </div>
            
            <div class="mobile-card-modal-item">
              <div class="mobile-card-modal-label">Quantity</div>
              <div class="mobile-card-modal-value">
                <input
                  type="number"
                  v-model.number="editingCard.quantity"
                  min="1"
                  class="quantity-input"
                />
              </div>
            </div>
            
            <div class="mobile-card-modal-item">
              <div class="mobile-card-modal-label">Price</div>
              <div class="mobile-card-modal-value">
                <div v-if="getCardPriceInfo().usingFallback" class="price-with-fallback-wrapper">
                  <span class="price-with-fallback-text">
                    {{ formatPrice(getCardPriceInfo().price) }}
                  </span>
                  <div class="price-fallback-info-container">
                    <span 
                      class="price-fallback-info-icon"
                      @click="toggleFallbackTooltip()"
                      @mouseenter="showFallbackTooltip()"
                      @mouseleave="hideFallbackTooltip()">
                      <Info :size="16" />
                    </span>
                    <div 
                      v-if="visibleFallbackTooltip === 'modal'"
                      class="price-fallback-tooltip">
                      {{ getCardPriceInfo().fallbackReason }}
                    </div>
                  </div>
                </div>
                <span v-else>{{ formatPrice(getCardPriceInfo().price) }}</span>
              </div>
            </div>
            
            <div class="mobile-card-modal-item">
              <div class="mobile-card-modal-label">Add To</div>
              <div class="mobile-card-modal-value">
                <div class="toggle-container">
                  <span class="toggle-label" :class="{ active: addToSide === 'mine' }">Mine</span>
                  <label class="toggle-switch">
                    <input
                      type="checkbox"
                      :checked="addToSide === 'theirs'"
                      @change="toggleSide($event)"
                    />
                    <span class="toggle-slider"></span>
                  </label>
                  <span class="toggle-label" :class="{ active: addToSide === 'theirs' }">Theirs</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Done Button -->
          <div class="mobile-card-modal-actions">
            <button @click="confirmAddCard" class="done-button">Done</button>
          </div>
        </div>
      </div>
    </div>
  `
}

