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

export const DeckPriceCalculatorCore = {
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
      isFormatting: false,
      isCalculating: false,
      errors: [],
      showSampleDecklist: false,
      // Track selected set and foil/non-foil for each card
      cardSelections: {},
      // Sorting state
      sortColumn: null,
      sortDirection: 'asc', // 'asc' or 'desc'
      // Track which fallback tooltip is visible (for mobile)
      visibleFallbackTooltip: null,
      // Track which card's modal is open (for mobile)
      openCardModal: null
    }
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
    }
  },
  async mounted() {
    document.title = `${this.gameTitle} - Deck Price Calculator`;
    await this.loadCardData();
    // Close tooltip when clicking outside (for mobile)
    document.addEventListener('click', this.handleDocumentClick);
  },
  beforeUnmount() {
    // Clean up event listener
    document.removeEventListener('click', this.handleDocumentClick);
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
    }
  },
  methods: {
    async loadCardData() {
      try {
        const response = await fetch('card-data/card_data.json');
        this.cardData = await response.json();
      } catch (error) {
        console.error('Error loading card data:', error);
        this.errors.push('Failed to load card data. Please refresh the page.');
      }
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
        const formattedLines = [];
        const sectionsToIgnore = this.format1Config.sectionsToIgnore || [];
        const sectionPattern = this.format1Config.sectionHeaderPattern;
        
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
            const quantity = cardMatch[1];
            const cardName = cardMatch[2].trim();
            if (cardName) {
              formattedLines.push(`${quantity} ${cardName}`);
            }
          } else if (/^\d+$/.test(trimmed)) {
            // Standalone number - might be a continuation, but we'll skip it
            // as it's ambiguous in Format 1
            continue;
          } else {
            // Just a card name without quantity - skip or treat as 1?
            // For now, skip it
            continue;
          }
        }
        
        this.formattedDeck = formattedLines.join('\n');
      } catch (error) {
        console.error('Error formatting decklist:', error);
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
        
        for (const line of lines) {
          const entry = this.parseDeckEntry(line);
          if (!entry) continue;
          
          const allMatches = this.findAllCardsByName(entry.cardName);
          if (!allMatches) {
            notFoundCards.push(entry.cardName);
            continue;
          }
          
          // Get available sets
          const availableSets = Object.keys(allMatches);
          
          // Initialize selection for this card if not exists
          const cardKey = entry.cardName;
          if (!this.cardSelections[cardKey]) {
            // Default to most recent set where non-foil exists
            const mostRecentSetWithNonFoil = this.getMostRecentSetWithNonFoil(availableSets, allMatches);
            if (mostRecentSetWithNonFoil) {
              // Found a set with non-foil, use it
              this.cardSelections[cardKey] = {
                selectedSet: mostRecentSetWithNonFoil,
                isFoil: false // Always use non-foil when available
              };
            } else {
              // No non-foil available in any set, fall back to most recent set (which will be foil-only)
              const mostRecentSet = this.getMostRecentSet(availableSets);
              this.cardSelections[cardKey] = {
                selectedSet: mostRecentSet,
                isFoil: true // Must use foil since no non-foil exists
              };
            }
          }
          
          // Get selected card based on user selection
          const selectedSet = this.cardSelections[cardKey].selectedSet;
          const isFoil = this.cardSelections[cardKey].isFoil;
          const selectedCard = isFoil ? allMatches[selectedSet].foil : allMatches[selectedSet].nonFoil;
          
          // If selected version doesn't exist, fall back to available version
          const card = selectedCard || allMatches[selectedSet].nonFoil || allMatches[selectedSet].foil;
          
          // Check if we're using a fallback price (when requested price type is missing/0)
          let priceValue = card[priceField];
          let usingFallback = false;
          let fallbackReason = '';
          
          // Special handling for market price: if it's 0, TCGplayer doesn't track it
          if (this.priceType === 'market') {
            const marketPrice = parseFloat(card.tcgplayerMarketPrice || 0);
            if (marketPrice === 0 || isNaN(marketPrice)) {
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
          const lineTotal = entry.quantity * price;
          
          // Determine available versions for the selected set
          const hasNonFoil = allMatches[selectedSet].nonFoil !== null;
          const hasFoil = allMatches[selectedSet].foil !== null;
          const hasBoth = hasNonFoil && hasFoil;
          
          // Check if card has both versions in ANY set (for toggle display)
          // A set has both if both nonFoil and foil are truthy (not null/undefined)
          let hasBothInAnySet = false;
          for (const setName of availableSets) {
            const setData = allMatches[setName];
            if (setData && setData.nonFoil && setData.foil) {
              hasBothInAnySet = true;
              break;
            }
          }
          
          cardDetails.push({
            cardName: entry.cardName,
            quantity: entry.quantity,
            unitPrice: price,
            lineTotal: lineTotal,
            availableSets: availableSets,
            allMatches: allMatches,
            selectedSet: selectedSet,
            isFoil: isFoil,
            hasNonFoil: hasNonFoil,
            hasFoil: hasFoil,
            hasBoth: hasBoth, // Both in selected set
            hasBothInAnySet: hasBothInAnySet, // Both in any set (for toggle)
            card: card,
            usingFallback: usingFallback,
            fallbackReason: fallbackReason
          });
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
        console.error('Error calculating price:', error);
        this.errors.push('Error calculating price. Please check the deck list format.');
      } finally {
        this.isCalculating = false;
      }
    },
    updateCardSelection(cardName, set, isFoil) {
      // Update selection and recalculate
      if (!this.cardSelections[cardName]) {
        this.cardSelections[cardName] = {};
      }
      if (set !== undefined) {
        this.cardSelections[cardName].selectedSet = set;
        // When changing sets, check if the selected version exists in the new set
        // If not, switch to the available version
        const detail = this.calculationResult?.cardDetails.find(d => d.cardName === cardName);
        if (detail && detail.allMatches[set]) {
          const hasNonFoil = detail.allMatches[set].nonFoil !== null;
          const hasFoil = detail.allMatches[set].foil !== null;
          // If current selection doesn't exist in new set, switch to available version
          if (this.cardSelections[cardName].isFoil && !hasFoil) {
            this.cardSelections[cardName].isFoil = false;
          } else if (!this.cardSelections[cardName].isFoil && !hasNonFoil) {
            this.cardSelections[cardName].isFoil = true;
          }
        }
      }
      if (isFoil !== undefined) {
        this.cardSelections[cardName].isFoil = isFoil;
      }
      // Recalculate totals - this will update the detail objects which should trigger re-render
      this.recalculateTotals();
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
        const cardKey = detail.cardName;
        const selectedSet = this.cardSelections[cardKey]?.selectedSet || detail.selectedSet;
        const isFoil = this.cardSelections[cardKey]?.isFoil !== undefined 
          ? this.cardSelections[cardKey].isFoil 
          : detail.isFoil;
        
        const selectedCard = isFoil 
          ? detail.allMatches[selectedSet].foil 
          : detail.allMatches[selectedSet].nonFoil;
        
        const card = selectedCard || detail.allMatches[selectedSet].nonFoil || detail.allMatches[selectedSet].foil;
        
        // Check if we're using a fallback price (when requested price type is missing/0)
        let priceValue = card[priceField];
        let usingFallback = false;
        let fallbackReason = '';
        
        // Special handling for market price: if it's 0, TCGplayer doesn't track it
        if (this.priceType === 'market') {
          const marketPrice = parseFloat(card.tcgplayerMarketPrice || 0);
          if (marketPrice === 0 || isNaN(marketPrice)) {
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
        const lineTotal = detail.quantity * price;
        
        // Update detail and recalculate hasBoth for the selected set
        const hasNonFoil = detail.allMatches[selectedSet].nonFoil !== null;
        const hasFoil = detail.allMatches[selectedSet].foil !== null;
        const hasBoth = hasNonFoil && hasFoil;
        
        // Check if card has both versions in ANY set (for toggle display)
        // A set has both if both nonFoil and foil are truthy (not null/undefined)
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
    },
    getCardFoilState(cardName, defaultIsFoil) {
      // Get the current foil state for a card, with fallback to default
      return this.cardSelections[cardName]?.isFoil !== undefined 
        ? this.cardSelections[cardName].isFoil 
        : defaultIsFoil;
    },
    clearAll() {
      this.deckInput = '';
      this.formattedDeck = '';
      this.calculationResult = null;
      this.errors = [];
      this.cardSelections = {};
      this.sortColumn = null;
      this.sortDirection = 'asc';
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
        return '↕️'; // Neutral icon
      }
      return this.sortDirection === 'asc' ? '↑' : '↓';
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
      }
    },
    closeCardDetailsModal() {
      this.openCardModal = null;
    }
  },
  template: `
    <div class="deck-calculator-container">
      <h1>Deck Price Calculator</h1>
      
      <div class="calculator-section">
        <h2>Price Totals</h2>
        
        <div class="price-type-selector">
          <label for="price-type">Price Type:</label>
          <select id="price-type" v-model="priceType">
            <option value="low">Low</option>
            <option value="mid">Mid</option>
            <option value="high">High</option>
            <option value="market">Market</option>
          </select>
        </div>
        
        <div class="deck-input-section">
          <div class="deck-input-header">
            <label for="deck-input">Paste your deck list:</label>
            <button 
              v-if="hasSampleDecklist"
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
              v-if="needsFormatting" 
              @click="formatDecklist" 
              :disabled="isFormatting || !deckInput.trim()"
              class="format-button">
              {{ isFormatting ? 'Formatting...' : formatButtonText }}
            </button>
            <button 
              @click="calculatePrice" 
              :disabled="!canCalculate || isCalculating"
              class="calculate-button">
              {{ isCalculating ? 'Calculating...' : 'Calculate Price' }}
            </button>
            <button 
              @click="clearAll" 
              class="clear-button">
              Clear All
            </button>
          </div>
        </div>
        
        <div v-if="formattedDeck && needsFormatting" class="formatted-deck-section">
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
              <span class="result-value">\${{ calculationResult.totalPrice.toFixed(2) }}</span>
            </div>
            <div class="result-item">
              <span class="result-label">Total Cards:</span>
              <span class="result-value">{{ calculationResult.totalCards }}</span>
            </div>
          </div>
          
          <!-- Add bottom padding to account for sticky footer -->
          <div class="calculation-result-spacer"></div>
          
          <div v-if="calculationResult.cardDetails.length > 0" class="card-details">
            <h4>Card Breakdown<span v-if="isMobileOrTablet()" class="mobile-tap-reminder"> (tap for details)</span></h4>
            <div class="card-details-table-wrapper">
              <table class="card-details-table">
              <thead>
                <tr>
                  <th @click="sortBy('quantity')" class="sortable-header mobile-visible-column">
                    Quantity <span class="sort-icon">{{ getSortIcon('quantity') }}</span>
                  </th>
                  <th @click="sortBy('cardName')" class="sortable-header mobile-visible-column">
                    Card Name <span class="sort-icon">{{ getSortIcon('cardName') }}</span>
                  </th>
                  <th @click="sortBy('set')" class="sortable-header mobile-hidden-column">
                    Set <span class="sort-icon">{{ getSortIcon('set') }}</span>
                  </th>
                  <th class="mobile-hidden-column">Version</th>
                  <th @click="sortBy('unitPrice')" class="sortable-header mobile-hidden-column">
                    Unit Price <span class="sort-icon">{{ getSortIcon('unitPrice') }}</span>
                  </th>
                  <th @click="sortBy('lineTotal')" class="sortable-header mobile-hidden-column">
                    Line Total <span class="sort-icon">{{ getSortIcon('lineTotal') }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="(detail, index) in sortedCardDetails" 
                  :key="index"
                  :class="{ 'mobile-clickable-row': isMobileOrTablet() }"
                  @click="openCardDetailsModal(index)">
                  <td class="mobile-visible-column">{{ detail.quantity }}</td>
                  <td class="mobile-visible-column">{{ detail.cardName }}</td>
                  <td class="mobile-hidden-column">
                    <select 
                      v-if="detail.availableSets.length > 1"
                      :value="detail.selectedSet"
                      @change="updateCardSelection(detail.cardName, $event.target.value, undefined)"
                      @click.stop
                      class="set-selector">
                      <option v-for="setName in detail.availableSets" :key="setName" :value="setName">
                        {{ setName }}
                      </option>
                    </select>
                    <span v-else>{{ detail.selectedSet }}</span>
                  </td>
                  <td class="mobile-hidden-column">
                    <div v-if="detail.hasBothInAnySet" class="foil-toggle-container">
                      <span class="foil-toggle-label-left">NF</span>
                      <label class="foil-toggle-switch">
                        <input
                          type="checkbox"
                          :checked="getCardFoilState(detail.cardName, detail.isFoil)"
                          @change="updateCardSelection(detail.cardName, undefined, $event.target.checked)"
                          @click.stop
                          class="foil-toggle-input">
                        <span class="foil-toggle-slider"></span>
                      </label>
                      <span class="foil-toggle-label-right">F</span>
                    </div>
                    <span v-else-if="detail.hasFoil && !detail.hasNonFoil" class="version-label foil-label">Foil</span>
                    <span v-else class="version-label nonfoil-label">Non-Foil</span>
                  </td>
                  <td class="mobile-hidden-column">
                    <div v-if="detail.usingFallback" class="price-with-fallback-wrapper">
                      <span class="price-with-fallback-text">
                        \${{ detail.unitPrice.toFixed(2) }}
                      </span>
                      <div class="price-fallback-info-container">
                        <span 
                          class="price-fallback-info-icon"
                          @click.stop="toggleFallbackTooltip(index)"
                          @mouseenter="showFallbackTooltip(index)"
                          @mouseleave="hideFallbackTooltip()">
                          ℹ️
                        </span>
                        <div 
                          v-if="visibleFallbackTooltip === index"
                          class="price-fallback-tooltip">
                          {{ detail.fallbackReason }}
                        </div>
                      </div>
                    </div>
                    <span v-else>\${{ detail.unitPrice.toFixed(2) }}</span>
                  </td>
                  <td class="mobile-hidden-column">\${{ detail.lineTotal.toFixed(2) }}</td>
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
              <span class="sticky-footer-value">\${{ calculationResult.totalPrice.toFixed(2) }}</span>
            </div>
            <div class="sticky-footer-item">
              <span class="sticky-footer-label">Total Cards:</span>
              <span class="sticky-footer-value">{{ calculationResult.totalCards }}</span>
            </div>
          </div>
        </div>
        
        <!-- Mobile Card Details Modal -->
        <div 
          v-if="isMobileOrTablet() && openCardModal !== null && sortedCardDetails[openCardModal]"
          class="mobile-card-modal-overlay"
          @click="closeCardDetailsModal">
          <div class="mobile-card-modal-content" @click.stop>
            <button class="mobile-card-modal-close" @click="closeCardDetailsModal">×</button>
            <h3 class="mobile-card-modal-title">{{ sortedCardDetails[openCardModal].cardName }}</h3>
            <div class="mobile-card-modal-grid">
              <div class="mobile-card-modal-item">
                <div class="mobile-card-modal-label">Set</div>
                <div class="mobile-card-modal-value">
                  <select 
                    v-if="sortedCardDetails[openCardModal].availableSets.length > 1"
                    :value="sortedCardDetails[openCardModal].selectedSet"
                    @change="updateCardSelection(sortedCardDetails[openCardModal].cardName, $event.target.value, undefined)"
                    class="set-selector">
                    <option v-for="setName in sortedCardDetails[openCardModal].availableSets" :key="setName" :value="setName">
                      {{ setName }}
                    </option>
                  </select>
                  <span v-else>{{ sortedCardDetails[openCardModal].selectedSet }}</span>
                </div>
              </div>
              <div class="mobile-card-modal-item">
                <div class="mobile-card-modal-label">Version</div>
                <div class="mobile-card-modal-value">
                  <div v-if="sortedCardDetails[openCardModal].hasBothInAnySet" class="foil-toggle-container">
                    <span class="foil-toggle-label-left">NF</span>
                    <label class="foil-toggle-switch">
                      <input
                        type="checkbox"
                        :checked="getCardFoilState(sortedCardDetails[openCardModal].cardName, sortedCardDetails[openCardModal].isFoil)"
                        @change="updateCardSelection(sortedCardDetails[openCardModal].cardName, undefined, $event.target.checked)"
                        class="foil-toggle-input">
                      <span class="foil-toggle-slider"></span>
                    </label>
                    <span class="foil-toggle-label-right">F</span>
                  </div>
                  <span v-else-if="sortedCardDetails[openCardModal].hasFoil && !sortedCardDetails[openCardModal].hasNonFoil" class="version-label foil-label">Foil</span>
                  <span v-else class="version-label nonfoil-label">Non-Foil</span>
                </div>
              </div>
              <div class="mobile-card-modal-item">
                <div class="mobile-card-modal-label">Unit Price</div>
                <div class="mobile-card-modal-value">
                  <div v-if="sortedCardDetails[openCardModal].usingFallback" class="price-with-fallback-wrapper">
                    <span class="price-with-fallback-text">
                      \${{ sortedCardDetails[openCardModal].unitPrice.toFixed(2) }}
                    </span>
                    <div class="price-fallback-info-container">
                      <span 
                        class="price-fallback-info-icon"
                        @click="toggleFallbackTooltip(openCardModal)"
                        @mouseenter="showFallbackTooltip(openCardModal)"
                        @mouseleave="hideFallbackTooltip()">
                        ℹ️
                      </span>
                      <div 
                        v-if="visibleFallbackTooltip === openCardModal"
                        class="price-fallback-tooltip">
                        {{ sortedCardDetails[openCardModal].fallbackReason }}
                      </div>
                    </div>
                  </div>
                  <span v-else>\${{ sortedCardDetails[openCardModal].unitPrice.toFixed(2) }}</span>
                </div>
              </div>
              <div class="mobile-card-modal-item">
                <div class="mobile-card-modal-label">Line Total</div>
                <div class="mobile-card-modal-value">
                  \${{ sortedCardDetails[openCardModal].lineTotal.toFixed(2) }}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="future-section-note">
          <p><em>Trade calculator coming soon...</em></p>
        </div>
      </div>
    </div>
  `
}

