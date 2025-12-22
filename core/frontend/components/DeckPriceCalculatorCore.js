 /**
  * Core Deck Price Calculator Component
  * 
  * Generic component that handles generic TCG deck list parsing
  * and price calculation. Can be extended with other game-specific formatting logic.
  * 
  * Supported Formats:
  * 
  * Format 2 (Generic): Simple quantity and card name
  *   1 Card Name
  *   2 Another Card
  *   3 Third Card
  * 
  * Format 3 (Generic): Quantity with 'x' separator
  *   2x Card Name
  *   3x Another Card
  *   1x Third Card
  * 
  * Format 1 (Game-Specific): Requires format1Config prop
  *   Format 1 parsing is game-specific and requires configuration via the format1Config prop.
  *   Example for Sorcery TCG:
  *     Avatar (1)
  *     1Magician
  *     Aura (3)
  *     3Thunderstorm
  *     Artifact (7)
  *     1Amethyst Core
  *     1Onyx Core
  * 
  * The component automatically detects which format is being used and handles parsing accordingly.
  * Format 1 requires the "Format Decklist" button to convert to Format 2 before calculation.
  */
import { normalizeToAmericanEnglish } from '/core/frontend/utils/textUtils.js';
import { generateTcgplayerCardLink } from '/core/frontend/utils/cardLinkUtils.js';
import { formatPrice, getSelectedCurrency } from '/core/frontend/utils/currencyUtils.js';
import { ArrowUpDown, ArrowUp, ArrowDown, Info } from 'lucide-vue-next';

export const DeckPriceCalculatorCore = {
  components: {
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Info
  },
  props: {
    gameConfig: {
      type: Object,
      default: () => ({})
    },
    // Optional Format 1 configuration for game-specific parsing
    format1Config: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      deckInput: '',
      formattedDeck: '',
      calculationResult: null,
      cardData: {},
      priceType: 'low',
      defaultFoilPreference: 'non-foil', // 'non-foil' or 'foil'
      isFormatting: false,
      isCalculating: false,
      errors: [],
      showSampleDecklist: false,
      tcgplayerTrackingLink: '',
      productInfoBySet: {},
      // Hover image state
      hoverImageUrl: null,
      hoverImagePosition: { top: 0, left: 0 },
      showImageError: false,
      isHoverImageHorizontal: false,
      hoverImageIsFoil: false,
      // Mobile modal image state
      mobileModalImageUrl: null,
      mobileModalImageUrlNext: null, // For preloading next image
      mobileModalIsFoil: false,
      mobileModalIsHorizontal: false,
      showModalImageError: false,
      isPreloadingModalImage: false,
      // Track selected set and foil/non-foil for each card
      // Structure: { cardKey: { selectedSet: string, isFoil: boolean } }
      // For split cards, cardKey includes index: "cardName:split:index"
      cardSelections: {},
      // Track which cards have been split
      // Structure: { cardName: true } - indicates this card has been split
      splitCards: {},
      // Store original selections before splitting (for reset functionality)
      // Structure: { cardName: { selectedSet: string, isFoil: boolean } }
      originalSelections: {},
      // Sorting state
      sortColumn: null,
      sortDirection: 'asc', // 'asc' or 'desc'
      // Track which fallback tooltip is visible (for mobile)
      visibleFallbackTooltip: null,
      // Track which card's modal is open (for mobile)
      openCardModal: null,
      // Currency state
      selectedCurrency: getSelectedCurrency()
    }
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
  computed: {
    gameTitle() {
      return this.gameConfig?.GAME_TITLE || "Deck Price Calculator";
    },
    hasFormat1Config() {
      return this.format1Config !== null && this.format1Config !== undefined;
    },
    needsFormatting() {
      if (!this.hasFormat1Config) {
        return false;
      }
      // Check if input looks like Format 1 (has section headers)
      const lines = this.deckInput.trim().split('\n').filter(line => line.trim());
      const pattern = this.format1Config.sectionHeaderPattern;
      return lines.some(line => {
        const trimmed = line.trim();
        return pattern && pattern.test(trimmed);
      });
    },
    canCalculate() {
      // Can calculate if:
      // 1. Input exists and doesn't need formatting (Format 2 or 3), OR
      // 2. Formatted deck exists (Format 1 was formatted)
      const hasInput = this.deckInput.trim().length > 0;
      const hasFormatted = this.formattedDeck.trim().length > 0;
      return hasInput && (!this.needsFormatting || hasFormatted);
    },
    placeholderText() {
      if (this.hasFormat1Config && this.format1Config.placeholderText) {
        return this.format1Config.placeholderText;
      }
      return this.hasFormat1Config 
        ? 'Paste deck list here (supports 3 formats)\n\nFormat 1: With section headers\nFormat 2: \'1 Card Name\'\nFormat 3: \'2x Card Name\''
        : 'Paste deck list here (supports 2 formats)\n\nFormat 1: \'1 Card Name\'\nFormat 2: \'2x Card Name\'';
    },
    formatButtonText() {
      if (this.hasFormat1Config && this.format1Config.formatButtonText) {
        return this.format1Config.formatButtonText;
      }
      return 'Format Decklist';
    },
    sampleDecklist() {
      if (this.hasFormat1Config && this.format1Config.sampleDecklist) {
        return this.format1Config.sampleDecklist;
      }
      return null;
    },
    hasSampleDecklist() {
      return this.sampleDecklist !== null && this.sampleDecklist !== undefined;
    },
    sampleDecklistButtonText() {
      if (this.hasFormat1Config && this.format1Config.sampleDecklistButtonText) {
        return this.format1Config.sampleDecklistButtonText;
      }
      return 'Show Sample Decklist';
    },
    hideSampleDecklistButtonText() {
      if (this.hasFormat1Config && this.format1Config.hideSampleDecklistButtonText) {
        return this.format1Config.hideSampleDecklistButtonText;
      }
      // Default: replace "Show" with "Hide" in the button text
      return this.sampleDecklistButtonText.replace(/^Show\s+/i, 'Hide ');
    },
    sortedCardDetails() {
      if (!this.calculationResult || !this.calculationResult.cardDetails) {
        return [];
      }
      
      if (!this.sortColumn) {
        return this.calculationResult.cardDetails;
      }
      
      const details = [...this.calculationResult.cardDetails];
      const direction = this.sortDirection === 'asc' ? 1 : -1;
      
      details.sort((a, b) => {
        let aVal, bVal;
        
        switch (this.sortColumn) {
          case 'quantity':
            aVal = a.quantity;
            bVal = b.quantity;
            break;
          case 'cardName':
            aVal = a.cardName.toLowerCase();
            bVal = b.cardName.toLowerCase();
            break;
          case 'set':
            aVal = a.selectedSet.toLowerCase();
            bVal = b.selectedSet.toLowerCase();
            break;
          case 'unitPrice':
            aVal = a.unitPrice;
            bVal = b.unitPrice;
            break;
          case 'lineTotal':
            aVal = a.lineTotal;
            bVal = b.lineTotal;
            break;
          default:
            return 0;
        }
        
        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        return 0;
      });
      
      return details;
    },
    currentModalDetail() {
      if (this.openCardModal === null || !this.sortedCardDetails || !this.sortedCardDetails[this.openCardModal]) {
        return null;
      }
      return this.sortedCardDetails[this.openCardModal];
    }
  },
  async mounted() {
    document.title = `${this.gameTitle} - Deck Price Calculator`;
    await this.loadCardData();
    // Load TCGplayer data (don't block on it, but start loading)
    this.loadTcgplayerData();
    // Close tooltip when clicking outside (for mobile)
    document.addEventListener('click', this.handleDocumentClick);
    // Listen for currency changes
    window.addEventListener('currency-changed', this.handleCurrencyChange);
    window.addEventListener('currency-updated', this.handleCurrencyUpdate);
  },
  beforeUnmount() {
    // Clean up event listener
    document.removeEventListener('click', this.handleDocumentClick);
    window.removeEventListener('currency-changed', this.handleCurrencyChange);
    window.removeEventListener('currency-updated', this.handleCurrencyUpdate);
  },
  watch: {
    deckInput() {
      // If the user modifies the input after formatting, clear the formatted deck
      // and calculation result so they need to format again
      if (this.formattedDeck.trim().length > 0) {
        this.formattedDeck = '';
        this.calculationResult = null;
        this.errors = [];
      }
    },
    tcgplayerTrackingLink() {
      // When tracking link loads, recalculate to update links
      if (this.calculationResult) {
        this.recalculateTotals();
      }
    }
  },
  watch: {
    priceType() {
      // Recalculate totals when price type changes (if calculation result exists)
      if (this.calculationResult) {
        this.recalculateTotals();
      }
    },
    openCardModal(newIndex) {
      // Update image when modal opens
      if (newIndex !== null && this.isMobileOrTablet()) {
        this.updateModalImage();
      } else if (newIndex === null) {
        // Clear image when modal closes
        this.mobileModalImageUrl = null;
        this.mobileModalImageUrlNext = null;
        this.mobileModalIsFoil = false;
        this.mobileModalIsHorizontal = false;
        this.showModalImageError = false;
        this.isPreloadingModalImage = false;
      }
    },
    cardSelections: {
      handler() {
        // Update image when card selection changes (set or foil/non-foil) - only if modal is open
        if (this.openCardModal !== null && this.isMobileOrTablet()) {
          // Use nextTick to avoid flicker - update after Vue has processed the changes
          this.$nextTick(() => {
            this.updateModalImage();
          });
        }
      },
      deep: true
    }
  },
  methods: {
    handleCurrencyChange(event) {
      this.selectedCurrency = event.detail.currency;
      this.$forceUpdate();
    },
    handleCurrencyUpdate() {
      this.selectedCurrency = getSelectedCurrency();
      this.$forceUpdate();
    },
    formatPrice(price) {
      return formatPrice(price, { currency: this.selectedCurrency });
    },
    async loadCardData() {
      try {
        const response = await fetch('card-data/card_data.json');
        this.cardData = await response.json();
      } catch (error) {
        this.errors.push('Failed to load card data. Please refresh the page.');
      }
    },
    async loadTcgplayerData() {
      try {
        // Load TCGplayer tracking link
        const configResponse = await fetch('/api/config');
        const config = await configResponse.json();
        this.tcgplayerTrackingLink = config.tcgplayerTrackingLink || '';
        if (!this.tcgplayerTrackingLink) {
          console.warn('DeckPriceCalculatorCore: TCGplayer tracking link is empty or not found in config', { tcgplayerTrackingLink: this.tcgplayerTrackingLink });
        }
      } catch (error) {
        console.warn('DeckPriceCalculatorCore: Failed to load TCGplayer tracking link from /api/config', error);
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
            console.warn(`DeckPriceCalculatorCore: Failed to load product info for set "${setName}"`, error);
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
        console.warn('DeckPriceCalculatorCore: Failed to process product info files', error);
      }
    },
    getCardLink(detail) {
      // Generate TCGplayer link for a card based on selected set and foil/non-foil
      if (!detail || !detail.card || !detail.selectedSet || !detail.card.tcgplayerProductId || !this.tcgplayerTrackingLink) {
        return '#';
      }
      
      return generateTcgplayerCardLink({
        card: detail.card,
        setName: detail.selectedSet,
        cardName: detail.cardName,
        gameConfig: this.gameConfig,
        productInfoBySet: this.productInfoBySet,
        tcgplayerTrackingLink: this.tcgplayerTrackingLink
      });
    },
    getCardImageUrl(detail) {
      // Get TCGplayer image URL from product info
      // Use the currently selected card (foil/non-foil) based on user's selection
      if (!detail || !detail.selectedSet || !detail.allMatches) {
        return null;
      }
      
      // Get the currently selected card (foil or non-foil) based on user's selection
      const cardKey = detail.isSplit 
        ? `${detail.originalCardKey}:split:${detail.splitIndex}`
        : detail.cardName;
      
      const selectedSet = this.cardSelections[cardKey]?.selectedSet || detail.selectedSet;
      const isFoil = this.cardSelections[cardKey]?.isFoil !== undefined 
        ? this.cardSelections[cardKey].isFoil 
        : detail.isFoil;
      
      // Get the selected card (foil or non-foil)
      const selectedCard = isFoil 
        ? detail.allMatches[selectedSet]?.foil 
        : detail.allMatches[selectedSet]?.nonFoil;
      
      if (!selectedCard || !selectedCard.tcgplayerProductId) {
        return null;
      }
      
      const cardProductId = selectedCard.tcgplayerProductId;
      
      if (!this.productInfoBySet || !this.productInfoBySet[selectedSet]) {
        return null;
      }
      
      const productInfo = this.productInfoBySet[selectedSet][String(cardProductId)];
      if (productInfo && productInfo.imageUrl) {
        // Replace "200w" with "in_1000x1000" for larger hover images
        return productInfo.imageUrl.replace(/200w/g, 'in_1000x1000');
      }
      
      return null;
    },
    handleCardHover(event, detail) {
      const imageUrl = this.getCardImageUrl(detail);
      if (imageUrl) {
        // Get the current isFoil selection (may have changed since detail was created)
        const cardKey = detail.isSplit 
          ? `${detail.originalCardKey}:split:${detail.splitIndex}`
          : detail.cardName;
        const isFoil = this.cardSelections[cardKey]?.isFoil !== undefined 
          ? this.cardSelections[cardKey].isFoil 
          : detail.isFoil;
        this.showHoverImage(event.target, imageUrl, isFoil);
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
    },
    formatDecklist() {
      if (!this.hasFormat1Config) {
        this.errors.push('Format 1 is not configured for this game.');
        return;
      }
      
      this.isFormatting = true;
      this.errors = [];
      
      try {
        const lines = this.deckInput.trim().split('\n');
        const cardQuantities = {};
        const sectionsToIgnore = this.format1Config.sectionsToIgnore || [];
        const sectionPattern = this.format1Config.sectionHeaderPattern;
        
        // First pass: collect all cards and combine quantities for duplicates
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          // Check if this is a section header - if so, skip it but continue parsing cards
          if (sectionPattern && sectionPattern.test(trimmed)) {
            // Skip the section header but continue to parse cards below it
            continue;
          }
          
          // Parse card line - Format 1 can have patterns like:
          // "1Magician"
          // "3Thunderstorm"
          // "1Amethyst Core"
          // "1" (standalone number, might be continuation)
          // "3Toolbox"
          // "2"
          // "1Chains of Prometheus"
          // "4"
          
          // Try to match quantity and card name
          const cardMatch = trimmed.match(/^(\d+)(.+)$/);
          if (cardMatch) {
            const quantity = parseInt(cardMatch[1], 10);
            const cardName = cardMatch[2].trim();
            if (cardName) {
              // Accumulate quantities for the same card
              if (cardQuantities[cardName]) {
                cardQuantities[cardName] += quantity;
              } else {
                cardQuantities[cardName] = quantity;
              }
            }
          } else if (/^\d+$/.test(trimmed)) {
            // Standalone number - might be a continuation, but we'll skip it
            // as it's ambiguous in Format 1
            continue;
          } else {
            // Just a card name without quantity - treat as quantity 1
            const cardName = trimmed.trim();
            if (cardName) {
              // Accumulate quantities for the same card
              if (cardQuantities[cardName]) {
                cardQuantities[cardName] += 1;
              } else {
                cardQuantities[cardName] = 1;
              }
            }
          }
        }
        
        // Second pass: format combined cards into lines
        const formattedLines = [];
        for (const cardName in cardQuantities) {
          formattedLines.push(`${cardQuantities[cardName]} ${cardName}`);
        }
        
        this.formattedDeck = formattedLines.join('\n');
      } catch (error) {
        this.errors.push('Error formatting decklist. Please check the format.');
      } finally {
        this.isFormatting = false;
      }
    },
    findAllCardsByName(cardName) {
      /**
       * Find all cards matching the given name across all sets.
       * Returns an object with set names as keys and card info as values.
       * Each set can have both foil and nonFoil versions.
       * This method fetches BOTH foil and non-foil prices for every set the card exists in.
       */
      const normalizedSearchName = normalizeToAmericanEnglish(cardName.trim().toLowerCase());
      const matches = {};
      
      for (const setName in this.cardData) {
        const setData = this.cardData[setName];
        if (!setData) continue;
        
        const setMatches = {
          nonFoil: null,
          foil: null
        };
        
        // Check nonFoil - get prices for non-foil version
        if (setData.nonFoil && Array.isArray(setData.nonFoil)) {
          for (const card of setData.nonFoil) {
            if (card && card.name) {
              const normalizedCardName = normalizeToAmericanEnglish(card.name.toLowerCase());
              if (normalizedCardName === normalizedSearchName) {
                setMatches.nonFoil = { ...card, setName };
                break;
              }
            }
          }
        }
        
        // Check foil - get prices for foil version
        // Foil cards may have "(Foil)" in their name, so we need to strip that when comparing
        if (setData.foil && Array.isArray(setData.foil)) {
          for (const card of setData.foil) {
            if (card && card.name) {
              // Strip "(Foil)" from the card name before normalizing for comparison
              const cardNameWithoutFoil = card.name.replace(/\s*\(Foil\)\s*/gi, '').trim();
              const normalizedCardName = normalizeToAmericanEnglish(cardNameWithoutFoil.toLowerCase());
              if (normalizedCardName === normalizedSearchName) {
                setMatches.foil = { ...card, setName };
                break;
              }
            }
          }
        }
        
        // Only add to matches if at least one version exists
        // Note: We include sets even if only one version exists, so users can see all available sets
        if (setMatches.nonFoil || setMatches.foil) {
          matches[setName] = setMatches;
        }
      }
      
      return Object.keys(matches).length > 0 ? matches : null;
    },
    getMostRecentSet(availableSets) {
      /**
       * Find the most recent set from available sets based on SET_ORDER.
       * Returns the set name that appears last in SET_ORDER, or the first available set if none match.
       */
      const setOrder = this.gameConfig?.SET_ORDER || [];
      if (setOrder.length === 0) {
        // No SET_ORDER defined, return first available set
        return availableSets[0];
      }
      
      // Find the most recent set (last in SET_ORDER that exists in availableSets)
      let mostRecentSet = null;
      let mostRecentIndex = -1;
      
      for (const setName of availableSets) {
        const index = setOrder.indexOf(setName);
        if (index !== -1 && index > mostRecentIndex) {
          mostRecentIndex = index;
          mostRecentSet = setName;
        }
      }
      
      // If we found a set in SET_ORDER, return it; otherwise return first available
      return mostRecentSet || availableSets[0];
    },
    processCardDetail(cardName, cardKey, quantity, allMatches, availableSets, priceField) {
      /**
       * Process a single card detail and return the detail object.
       * Used for both split and non-split cards.
       */
      const selectedSet = this.cardSelections[cardKey]?.selectedSet;
      const isFoil = this.cardSelections[cardKey]?.isFoil !== undefined 
        ? this.cardSelections[cardKey].isFoil 
        : false;
      
      const selectedCard = isFoil 
        ? allMatches[selectedSet]?.foil 
        : allMatches[selectedSet]?.nonFoil;
      
      // If selected version doesn't exist, fall back to available version
      const card = selectedCard || allMatches[selectedSet]?.nonFoil || allMatches[selectedSet]?.foil;
      
      if (!card) {
        return null;
      }
      
      // Check if we're using a fallback price (when requested price type is missing/0)
      let priceValue = card[priceField];
      let usingFallback = false;
      let fallbackReason = '';
      
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
      const lineTotal = quantity * price;
      
      // Determine available versions for the selected set
      const hasNonFoil = allMatches[selectedSet]?.nonFoil !== null;
      const hasFoil = allMatches[selectedSet]?.foil !== null;
      const hasBoth = hasNonFoil && hasFoil;
      
      // Check if card has both versions in ANY set (for toggle display)
      let hasBothInAnySet = false;
      for (const setName of availableSets) {
        const setData = allMatches[setName];
        if (setData && setData.nonFoil && setData.foil) {
          hasBothInAnySet = true;
          break;
        }
      }
      
      return {
        cardName: cardName,
        quantity: quantity,
        unitPrice: price,
        lineTotal: lineTotal,
        availableSets: availableSets,
        allMatches: allMatches,
        selectedSet: selectedSet,
        isFoil: isFoil,
        hasNonFoil: hasNonFoil,
        hasFoil: hasFoil,
        hasBoth: hasBoth,
        hasBothInAnySet: hasBothInAnySet,
        card: card,
        usingFallback: usingFallback,
        fallbackReason: fallbackReason
      };
    },
    getMostRecentSetWithNonFoil(availableSets, allMatches) {
      /**
       * Find the most recent set where non-foil exists, based on SET_ORDER.
       * Returns the set name that appears last in SET_ORDER and has non-foil available.
       * Falls back to first available set with non-foil if none match SET_ORDER.
       */
      const setOrder = this.gameConfig?.SET_ORDER || [];
      
      // First, find sets that have non-foil
      const setsWithNonFoil = availableSets.filter(setName => 
        allMatches[setName] && allMatches[setName].nonFoil !== null
      );
      
      if (setsWithNonFoil.length === 0) {
        // No sets have non-foil, return null (caller should handle this)
        return null;
      }
      
      if (setOrder.length === 0) {
        // No SET_ORDER defined, return first set with non-foil
        return setsWithNonFoil[0];
      }
      
      // Find the most recent set with non-foil (last in SET_ORDER that has non-foil)
      let mostRecentSet = null;
      let mostRecentIndex = -1;
      
      for (const setName of setsWithNonFoil) {
        const index = setOrder.indexOf(setName);
        if (index !== -1 && index > mostRecentIndex) {
          mostRecentIndex = index;
          mostRecentSet = setName;
        }
      }
      
      // If we found a set in SET_ORDER with non-foil, return it; otherwise return first available with non-foil
      return mostRecentSet || setsWithNonFoil[0];
    },
    getMostRecentSetWithFoil(availableSets, allMatches) {
      /**
       * Find the most recent set where foil exists, based on SET_ORDER.
       * Returns the set name that appears last in SET_ORDER and has foil available.
       * Falls back to first available set with foil if none match SET_ORDER.
       */
      const setOrder = this.gameConfig?.SET_ORDER || [];
      
      // First, find sets that have foil
      const setsWithFoil = availableSets.filter(setName => 
        allMatches[setName] && allMatches[setName].foil !== null
      );
      
      if (setsWithFoil.length === 0) {
        // No sets have foil, return null (caller should handle this)
        return null;
      }
      
      if (setOrder.length === 0) {
        // No SET_ORDER defined, return first set with foil
        return setsWithFoil[0];
      }
      
      // Find the most recent set with foil (last in SET_ORDER that has foil)
      let mostRecentSet = null;
      let mostRecentIndex = -1;
      
      for (const setName of setsWithFoil) {
        const index = setOrder.indexOf(setName);
        if (index !== -1 && index > mostRecentIndex) {
          mostRecentIndex = index;
          mostRecentSet = setName;
        }
      }
      
      // If we found a set in SET_ORDER, return it; otherwise return first available
      return mostRecentSet || setsWithFoil[0];
    },
    parseDeckEntry(line) {
      const trimmed = line.trim();
      if (!trimmed) return null;
      
      // Format 2: "1 Card 1" or "2 Card 2"
      let match = trimmed.match(/^(\d+)\s+(.+)$/);
      if (match) {
        return {
          quantity: parseInt(match[1], 10),
          cardName: match[2].trim()
        };
      }
      
      // Format 3: "2x Card 1" or "2x Card 2"
      match = trimmed.match(/^(\d+)\s*x\s+(.+)$/i);
      if (match) {
        return {
          quantity: parseInt(match[1], 10),
          cardName: match[2].trim()
        };
      }
      
      return null;
    },
    calculatePrice() {
      this.isCalculating = true;
      this.errors = [];
      this.calculationResult = null;
      
      // Use setTimeout to ensure Vue updates the DOM to show loading state
      // Small delay ensures the loading indicator is visible even for fast calculations
      setTimeout(() => {
        this.performCalculation();
      }, 15);
    },
    performCalculation() {
      try {
        // Use formatted deck if available, otherwise use input (for Format 2/3)
        const deckText = this.formattedDeck.trim() || this.deckInput.trim();
        const lines = deckText.split('\n');
        const priceFieldMap = {
          'low': 'tcgplayerLowPrice',
          'mid': 'tcgplayerMidPrice',
          'high': 'tcgplayerHighPrice',
          'market': 'tcgplayerMarketPrice'
        };
        const priceField = priceFieldMap[this.priceType] || 'tcgplayerLowPrice';
        
        const notFoundCards = [];
        const cardDetails = [];
        
        // First pass: collect all entries and combine quantities for duplicate cards
        const cardQuantities = {};
        const cardEntries = {};
        
        for (const line of lines) {
          const entry = this.parseDeckEntry(line);
          if (!entry) continue;
          
          const cardKey = entry.cardName;
          
          // Accumulate quantities for the same card
          if (cardQuantities[cardKey]) {
            cardQuantities[cardKey] += entry.quantity;
          } else {
            cardQuantities[cardKey] = entry.quantity;
            cardEntries[cardKey] = entry;
          }
        }
        
        // Second pass: process each unique card with combined quantity
        for (const cardKey in cardQuantities) {
          const totalQuantity = cardQuantities[cardKey];
          const entry = cardEntries[cardKey];
          
          const allMatches = this.findAllCardsByName(entry.cardName);
          if (!allMatches) {
            notFoundCards.push(entry.cardName);
            continue;
          }
          
          // Get available sets
          const availableSets = Object.keys(allMatches);
          
          // Check if this card has been split
          const isSplit = this.splitCards[cardKey] === true;
          
          if (isSplit && totalQuantity > 1) {
            // Card has been split - create individual rows for each copy
            for (let i = 0; i < totalQuantity; i++) {
              const splitCardKey = `${cardKey}:split:${i}`;
              
              // Initialize selection for this split card if not exists
              if (!this.cardSelections[splitCardKey]) {
                const preferFoil = this.defaultFoilPreference === 'foil';
                if (preferFoil) {
                  const mostRecentSetWithFoil = this.getMostRecentSetWithFoil(availableSets, allMatches);
                  if (mostRecentSetWithFoil) {
                    this.cardSelections[splitCardKey] = {
                      selectedSet: mostRecentSetWithFoil,
                      isFoil: true
                    };
                  } else {
                    const mostRecentSetWithNonFoil = this.getMostRecentSetWithNonFoil(availableSets, allMatches);
                    if (mostRecentSetWithNonFoil) {
                      this.cardSelections[splitCardKey] = {
                        selectedSet: mostRecentSetWithNonFoil,
                        isFoil: false
                      };
                    } else {
                      const mostRecentSet = this.getMostRecentSet(availableSets);
                      this.cardSelections[splitCardKey] = {
                        selectedSet: mostRecentSet,
                        isFoil: false
                      };
                    }
                  }
                } else {
                  const mostRecentSetWithNonFoil = this.getMostRecentSetWithNonFoil(availableSets, allMatches);
                  if (mostRecentSetWithNonFoil) {
                    this.cardSelections[splitCardKey] = {
                      selectedSet: mostRecentSetWithNonFoil,
                      isFoil: false
                    };
                  } else {
                    const mostRecentSetWithFoil = this.getMostRecentSetWithFoil(availableSets, allMatches);
                    if (mostRecentSetWithFoil) {
                      this.cardSelections[splitCardKey] = {
                        selectedSet: mostRecentSetWithFoil,
                        isFoil: true
                      };
                    } else {
                      const mostRecentSet = this.getMostRecentSet(availableSets);
                      this.cardSelections[splitCardKey] = {
                        selectedSet: mostRecentSet,
                        isFoil: false
                      };
                    }
                  }
                }
              }
              
              // Process this split card
              const detail = this.processCardDetail(
                entry.cardName,
                splitCardKey,
                1, // quantity is always 1 for split cards
                allMatches,
                availableSets,
                priceField
              );
              
              if (detail) {
                detail.isSplit = true;
                detail.splitIndex = i;
                detail.originalCardKey = cardKey;
                detail.originalCardName = entry.cardName;
                cardDetails.push(detail);
              }
            }
          } else {
            // Card not split - create single row
            // Initialize selection for this card if not exists
            if (!this.cardSelections[cardKey]) {
              const preferFoil = this.defaultFoilPreference === 'foil';
              if (preferFoil) {
                const mostRecentSetWithFoil = this.getMostRecentSetWithFoil(availableSets, allMatches);
                if (mostRecentSetWithFoil) {
                  this.cardSelections[cardKey] = {
                    selectedSet: mostRecentSetWithFoil,
                    isFoil: true
                  };
                } else {
                  const mostRecentSetWithNonFoil = this.getMostRecentSetWithNonFoil(availableSets, allMatches);
                  if (mostRecentSetWithNonFoil) {
                    this.cardSelections[cardKey] = {
                      selectedSet: mostRecentSetWithNonFoil,
                      isFoil: false
                    };
                  } else {
                    const mostRecentSet = this.getMostRecentSet(availableSets);
                    this.cardSelections[cardKey] = {
                      selectedSet: mostRecentSet,
                      isFoil: false
                    };
                  }
                }
              } else {
                const mostRecentSetWithNonFoil = this.getMostRecentSetWithNonFoil(availableSets, allMatches);
                if (mostRecentSetWithNonFoil) {
                  this.cardSelections[cardKey] = {
                    selectedSet: mostRecentSetWithNonFoil,
                    isFoil: false
                  };
                } else {
                  const mostRecentSetWithFoil = this.getMostRecentSetWithFoil(availableSets, allMatches);
                  if (mostRecentSetWithFoil) {
                    this.cardSelections[cardKey] = {
                      selectedSet: mostRecentSetWithFoil,
                      isFoil: true
                    };
                  } else {
                    const mostRecentSet = this.getMostRecentSet(availableSets);
                    this.cardSelections[cardKey] = {
                      selectedSet: mostRecentSet,
                      isFoil: false
                    };
                  }
                }
              }
            }
            
            // Store original selection if not already stored (for reset functionality)
            if (!this.originalSelections[cardKey]) {
              this.originalSelections[cardKey] = {
                selectedSet: this.cardSelections[cardKey].selectedSet,
                isFoil: this.cardSelections[cardKey].isFoil
              };
            }
            
            // Process this card
            const detail = this.processCardDetail(
              entry.cardName,
              cardKey,
              totalQuantity,
              allMatches,
              availableSets,
              priceField
            );
            
            if (detail) {
              detail.isSplit = false;
              cardDetails.push(detail);
            }
          }
        }
        
        // Calculate total
        const totalPrice = cardDetails.reduce((sum, item) => sum + item.lineTotal, 0);
        
        this.calculationResult = {
          totalPrice: totalPrice,
          cardDetails: cardDetails,
          notFoundCards: notFoundCards,
          totalCards: cardDetails.reduce((sum, item) => sum + item.quantity, 0)
        };
        
        if (notFoundCards.length > 0) {
          this.errors.push(`Could not find prices for ${notFoundCards.length} card(s): ${notFoundCards.join(', ')}`);
        }
      } catch (error) {
        this.errors.push('Error calculating price. Please check the deck list format.');
      } finally {
        this.isCalculating = false;
      }
    },
    updateCardSelection(cardKey, set, isFoil) {
      // Update selection and recalculate
      // cardKey can be either the original card name or a split card key (cardName:split:index)
      if (!this.cardSelections[cardKey]) {
        this.cardSelections[cardKey] = {};
      }
      if (set !== undefined) {
        this.cardSelections[cardKey].selectedSet = set;
        // When changing sets, check if the selected version exists in the new set
        // If not, switch to available version
        const detail = this.calculationResult?.cardDetails.find(d => {
          const dCardKey = this.getCardKey(d);
          return dCardKey === cardKey;
        });
        if (detail && detail.allMatches[set]) {
          const hasNonFoil = detail.allMatches[set].nonFoil !== null;
          const hasFoil = detail.allMatches[set].foil !== null;
          // If current selection doesn't exist in new set, switch to available version
          if (this.cardSelections[cardKey].isFoil && !hasFoil) {
            this.cardSelections[cardKey].isFoil = false;
          } else if (!this.cardSelections[cardKey].isFoil && !hasNonFoil) {
            this.cardSelections[cardKey].isFoil = true;
          }
        }
      }
      if (isFoil !== undefined) {
        this.cardSelections[cardKey].isFoil = isFoil;
      }
      
      // Preserve modal state before recalculating
      const wasModalOpen = this.openCardModal !== null;
      const modalIndex = this.openCardModal;
      
      // Recalculate totals - this will update the detail objects which should trigger re-render
      this.recalculateTotals();
      
      // Restore modal state after recalculation - modal should stay open
      if (wasModalOpen && modalIndex !== null) {
        // Modal stays open, just update the image after Vue processes the changes
        this.$nextTick(() => {
          this.updateModalImage();
        });
      }
    },
    splitCard(cardName) {
      // Store original selection before splitting if not already stored
      if (!this.originalSelections[cardName] && this.cardSelections[cardName]) {
        this.originalSelections[cardName] = {
          selectedSet: this.cardSelections[cardName].selectedSet,
          isFoil: this.cardSelections[cardName].isFoil
        };
      }
      // Mark card as split and trigger recalculation
      this.splitCards[cardName] = true;
      // Recalculate to show split rows
      this.performCalculation();
    },
    unsplitCard(cardName) {
      // Remove from split cards
      delete this.splitCards[cardName];
      
      // Restore original selection if available
      if (this.originalSelections[cardName]) {
        this.cardSelections[cardName] = {
          selectedSet: this.originalSelections[cardName].selectedSet,
          isFoil: this.originalSelections[cardName].isFoil
        };
      }
      
      // Remove all split card selections
      const splitKeys = Object.keys(this.cardSelections).filter(key => 
        key.startsWith(`${cardName}:split:`)
      );
      for (const key of splitKeys) {
        delete this.cardSelections[key];
      }
      
      // Recalculate to show single row again
      this.performCalculation();
    },
    recalculateTotals() {
      if (!this.calculationResult) return;
      
      const priceFieldMap = {
        'low': 'tcgplayerLowPrice',
        'mid': 'tcgplayerMidPrice',
        'high': 'tcgplayerHighPrice',
        'market': 'tcgplayerMarketPrice'
      };
      const priceField = priceFieldMap[this.priceType] || 'tcgplayerLowPrice';
      
      let totalPrice = 0;
      
      for (const detail of this.calculationResult.cardDetails) {
        // Determine the card key (original or split)
        const cardKey = detail.isSplit 
          ? `${detail.originalCardKey}:split:${detail.splitIndex}`
          : detail.cardName;
        
        const selectedSet = this.cardSelections[cardKey]?.selectedSet || detail.selectedSet;
        const isFoil = this.cardSelections[cardKey]?.isFoil !== undefined 
          ? this.cardSelections[cardKey].isFoil 
          : detail.isFoil;
        
        const selectedCard = isFoil 
          ? detail.allMatches[selectedSet]?.foil 
          : detail.allMatches[selectedSet]?.nonFoil;
        
        const card = selectedCard || detail.allMatches[selectedSet]?.nonFoil || detail.allMatches[selectedSet]?.foil;
        
        // Check if we're using a fallback price
        let priceValue = card[priceField];
        let usingFallback = false;
        let fallbackReason = '';
        
        // Special handling for market price
        if (this.priceType === 'market') {
          const marketPriceStr = card.tcgplayerMarketPrice;
          const marketPrice = marketPriceStr ? parseFloat(marketPriceStr) : 0;
          if (!marketPriceStr || 
              marketPriceStr === '0' || 
              marketPriceStr === '0.00' || 
              marketPrice === 0 || 
              isNaN(marketPrice)) {
            priceValue = card.tcgplayerLowPrice || '0';
            usingFallback = true;
            fallbackReason = 'Market price not tracked by TCGplayer, using TCGplayer Low price';
          } else {
            priceValue = card.tcgplayerMarketPrice || '0';
          }
        } else if (!priceValue || parseFloat(priceValue) === 0) {
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
        const lineTotal = detail.quantity * price;
        
        // Update detail
        const hasNonFoil = detail.allMatches[selectedSet]?.nonFoil !== null;
        const hasFoil = detail.allMatches[selectedSet]?.foil !== null;
        const hasBoth = hasNonFoil && hasFoil;
        
        let hasBothInAnySet = false;
        for (const setName of detail.availableSets) {
          const setData = detail.allMatches[setName];
          if (setData && setData.nonFoil && setData.foil) {
            hasBothInAnySet = true;
            break;
          }
        }
        
        detail.unitPrice = price;
        detail.lineTotal = lineTotal;
        detail.selectedSet = selectedSet;
        detail.isFoil = isFoil;
        detail.hasNonFoil = hasNonFoil;
        detail.hasFoil = hasFoil;
        detail.hasBoth = hasBoth;
        detail.hasBothInAnySet = hasBothInAnySet;
        detail.card = card;
        detail.usingFallback = usingFallback;
        detail.fallbackReason = fallbackReason;
        
        totalPrice += lineTotal;
      }
      
      this.calculationResult.totalPrice = totalPrice;
      this.calculationResult.totalCards = this.calculationResult.cardDetails.reduce((sum, item) => sum + item.quantity, 0);
    },
    getCardFoilState(cardKey, defaultIsFoil) {
      // Get the current foil state for a card, with fallback to default
      return this.cardSelections[cardKey]?.isFoil !== undefined 
        ? this.cardSelections[cardKey].isFoil 
        : defaultIsFoil;
    },
    getCardKey(detail) {
      // Get the card key for a detail (handles both split and non-split)
      if (detail.isSplit) {
        return `${detail.originalCardKey}:split:${detail.splitIndex}`;
      }
      return detail.cardName;
    },
    getOriginalCardName(detail) {
      // Get the original card name (for split cards, use originalCardName; otherwise use cardName)
      return detail.originalCardName || detail.cardName;
    },
    clearAll() {
      this.deckInput = '';
      this.formattedDeck = '';
      this.calculationResult = null;
      this.errors = [];
      this.cardSelections = {};
      this.splitCards = {};
      this.originalSelections = {};
      this.sortColumn = null;
      this.sortDirection = 'asc';
      this.showSampleDecklist = false;
    },
    toggleSampleDecklist() {
      this.showSampleDecklist = !this.showSampleDecklist;
    },
    useSampleDecklist() {
      this.deckInput = this.sampleDecklist;
      this.showSampleDecklist = false;
    },
    sortBy(column) {
      if (this.sortColumn === column) {
        // Toggle direction if clicking the same column
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        // New column, default to ascending
        this.sortColumn = column;
        this.sortDirection = 'asc';
      }
    },
    getSortIcon(column) {
      if (this.sortColumn !== column) {
        return 'ArrowUpDown'; // Neutral icon
      }
      return this.sortDirection === 'asc' ? 'ArrowUp' : 'ArrowDown';
    },
    isMobileOrTablet() {
      return window.innerWidth <= 768;
    },
    toggleFallbackTooltip(index) {
      if (this.isMobileOrTablet()) {
        // On mobile, toggle the tooltip on click
        this.visibleFallbackTooltip = this.visibleFallbackTooltip === index ? null : index;
      }
    },
    showFallbackTooltip(index) {
      if (!this.isMobileOrTablet()) {
        // On desktop, show on hover
        this.visibleFallbackTooltip = index;
      }
    },
    hideFallbackTooltip() {
      if (!this.isMobileOrTablet()) {
        // On desktop, hide on mouse leave
        this.visibleFallbackTooltip = null;
      }
    },
    handleDocumentClick(event) {
      // Close tooltip if clicking outside the info icon/tooltip (for mobile)
      if (this.isMobileOrTablet() && this.visibleFallbackTooltip !== null) {
        const target = event.target;
        if (!target.closest('.price-fallback-info-container')) {
          this.visibleFallbackTooltip = null;
        }
      }
    },
    openCardDetailsModal(index) {
      if (this.isMobileOrTablet()) {
        this.openCardModal = index;
        // Load image for modal
        const detail = this.sortedCardDetails[index];
        if (detail) {
          this.mobileModalImageUrl = this.getCardImageUrl(detail);
          const cardKey = detail.isSplit 
            ? `${detail.originalCardKey}:split:${detail.splitIndex}`
            : detail.cardName;
          const isFoil = this.cardSelections[cardKey]?.isFoil !== undefined 
            ? this.cardSelections[cardKey].isFoil 
            : detail.isFoil;
          this.mobileModalIsFoil = isFoil || false;
          this.mobileModalIsHorizontal = false;
          this.showModalImageError = false;
        }
      }
    },
    closeCardDetailsModal() {
      this.openCardModal = null;
      this.mobileModalImageUrl = null;
      this.mobileModalImageUrlNext = null;
      this.mobileModalIsFoil = false;
      this.mobileModalIsHorizontal = false;
      this.showModalImageError = false;
      this.isPreloadingModalImage = false;
    },
    handleModalImageLoad(event) {
      // Check if image is wider than it is tall (horizontal card)
      const img = event.target;
      if (img.naturalWidth > img.naturalHeight) {
        this.mobileModalIsHorizontal = true;
      }
    },
    handleModalImageError() {
      this.showModalImageError = true;
    },
    updateModalImage() {
      // Helper method to update modal image - used by watchers and updateCardSelection
      // Preloads the new image to prevent flicker
      if (this.openCardModal !== null && this.isMobileOrTablet() && this.sortedCardDetails) {
        const detail = this.sortedCardDetails[this.openCardModal];
        if (detail) {
          const newImageUrl = this.getCardImageUrl(detail);
          const cardKey = detail.isSplit 
            ? `${detail.originalCardKey}:split:${detail.splitIndex}`
            : detail.cardName;
          const isFoil = this.cardSelections[cardKey]?.isFoil !== undefined 
            ? this.cardSelections[cardKey].isFoil 
            : detail.isFoil;
          
          // If the image URL is changing, preload it first
          if (newImageUrl && newImageUrl !== this.mobileModalImageUrl) {
            this.isPreloadingModalImage = true;
            this.mobileModalImageUrlNext = newImageUrl;
            
            // Preload the image
            const img = new Image();
            img.onload = () => {
              // Image loaded successfully, now swap it
              this.mobileModalImageUrl = newImageUrl;
              this.mobileModalIsFoil = isFoil || false;
              this.showModalImageError = false;
              this.isPreloadingModalImage = false;
              this.mobileModalImageUrlNext = null;
            };
            img.onerror = () => {
              // Image failed to load
              this.mobileModalImageUrl = newImageUrl; // Still set it so error state shows
              this.mobileModalIsFoil = isFoil || false;
              this.showModalImageError = true;
              this.isPreloadingModalImage = false;
              this.mobileModalImageUrlNext = null;
            };
            img.src = newImageUrl;
          } else if (!newImageUrl) {
            // No image available
            this.mobileModalImageUrl = null;
            this.mobileModalIsFoil = isFoil || false;
            this.showModalImageError = true;
          } else {
            // Same image URL, just update foil state
            this.mobileModalIsFoil = isFoil || false;
          }
        }
      }
    },
  },
  template: `
    <div class="deck-calculator-container">
      <h1>Deck Price Calculator</h1>
      
      <div class="calculator-section">
        <div class="price-type-selector">
          <label for="price-type">Price Type:</label>
          <select id="price-type" v-model="priceType">
            <option value="low">Low</option>
            <option value="mid">Mid</option>
            <option value="high">High</option>
            <option value="market">Market</option>
          </select>
        </div>
        
        <div class="foil-preference-selector">
          <label>Default Version:</label>
          <div class="foil-preference-options">
            <label class="foil-preference-option">
              <input 
                type="radio" 
                name="foil-preference" 
                value="non-foil" 
                v-model="defaultFoilPreference"
                :disabled="calculationResult !== null">
              <span>All Non-Foil</span>
            </label>
            <label class="foil-preference-option">
              <input 
                type="radio" 
                name="foil-preference" 
                value="foil" 
                v-model="defaultFoilPreference"
                :disabled="calculationResult !== null">
              <span>All Foil</span>
            </label>
          </div>
        </div>
        
        <div class="deck-input-section">
          <div class="deck-input-header">
            <label for="deck-input">Paste your deck list:</label>
            <button 
              v-if="hasSampleDecklist && !calculationResult"
              @click="toggleSampleDecklist"
              class="sample-decklist-button"
              type="button">
              {{ showSampleDecklist ? hideSampleDecklistButtonText : sampleDecklistButtonText }}
            </button>
          </div>
          
          <div v-if="showSampleDecklist && hasSampleDecklist" class="sample-decklist-section">
            <div class="sample-decklist-header">
              <h4>Sample curiosa.io Deck List Format</h4>
              <button 
                @click="useSampleDecklist"
                class="use-sample-button"
                type="button">
                Use This Sample
              </button>
            </div>
            <textarea 
              :value="sampleDecklist"
              rows="20"
              class="deck-textarea sample-decklist"
              readonly>
            </textarea>
          </div>
          
          <textarea 
            id="deck-input"
            v-model="deckInput" 
            :placeholder="placeholderText"
            rows="15"
            class="deck-textarea">
          </textarea>
          
          <div class="button-group">
            <button 
              v-if="!calculationResult"
              @click="calculatePrice" 
              :disabled="!canCalculate || isCalculating"
              class="calculate-button">
              {{ isCalculating ? 'Calculating...' : 'Calculate Price' }}
            </button>
            <button 
              v-if="needsFormatting && !calculationResult" 
              @click="formatDecklist" 
              :disabled="isFormatting || !deckInput.trim()"
              class="format-button">
              {{ isFormatting ? 'Formatting...' : formatButtonText }}
            </button>
            <button 
              v-if="calculationResult"
              @click="clearAll" 
              class="clear-button">
              Reset
            </button>
          </div>
        </div>
        
        <div v-if="isCalculating" class="loading-indicator">
          <p>Loading...</p>
        </div>
        
        <div v-if="formattedDeck && needsFormatting && !calculationResult" class="formatted-deck-section">
          <label>Formatted Deck List (review before calculating):</label>
          <textarea 
            v-model="formattedDeck" 
            rows="15"
            class="deck-textarea formatted-deck"
            readonly>
          </textarea>
        </div>
        
        <div v-if="errors.length > 0" class="error-messages">
          <div v-for="(error, index) in errors" :key="index" class="error-message">
            {{ error }}
          </div>
        </div>
        
        <div v-if="calculationResult" class="calculation-result">
          <h3>Calculation Results</h3>
          <div class="result-summary">
            <div class="result-item">
              <span class="result-label">Total Price:</span>
              <span class="result-value">{{ formatPrice(calculationResult.totalPrice) }}</span>
            </div>
            <div class="result-item">
              <span class="result-label">Total Cards:</span>
              <span class="result-value">{{ calculationResult.totalCards }}</span>
            </div>
          </div>
          
          <div v-if="calculationResult.cardDetails.length > 0" class="card-details">
            <h4>Card Breakdown<span v-if="isMobileOrTablet()" class="mobile-tap-reminder"> (tap for details)</span></h4>
            <div class="card-details-table-wrapper">
              <table class="card-details-table">
              <thead>
                <tr>
                  <th @click="sortBy('quantity')" class="sortable-header mobile-visible-column">
                    Quantity <span class="sort-icon"><component :is="getSortIcon('quantity')" :size="16" /></span>
                  </th>
                  <th @click="sortBy('cardName')" class="sortable-header mobile-visible-column">
                    Card Name <span class="sort-icon"><component :is="getSortIcon('cardName')" :size="16" /></span>
                  </th>
                  <th class="mobile-visible-column mobile-actions-header">Actions</th>
                  <th @click="sortBy('set')" class="sortable-header mobile-hidden-column">
                    Set <span class="sort-icon"><component :is="getSortIcon('set')" :size="16" /></span>
                  </th>
                  <th class="mobile-hidden-column">Version</th>
                  <th class="mobile-hidden-column desktop-actions-header">Actions</th>
                  <th @click="sortBy('unitPrice')" class="sortable-header mobile-hidden-column">
                    Price <span class="sort-icon"><component :is="getSortIcon('unitPrice')" :size="16" /></span>
                  </th>
                  <th @click="sortBy('lineTotal')" class="sortable-header mobile-hidden-column">
                    Total <span class="sort-icon"><component :is="getSortIcon('lineTotal')" :size="16" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="(detail, index) in sortedCardDetails" 
                  :key="index"
                  :class="{ 
                    'mobile-clickable-row': isMobileOrTablet(),
                    'split-row': detail.isSplit
                  }"
                  @click="openCardDetailsModal(index)">
                  <td class="mobile-visible-column">
                    <span v-if="detail.isSplit" class="split-indicator">•</span>
                    {{ detail.quantity }}
                  </td>
                  <td class="mobile-visible-column">
                    <span class="card-name">
                      <span v-if="detail.isSplit" class="split-indicator">•</span>
                      <a 
                        v-if="!isMobileOrTablet()"
                        :href="getCardLink(detail)"
                        target="_blank"
                        rel="noopener noreferrer"
                        @mouseover="handleCardHover($event, detail)"
                        @mouseleave="hideHoverImage()"
                        @click.stop>
                        {{ detail.cardName }}
                      </a>
                      <span v-else>
                        {{ detail.cardName }}
                      </span>
                    </span>
                  </td>
                  <td class="mobile-visible-column mobile-actions-cell">
                    <button
                      v-if="!detail.isSplit && detail.quantity > 1"
                      @click.stop="splitCard(detail.cardName)"
                      class="split-button"
                      type="button">
                      Split
                    </button>
                    <button
                      v-else-if="detail.isSplit && detail.splitIndex === 0"
                      @click.stop="unsplitCard(detail.originalCardKey)"
                      class="unsplit-button"
                      type="button">
                      Reset
                    </button>
                    <span v-else-if="detail.isSplit" class="split-badge">Split</span>
                    <span v-else>—</span>
                  </td>
                  <td class="mobile-hidden-column">
                    <select 
                      v-if="detail.availableSets.length > 1"
                      :value="detail.selectedSet"
                      @change="updateCardSelection(getCardKey(detail), $event.target.value, undefined)"
                      @click.stop
                      class="set-selector">
                      <option v-for="setName in detail.availableSets" :key="setName" :value="setName">
                        {{ setName }}
                      </option>
                    </select>
                    <span v-else>{{ detail.selectedSet }}</span>
                  </td>
                  <td class="mobile-hidden-column">
                    <div v-if="detail.hasBoth" class="foil-toggle-container">
                      <span class="foil-toggle-label-left">NF</span>
                      <label class="foil-toggle-switch">
                        <input
                          type="checkbox"
                          :checked="getCardFoilState(getCardKey(detail), detail.isFoil)"
                          @change="updateCardSelection(getCardKey(detail), undefined, $event.target.checked)"
                          @click.stop
                          class="foil-toggle-input">
                        <span class="foil-toggle-slider"></span>
                      </label>
                      <span class="foil-toggle-label-right">F</span>
                    </div>
                    <span v-else-if="detail.hasFoil && !detail.hasNonFoil" class="version-label foil-label">Foil</span>
                    <span v-else class="version-label nonfoil-label">Non-Foil</span>
                  </td>
                  <td class="mobile-hidden-column desktop-actions-cell">
                    <button
                      v-if="!detail.isSplit && detail.quantity > 1"
                      @click.stop="splitCard(detail.cardName)"
                      class="split-button"
                      type="button">
                      Split
                    </button>
                    <button
                      v-else-if="detail.isSplit && detail.splitIndex === 0"
                      @click.stop="unsplitCard(detail.originalCardKey)"
                      class="unsplit-button"
                      type="button">
                      Reset Split
                    </button>
                    <span v-else-if="detail.isSplit" class="split-badge">Split</span>
                    <span v-else>—</span>
                  </td>
                  <td class="mobile-hidden-column">
                    <div v-if="detail.usingFallback" class="price-with-fallback-wrapper">
                      <span class="price-with-fallback-text">
                        {{ formatPrice(detail.unitPrice) }}
                      </span>
                      <div class="price-fallback-info-container">
                        <span 
                          class="price-fallback-info-icon"
                          @click.stop="toggleFallbackTooltip(index)"
                          @mouseenter="showFallbackTooltip(index)"
                          @mouseleave="hideFallbackTooltip()">
                          <Info :size="16" />
                        </span>
                        <div 
                          v-if="visibleFallbackTooltip === index"
                          class="price-fallback-tooltip">
                          {{ detail.fallbackReason }}
                        </div>
                      </div>
                    </div>
                    <span v-else>{{ formatPrice(detail.unitPrice) }}</span>
                  </td>
                  <td class="mobile-hidden-column">{{ formatPrice(detail.lineTotal) }}</td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        </div>
        
        <!-- Sticky footer with totals -->
        <div v-if="calculationResult" class="calculator-sticky-footer">
          <div class="sticky-footer-content">
            <div class="sticky-footer-item">
              <span class="sticky-footer-label">Total Price:</span>
              <span class="sticky-footer-value">{{ formatPrice(calculationResult.totalPrice) }}</span>
            </div>
            <div class="sticky-footer-item">
              <span class="sticky-footer-label">Total Cards:</span>
              <span class="sticky-footer-value">{{ calculationResult.totalCards }}</span>
            </div>
          </div>
        </div>
        
        <!-- Mobile Card Details Modal -->
        <div 
          v-show="isMobileOrTablet() && currentModalDetail"
          class="mobile-card-modal-overlay"
          @click="closeCardDetailsModal">
          <div v-if="currentModalDetail" class="mobile-card-modal-content" @click.stop :key="getCardKey(currentModalDetail)">
            <button class="mobile-card-modal-close" @click="closeCardDetailsModal">
              <img src="assets/sl-modal-close.png" alt="Close">
            </button>
            <!-- Card Image -->
            <div v-if="mobileModalImageUrl && mobileModalIsFoil" class="foil-image-wrapper" :class="{ 'modal-image-horizontal': mobileModalIsHorizontal }">
              <img :src="mobileModalImageUrl" 
                   alt="Card Image Not Available" 
                   class="modal-image" 
                   @error="handleModalImageError"
                   @load="handleModalImageLoad"
                   oncontextmenu="return false;">
            </div>
            <img v-else-if="mobileModalImageUrl" 
                 :src="mobileModalImageUrl" 
                 alt="Card Image Not Available" 
                 class="modal-image" 
                 @error="handleModalImageError"
                 @load="handleModalImageLoad"
                 oncontextmenu="return false;">
            <div v-if="!mobileModalImageUrl || showModalImageError" class="modal-no-image-text">Image Not Available</div>
            <!-- Preload next image (hidden) -->
            <img v-if="mobileModalImageUrlNext && mobileModalImageUrlNext !== mobileModalImageUrl" 
                 :src="mobileModalImageUrlNext" 
                 style="display: none;"
                 @load="handleModalImageLoad"
                 @error="handleModalImageError">
            <div class="mobile-card-modal-grid">
              <div class="mobile-card-modal-item">
                <div class="mobile-card-modal-label">Set</div>
                <div class="mobile-card-modal-value">
                  <select 
                    v-if="currentModalDetail.availableSets.length > 1"
                    :value="currentModalDetail.selectedSet"
                    @change="updateCardSelection(getCardKey(currentModalDetail), $event.target.value, undefined)"
                    class="set-selector">
                    <option v-for="setName in currentModalDetail.availableSets" :key="setName" :value="setName">
                      {{ setName }}
                    </option>
                  </select>
                  <span v-else>{{ currentModalDetail.selectedSet }}</span>
                </div>
              </div>
              <div class="mobile-card-modal-item">
                <div class="mobile-card-modal-label">Version</div>
                <div class="mobile-card-modal-value">
                  <div v-if="currentModalDetail.hasBoth" class="foil-toggle-container">
                    <span class="foil-toggle-label-left">NF</span>
                    <label class="foil-toggle-switch">
                      <input
                        type="checkbox"
                        :checked="getCardFoilState(getCardKey(currentModalDetail), currentModalDetail.isFoil)"
                        @change="updateCardSelection(getCardKey(currentModalDetail), undefined, $event.target.checked)"
                        class="foil-toggle-input">
                      <span class="foil-toggle-slider"></span>
                    </label>
                    <span class="foil-toggle-label-right">F</span>
                  </div>
                  <span v-else-if="currentModalDetail.hasFoil && !currentModalDetail.hasNonFoil" class="version-label foil-label">Foil</span>
                  <span v-else class="version-label nonfoil-label">Non-Foil</span>
                </div>
              </div>
              <div class="mobile-card-modal-item">
                <div class="mobile-card-modal-label">Price</div>
                <div class="mobile-card-modal-value">
                  <div v-if="currentModalDetail.usingFallback" class="price-with-fallback-wrapper">
                    <span class="price-with-fallback-text">
                      {{ formatPrice(currentModalDetail.unitPrice) }}
                    </span>
                    <div class="price-fallback-info-container">
                      <span 
                        class="price-fallback-info-icon"
                        @click="toggleFallbackTooltip(openCardModal)"
                        @mouseenter="showFallbackTooltip(openCardModal)"
                        @mouseleave="hideFallbackTooltip()">
                        <Info :size="16" />
                      </span>
                      <div 
                        v-if="visibleFallbackTooltip === openCardModal"
                        class="price-fallback-tooltip">
                        {{ currentModalDetail.fallbackReason }}
                      </div>
                    </div>
                  </div>
                  <span v-else>{{ formatPrice(currentModalDetail.unitPrice) }}</span>
                </div>
              </div>
              <div class="mobile-card-modal-item">
                <div class="mobile-card-modal-label">Total</div>
                <div class="mobile-card-modal-value">
                  {{ formatPrice(currentModalDetail.lineTotal) }}
                </div>
              </div>
            </div>
            <!-- Buy on TCGplayer Button -->
            <div class="mobile-buy-buttons">
              <a :href="getCardLink(currentModalDetail)" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 class="buy-option-button buy-tcgplayer">
                Buy on TCGplayer
              </a>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Affiliate Disclosure Footer -->
      <footer class="affiliate-disclosure-footer deck-calculator-affiliate-footer">
        <div class="affiliate-disclosure-content">
          <h3>Affiliate Disclosure</h3>
          <p>
            Links on {{ gameTitle }} to card vendors like TCGplayer are affiliate links. If you make a purchase through these links, we may earn a commission at no extra cost to you. This helps support our site.
          </p>
          <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
            Copyright © Legendary Ledgers LLC, 2025
          </p>
        </div>
      </footer>
      
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
    </div>
  `
}

