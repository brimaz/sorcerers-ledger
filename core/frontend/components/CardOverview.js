import { CardDisplay } from './CardDisplay.js';
import { CardItem } from './CardItem.js';

export const CardOverview = {
  components: {
    CardDisplay,
    CardItem,
  },
  props: [
    'gameConfig', // Should contain RARITIES, SET_ICONS, RARITY_PRICE_THRESHOLDS, SET_ORDER, PRECON_SOURCE_SETS, SET_SLUG_MAP, TCGPLAYER_CATEGORY_SLUG
  ],
  data() {
    return {
      allSetsCardData: {},
      allSetsCardDataByName: {},
      allSetsCardDataByRarityPrice: {},
      allSetsCardDataByRarityName: {},
      allOldSetsCardData: {},
      isFoilPage: false,
      isPreconPage: false,
      isSealedPage: false,
      sortBy: 'price-desc',
      priceType: 'low',
      isGrouped: true,
      isFiltered: true,
      filterPriceChangeStatus: true,
      excludedSets: [],
      excludedRarities: [],
      mobileModalImageUrl: null,
      mobileModalCardName: null,
      mobileModalSetName: null,
      mobileModalIsFoil: false,
      mobileModalIsHorizontal: false,
      isMobileModalVisible: false,
      hoverImageUrl: null,
      hoverImagePosition: { top: 0, left: 0 },
      showImageError: false,
      showModalImageError: false,
      isHoverImageHorizontal: false,
      tcgplayerTrackingLink: '',
      productInfoBySet: {},
      showScrollToTop: false,
      isDataLoaded: false,
      isFilterModalVisible: false,
    }
  },
  computed: {
    RARITIES() {
      return this.gameConfig?.RARITIES || ["Unique", "Elite", "Exceptional", "Ordinary"];
    },
    SET_ICONS() {
      return this.gameConfig?.SET_ICONS || {};
    },
    RARITY_PRICE_THRESHOLDS() {
      if (!this.gameConfig) return {};
      const thresholds = this.gameConfig.RARITY_PRICE_THRESHOLDS;
      return thresholds && typeof thresholds === 'object' ? thresholds : {};
    },
    SET_ORDER() {
      return this.gameConfig?.SET_ORDER || [];
    },
    PRECON_SOURCE_SETS() {
      if (!this.gameConfig) return [];
      return Array.isArray(this.gameConfig.PRECON_SOURCE_SETS) 
        ? this.gameConfig.PRECON_SOURCE_SETS 
        : [];
    },
    SET_SLUG_MAP() {
      return this.gameConfig?.SET_SLUG_MAP || {};
    },
    TCGPLAYER_CATEGORY_SLUG() {
      return this.gameConfig?.TCGPLAYER_CATEGORY_SLUG || 'sorcery-contested-realm';
    },
    availableSets() {
      // Build a stable list of set names for filters using config order first
      const setNames = Object.keys(this.allSetsCardData || {});
      const orderedFromConfig = this.SET_ORDER.filter(name => setNames.includes(name));
      const remaining = setNames
        .filter(name => !this.SET_ORDER.includes(name))
        .sort();
      return [...orderedFromConfig, ...remaining];
    },
    hasActiveExclusionFilters() {
      return (this.excludedSets && this.excludedSets.length > 0) ||
        (this.excludedRarities && this.excludedRarities.length > 0);
    },
    activeExclusionCount() {
      const setCount = this.excludedSets ? this.excludedSets.length : 0;
      const rarityCount = this.excludedRarities ? this.excludedRarities.length : 0;
      return setCount + rarityCount;
    },
    allSetsSelected() {
      return Array.isArray(this.excludedSets) &&
        Array.isArray(this.availableSets) &&
        this.availableSets.length > 0 &&
        this.excludedSets.length === this.availableSets.length;
    },
    allRaritiesSelected() {
      return Array.isArray(this.excludedRarities) &&
        Array.isArray(this.RARITIES) &&
        this.RARITIES.length > 0 &&
        this.excludedRarities.length === this.RARITIES.length;
    },
    setsDataToRender() {
      // Don't compute if gameConfig isn't ready yet
      if (!this.gameConfig) {
        return {};
      }
      return this.getSortedData(
        this.allSetsCardData,
        this.allSetsCardDataByName,
        this.allSetsCardDataByRarityPrice,
        this.allSetsCardDataByRarityName,
        this.sortBy,
        this.isGrouped,
        this.isFiltered,
        this.filterPriceChangeStatus,
        this.priceType
      );
    },
  },
  async mounted() {
    this.initializeFromRoute();
    
    try {
      const configResponse = await fetch('/api/config');
      const config = await configResponse.json();
      this.tcgplayerTrackingLink = config.tcgplayerTrackingLink || '';
    } catch (error) {
      console.warn('Could not load TCGplayer tracking link:', error);
    }

    await this.loadProductInfoFiles();
    await this.loadAndRenderCards();
    window.addEventListener('scroll', this.handleScroll);
  },
  beforeUnmount() {
    window.removeEventListener('scroll', this.handleScroll);
  },
  methods: {
    initializeFromRoute() {
      const query = this.$route.query;
      this.isFoilPage = query.view === 'foil';
      this.isPreconPage = query.view === 'precon' || this.$route.path === '/precon';
      this.isSealedPage = query.view === 'sealed' || this.$route.path === '/sealed';
      
      if (query.priceType && ['low', 'mid', 'high', 'market'].includes(query.priceType)) {
        this.priceType = query.priceType;
      }
      
      if (query.sort) {
        this.sortBy = query.sort;
      }
      
      if (query.groupRarity !== undefined) {
        this.isGrouped = query.groupRarity === 'true' || query.groupRarity === true;
      }
      
      if (query.filterValue !== undefined) {
        this.isFiltered = query.filterValue === 'true' || query.filterValue === true;
      }
      
      if (query.filterPriceChange !== undefined) {
        this.filterPriceChangeStatus = query.filterPriceChange === 'true' || query.filterPriceChange === true;
      }

      // Excluded sets (comma-separated list)
      if (query.hiddenSets) {
        const raw = Array.isArray(query.hiddenSets) ? query.hiddenSets : String(query.hiddenSets).split(',');
        const parsed = raw.filter(Boolean);
        const sameLength = parsed.length === this.excludedSets.length;
        const sameContent = sameLength && parsed.every((v, i) => v === this.excludedSets[i]);
        if (!sameContent) {
          this.excludedSets = parsed;
        }
      } else if (this.excludedSets.length > 0) {
        this.excludedSets = [];
      }

      // Excluded rarities (comma-separated list)
      if (query.hiddenRarities) {
        const raw = Array.isArray(query.hiddenRarities) ? query.hiddenRarities : String(query.hiddenRarities).split(',');
        const parsed = raw.filter(Boolean);
        const sameLength = parsed.length === this.excludedRarities.length;
        const sameContent = sameLength && parsed.every((v, i) => v === this.excludedRarities[i]);
        if (!sameContent) {
          this.excludedRarities = parsed;
        }
      } else if (this.excludedRarities.length > 0) {
        this.excludedRarities = [];
      }
    },
    async loadAndRenderCards() {
        this.isDataLoaded = false;
        try {
            // Clear all data structures before loading new data to prevent stale data from other pages
            this.allSetsCardData = {};
            this.allSetsCardDataByName = {};
            this.allSetsCardDataByRarityPrice = {};
            this.allSetsCardDataByRarityName = {};
            this.allOldSetsCardData = {};
            
            const OLDEST_CARD_DATA_FILE = await this.getOldestCardDataFile();

            const response = await fetch('card-data/card_data.json');
            const data = await response.json();

            let oldData = {};
            if (OLDEST_CARD_DATA_FILE) {
                try {
                    const oldResponse = await fetch(OLDEST_CARD_DATA_FILE);
                    oldData = await oldResponse.json();
                } catch (error) {
                    console.warn('Could not load old card data for comparison:', error);
                    oldData = {};
                }
            }

            const gameTitle = this.gameConfig?.GAME_TITLE || "Sorcerer's Ledger";
            if (this.isPreconPage) {
              document.title = `${gameTitle} - Precon`;
            } else if (this.isSealedPage) {
              document.title = `${gameTitle} - Sealed`;
            } else {
              document.title = this.isFoilPage ? `${gameTitle} - Foil` : `${gameTitle} - Non-Foil`;
            }

            const filterCardsWithProductIds = (cardArray) => {
                if (!Array.isArray(cardArray)) return cardArray;
                return cardArray.filter(card => card && card.tcgplayerProductId);
            };

            const filterRarityGroupedData = (rarityData) => {
                if (!rarityData || typeof rarityData !== 'object') return rarityData;
                const filtered = {};
                for (const rarity in rarityData) {
                    filtered[rarity] = filterCardsWithProductIds(rarityData[rarity]);
                }
                return filtered;
            };

            if (this.isPreconPage) {
                // On precon page, load all preconstructed products as-is
                const preconstructedSets = Array.isArray(this.PRECON_SOURCE_SETS) ? this.PRECON_SOURCE_SETS : [];
                for (const sourceSetName of preconstructedSets) {
                    if (data[sourceSetName] && data[sourceSetName].preconstructed && data[sourceSetName].preconstructed.length > 0) {
                        const preconSetName = `${sourceSetName} (Preconstructed)`;
                        const preconProducts = filterCardsWithProductIds(data[sourceSetName].preconstructed);
                        
                        // Use preconstructedByName if available, otherwise sort by name
                        const sortedByName = data[sourceSetName].preconstructedByName && data[sourceSetName].preconstructedByName.length > 0
                            ? filterCardsWithProductIds(data[sourceSetName].preconstructedByName)
                            : [...preconProducts].sort((a, b) => {
                                const nameA = (a.name || '').toLowerCase();
                                const nameB = (b.name || '').toLowerCase();
                                return nameA.localeCompare(nameB);
                            });
                        
                        // For preconstructed products, we don't have rarities, so create empty rarity structures
                        const emptyRarityStructure = {};
                        for (const rarity of this.RARITIES) {
                            emptyRarityStructure[rarity] = [];
                        }
                        
                        this.allSetsCardData[preconSetName] = preconProducts;
                        this.allSetsCardDataByName[preconSetName] = sortedByName;
                        this.allSetsCardDataByRarityPrice[preconSetName] = emptyRarityStructure;
                        this.allSetsCardDataByRarityName[preconSetName] = emptyRarityStructure;
                    }
                }
            } else if (this.isSealedPage) {
                // On sealed page, load all sealed products as-is (exclude promo sets)
                for (const setName in data) {
                    // Exclude promo sets from sealed page
                    if (setName.includes('Promo') || setName.includes('Promos')) {
                        continue;
                    }
                    if (data[setName].sealed && data[setName].sealed.length > 0) {
                        const sealedProducts = filterCardsWithProductIds(data[setName].sealed);
                        
                        // Use sealedByName if available, otherwise sort by name
                        const sortedByName = data[setName].sealedByName && data[setName].sealedByName.length > 0
                            ? filterCardsWithProductIds(data[setName].sealedByName)
                            : [...sealedProducts].sort((a, b) => {
                                const nameA = (a.name || '').toLowerCase();
                                const nameB = (b.name || '').toLowerCase();
                                return nameA.localeCompare(nameB);
                            });
                        
                        // For sealed products, we don't have rarities, so create empty rarity structures
                        const emptyRarityStructure = {};
                        for (const rarity of this.RARITIES) {
                            emptyRarityStructure[rarity] = [];
                        }
                        
                        this.allSetsCardData[setName] = sealedProducts;
                        this.allSetsCardDataByName[setName] = sortedByName;
                        this.allSetsCardDataByRarityPrice[setName] = emptyRarityStructure;
                        this.allSetsCardDataByRarityName[setName] = emptyRarityStructure;
                    }
                }
            } else {
                // On foil/non-foil pages, load regular card data (exclude preconstructed and sealed)
                for (const setName in data) {
                    this.allSetsCardData[setName] = filterCardsWithProductIds(this.isFoilPage ? data[setName].foil : data[setName].nonFoil);
                    this.allSetsCardDataByName[setName] = filterCardsWithProductIds(this.isFoilPage ? data[setName].foilByName : data[setName].nonFoilByName);
                    this.allSetsCardDataByRarityPrice[setName] = filterRarityGroupedData(this.isFoilPage ? data[setName].foilByRarityPrice : data[setName].nonFoilByRarityPrice);
                    this.allSetsCardDataByRarityName[setName] = filterRarityGroupedData(this.isFoilPage ? data[setName].foilByRarityName : data[setName].nonFoilByRarityName);
                }
            }

            if (this.isPreconPage) {
                // On precon page, load all old preconstructed data as-is
                const preconstructedSets = Array.isArray(this.PRECON_SOURCE_SETS) ? this.PRECON_SOURCE_SETS : [];
                for (const sourceSetName of preconstructedSets) {
                    if (oldData[sourceSetName] && oldData[sourceSetName].preconstructed && oldData[sourceSetName].preconstructed.length > 0) {
                        const preconSetName = `${sourceSetName} (Preconstructed)`;
                        this.allOldSetsCardData[preconSetName] = oldData[sourceSetName].preconstructed;
                    }
                }
            } else if (this.isSealedPage) {
                // On sealed page, load all old sealed data as-is (exclude promo sets)
                for (const setName in oldData) {
                    // Exclude promo sets from sealed page
                    if (setName.includes('Promo') || setName.includes('Promos')) {
                        continue;
                    }
                    if (oldData[setName].sealed && oldData[setName].sealed.length > 0) {
                        this.allOldSetsCardData[setName] = oldData[setName].sealed;
                    }
                }
            } else {
                // On foil/non-foil pages, load old regular card data
                for (const setName in oldData) {
                    const oldSetData = oldData[setName];
                    if (oldSetData) {
                        const oldCards = this.isFoilPage ? oldSetData.foil : oldSetData.nonFoil;
                        // Only set if the data exists and is an array
                        if (oldCards && Array.isArray(oldCards)) {
                            this.allOldSetsCardData[setName] = oldCards;
                        }
                    }
                }
            }
            this.isDataLoaded = true;
        } catch (error) {
            console.error('Error loading card data:', error);
            this.isDataLoaded = true; // Set to true even on error to show footer
        }
    },
    async getOldestCardDataFile() {
      const cardDataDirectory = 'card-data';
      const response = await fetch('/list-files?path=' + cardDataDirectory);
      const files = await response.json();

      // First, get the current data to see what sets we need
      let currentSets = [];
      try {
        const currentResponse = await fetch('card-data/card_data.json');
        const currentData = await currentResponse.json();
        currentSets = Object.keys(currentData);
      } catch (error) {
        console.warn('Could not load current card data to determine sets:', error);
      }

      // Find the oldest file that contains all current sets
      // This ensures we can compare prices for all sets, including newer ones like Gothic
      let oldestTimestamp = null;
      let oldestFile = null;

      // Sort files by timestamp (oldest first)
      const filesWithTimestamps = [];
      for (const file of files) {
        const timestamp = this.extractTimestampFromFilename(file);
        if (timestamp) {
          filesWithTimestamps.push({ file, timestamp });
        }
      }
      filesWithTimestamps.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      // Try to find a file that contains all sets
      // Start from oldest and work forward until we find one with all sets
      for (const { file, timestamp } of filesWithTimestamps) {
        try {
          const fileResponse = await fetch(`${cardDataDirectory}/${file}`);
          const fileData = await fileResponse.json();
          const fileSets = Object.keys(fileData);
          
          // Check if this file contains all current sets
          const hasAllSets = currentSets.every(setName => fileSets.includes(setName));
          
          if (hasAllSets) {
            oldestTimestamp = timestamp;
            oldestFile = file;
            break; // Found a file with all sets, use it
          }
        } catch (error) {
          // Skip files that can't be loaded
          continue;
        }
      }

      // If no file has all sets, fall back to the oldest file
      // (This handles the case where a new set was just added)
      if (!oldestFile && filesWithTimestamps.length > 0) {
        oldestFile = filesWithTimestamps[0].file;
      }

      if (oldestFile) {
        return `${cardDataDirectory}/${oldestFile}`;
      } else {
        console.warn('No archived card data files found in', cardDataDirectory);
        return null;
      }
    },
    extractTimestampFromFilename(filename) {
      const match = filename.match(/card_data_(\d{8}_\d{6})\.json/);
      if (match && match[1]) {
        return match[1];
      }
      return null;
    },
    async loadProductInfoFiles() {
      try {
        const response = await fetch('/list-files?path=card-data/product-info');
        const files = await response.json();
        
        const productInfoFiles = files.filter(file => 
          file.startsWith('product_info_') && file.endsWith('.json')
        );
        
        for (const filename of productInfoFiles) {
          try {
            const fileResponse = await fetch(`card-data/product-info/${filename}`);
            if (fileResponse.ok) {
              const productInfo = await fileResponse.json();
              const productMap = {};
              for (const product of productInfo) {
                productMap[String(product.productId)] = product;
              }
              const setName = filename
                .replace('product_info_', '')
                .replace('.json', '')
                .replace(/_/g, ' ');
              
              this.productInfoBySet[setName] = productMap;
            }
          } catch (error) {
            console.warn(`Failed to load product info from ${filename}:`, error);
          }
        }
      } catch (error) {
        console.warn('Could not list product info files, trying fallback method:', error);
        // Try to load product info for sets in SET_ORDER
        const fallbackSetNames = this.SET_ORDER.map(name => name.replace(/\s+/g, '_').replace(/[()]/g, ''));
        for (const setName of fallbackSetNames) {
          try {
            const response = await fetch(`card-data/product-info/product_info_${setName}.json`);
            if (response.ok) {
              const productInfo = await response.json();
              const productMap = {};
              for (const product of productInfo) {
                productMap[String(product.productId)] = product;
              }
              const displaySetName = setName.replace(/_/g, ' ');
              this.productInfoBySet[displaySetName] = productMap;
            }
          } catch (err) {
            // File doesn't exist - skip it
          }
        }
      }
      
        // Map preconstructed sets to use the same product info as their base sets
        const preconSets = this.PRECON_SOURCE_SETS;
        if (Array.isArray(preconSets)) {
          for (const sourceSetName of preconSets) {
            if (this.productInfoBySet[sourceSetName]) {
              this.productInfoBySet[`${sourceSetName} (Preconstructed)`] = this.productInfoBySet[sourceSetName];
            }
          }
        }
    },
    getSortedData(setsData, setsDataByName, setsDataByRarityPrice, setsDataByRarityName, sortOption, isGrouped, isFiltered, isFilteredByPriceChange, priceType) {
      let processedData = {};
      const priceField = this.getPriceFieldName(priceType);

      if (isGrouped) {
          if (sortOption === 'name-asc') {
              processedData = setsDataByRarityName;
          } else if (sortOption === 'name-desc') {
              for (const setName in setsDataByRarityName) {
                  processedData[setName] = {};
                  for (const rarity in setsDataByRarityName[setName]) {
                      processedData[setName][rarity] = [...setsDataByRarityName[setName][rarity]].reverse();
                  }
              }
          } else if (sortOption === 'price-asc') {
              for (const setName in setsDataByRarityPrice) {
                  processedData[setName] = {};
                  for (const rarity in setsDataByRarityPrice[setName]) {
                      processedData[setName][rarity] = [...setsDataByRarityPrice[setName][rarity]].sort((a, b) => parseFloat(a[priceField] || 0) - parseFloat(b[priceField] || 0));
                  }
              }
          } else {
              processedData = {};
              for (const setName in setsDataByRarityPrice) {
                  processedData[setName] = {};
                  for (const rarity in setsDataByRarityPrice[setName]) {
                      processedData[setName][rarity] = [...setsDataByRarityPrice[setName][rarity]].sort((a, b) => parseFloat(b[priceField] || 0) - parseFloat(a[priceField] || 0));
                  }
              }
          }

          if (isFiltered) {
              const filteredData = {};
              for (const setName in processedData) {
                  filteredData[setName] = {};
                  for (const rarity in processedData[setName]) {
                      const thresholds = this.RARITY_PRICE_THRESHOLDS || {};
                      const threshold = thresholds[rarity] || 0;
                      filteredData[setName][rarity] = processedData[setName][rarity].filter(card => {
                          if (!card.tcgplayerProductId) {
                              return false;
                          }
                          const price = parseFloat(card[priceField] || 0);
                          return price === 0 || isNaN(price) || price > threshold;
                      });
                  }
              }
              processedData = filteredData;
          } else {
              const filteredData = {};
              for (const setName in processedData) {
                  filteredData[setName] = {};
                  for (const rarity in processedData[setName]) {
                      filteredData[setName][rarity] = processedData[setName][rarity].filter(card => {
                          return card.tcgplayerProductId;
                      });
                  }
              }
              processedData = filteredData;
          }

          // Add Pledge Pack section for cards with "(Pledge Pack)" in the name
          // Extract pledge pack cards from the flat arrays and add them as a special section
          for (const setName in setsData) {
              if (!processedData[setName]) {
                  processedData[setName] = {};
              }
              
              // Get all cards from the flat array (nonFoil or foil depending on page)
              const allCards = setsData[setName] || [];
              const pledgePackCards = allCards.filter(card => {
                  if (!card || !card.tcgplayerProductId) return false;
                  const name = card.name || '';
                  return name.includes('(Pledge Pack)');
              });
              
              // Only add Pledge Pack section if there are pledge pack cards
              if (pledgePackCards.length > 0) {
                  // Sort pledge pack cards based on sort option
                  let sortedPledgePackCards;
                  if (sortOption === 'name-asc') {
                      sortedPledgePackCards = [...pledgePackCards].sort((a, b) => {
                          const nameA = (a.name || '').toLowerCase();
                          const nameB = (b.name || '').toLowerCase();
                          return nameA.localeCompare(nameB);
                      });
                  } else if (sortOption === 'name-desc') {
                      sortedPledgePackCards = [...pledgePackCards].sort((a, b) => {
                          const nameA = (a.name || '').toLowerCase();
                          const nameB = (b.name || '').toLowerCase();
                          return nameB.localeCompare(nameA);
                      });
                  } else if (sortOption === 'price-asc') {
                      sortedPledgePackCards = [...pledgePackCards].sort((a, b) => parseFloat(a[priceField] || 0) - parseFloat(b[priceField] || 0));
                  } else {
                      sortedPledgePackCards = [...pledgePackCards].sort((a, b) => parseFloat(b[priceField] || 0) - parseFloat(a[priceField] || 0));
                  }
                  
                  // Apply filtering if enabled
                  if (isFiltered) {
                      sortedPledgePackCards = sortedPledgePackCards.filter(card => {
                          const price = parseFloat(card[priceField] || 0);
                          // For pledge pack cards, use a low threshold or show all
                          return price === 0 || isNaN(price) || price > 0;
                      });
                  }
                  
                  // Add as "Pledge Pack" section (will appear after all rarities)
                  if (sortedPledgePackCards.length > 0) {
                      processedData[setName]['Pledge Pack'] = sortedPledgePackCards;
                  }
              }
          }

          return processedData;

      } else {
          if (sortOption === 'name-asc') {
              processedData = setsDataByName;
          } else if (sortOption === 'name-desc') {
              for (const setName in setsDataByName) {
                  processedData[setName] = [...setsDataByName[setName]].reverse();
              }
          } else if (sortOption === 'price-asc') {
              for (const setName in setsData) {
                  processedData[setName] = [...setsData[setName]].sort((a, b) => parseFloat(a[priceField] || 0) - parseFloat(b[priceField] || 0));
              }
          } else {
              for (const setName in setsData) {
                  processedData[setName] = [...setsData[setName]].sort((a, b) => parseFloat(b[priceField] || 0) - parseFloat(a[priceField] || 0));
              }
          }

          if (isFiltered) {
              const filteredData = {};
              for (const setName in processedData) {
                  filteredData[setName] = processedData[setName].filter(card => {
                      if (!card.tcgplayerProductId) {
                          return false;
                      }
                      const thresholds = this.RARITY_PRICE_THRESHOLDS || {};
                      const threshold = thresholds[card.rarity] || 0;
                      const price = parseFloat(card[priceField] || 0);
                      return price === 0 || isNaN(price) || price > threshold;
                  });
              }
              processedData = filteredData;
          } else {
              const filteredData = {};
              for (const setName in processedData) {
                  filteredData[setName] = processedData[setName].filter(card => {
                      return card.tcgplayerProductId;
                  });
              }
              processedData = filteredData;
          }

          return processedData;
      }
    },
    navigateToSort() {
      // Preserve the current path (/, /precon, or /sealed) when updating query parameters
      const newQuery = {
        ...this.$route.query,
        sort: this.sortBy,
        priceType: this.priceType,
        groupRarity: this.isGrouped,
        filterValue: this.isFiltered,
        filterPriceChange: this.filterPriceChangeStatus
      };

      if (this.excludedSets && this.excludedSets.length > 0) {
        newQuery.hiddenSets = this.excludedSets.join(',');
      } else {
        delete newQuery.hiddenSets;
      }

      if (this.excludedRarities && this.excludedRarities.length > 0) {
        newQuery.hiddenRarities = this.excludedRarities.join(',');
      } else {
        delete newQuery.hiddenRarities;
      }

      this.$router.push({
        path: this.$route.path,
        query: newQuery
      });
    },
    openFilterModal() {
      this.isFilterModalVisible = true;
    },
    closeFilterModal() {
      this.isFilterModalVisible = false;
    },
    clearAllFilters() {
      this.excludedSets = [];
      this.excludedRarities = [];
      this.isGrouped = false;
      this.isFiltered = false;
      this.filterPriceChangeStatus = false;
      // Ensure route/query stay in sync with cleared state
      this.navigateToSort();
    },
    resetFilters() {
      // Restore default filter and sort state
      this.sortBy = 'price-desc';
      this.priceType = 'low';
      this.isGrouped = true;
      this.isFiltered = true;
      this.filterPriceChangeStatus = true;
      this.excludedSets = [];
      this.excludedRarities = [];
      // Sync URL/query parameters
      this.navigateToSort();
    },
    toggleSelectAllSets() {
      if (this.allSetsSelected) {
        this.excludedSets = [];
      } else {
        this.excludedSets = [...this.availableSets];
      }
    },
    toggleSelectAllRarities() {
      if (this.allRaritiesSelected) {
        this.excludedRarities = [];
      } else {
        this.excludedRarities = [...this.RARITIES];
      }
    },
    isMobileOrTablet() {
        return window.innerWidth <= 1024;
    },
    showHoverImage(element, imageUrl, isFoilPage) {
        if (this.isMobileOrTablet()) return;

        const rect = element.getBoundingClientRect();
        this.hoverImagePosition = {
            top: rect.bottom + window.scrollY + 5,
            left: rect.left + window.scrollX,
        };
        this.hoverImageUrl = imageUrl;
        this.isFoilPage = isFoilPage;
        this.showImageError = false;
        this.isHoverImageHorizontal = false;
    },
    hideHoverImage() {
        this.hoverImageUrl = null;
        this.showImageError = false;
    },
    handleImageError(event) {
        this.showImageError = true;
        event.target.style.display = 'none';
    },
    handleHoverImageLoad(event) {
        const img = event.target;
        if (img.naturalWidth && img.naturalHeight) {
            this.isHoverImageHorizontal = img.naturalWidth > img.naturalHeight;
        }
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
    showMobileModal(imageUrl, isFoilPage, cardName, setName) {
        this.mobileModalImageUrl = imageUrl;
        this.mobileModalIsFoil = isFoilPage;
        this.mobileModalCardName = cardName;
        this.mobileModalSetName = setName;
        this.mobileModalIsHorizontal = false;
        this.isMobileModalVisible = true;
        this.showModalImageError = false;
    },
    hideMobileModal() {
        this.isMobileModalVisible = false;
        this.mobileModalImageUrl = null;
        this.mobileModalCardName = null;
        this.mobileModalSetName = null;
        this.mobileModalIsHorizontal = false;
        this.showModalImageError = false;
    },
    getMobileTcgplayerLink() {
        if (!this.tcgplayerTrackingLink || !this.mobileModalCardName || !this.mobileModalSetName) {
            return '#';
        }
        
        let cardProductId = null;
        const card = this.allSetsCardData[this.mobileModalSetName]?.find(c => c.name === this.mobileModalCardName);
        if (card && card.tcgplayerProductId) {
            cardProductId = card.tcgplayerProductId;
        }
        
        if (!cardProductId) {
            return '#';
        }
        
        const cardProductIdStr = String(cardProductId);
        
        let tcgplayerUrl = '';
        if (this.productInfoBySet && this.productInfoBySet[this.mobileModalSetName]) {
            const productInfo = this.productInfoBySet[this.mobileModalSetName][cardProductIdStr];
            if (productInfo && productInfo.url) {
                tcgplayerUrl = productInfo.url;
            }
        }
        
        if (!tcgplayerUrl) {
            const setSlug = this.SET_SLUG_MAP[this.mobileModalSetName] || this.mobileModalSetName.toLowerCase().replace(/\s+/g, '-');
            
            let cardSlug = '';
            if (this.productInfoBySet && this.productInfoBySet[this.mobileModalSetName]) {
                const productInfo = this.productInfoBySet[this.mobileModalSetName][cardProductIdStr];
                if (productInfo && productInfo.cleanName) {
                    cardSlug = productInfo.cleanName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                }
            }
            if (!cardSlug) {
                cardSlug = this.mobileModalCardName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            }
            
            const categorySlug = this.TCGPLAYER_CATEGORY_SLUG;
            tcgplayerUrl = `https://www.tcgplayer.com/product/${cardProductId}/${categorySlug}-${setSlug}-${cardSlug}?Language=English`;
        }
        
        const encodedUrl = encodeURIComponent(tcgplayerUrl);
        return `${this.tcgplayerTrackingLink}?u=${encodedUrl}`;
    },
    handleModalImageError(event) {
        this.showModalImageError = true;
        event.target.style.display = 'none';
    },
    setFoilPage(isFoil) {
        this.isFoilPage = isFoil;
        this.navigateToSort();
    },
    scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    handleScroll() {
        this.showScrollToTop = window.scrollY > 300;
    }
  },
  watch: {
    sortBy: 'navigateToSort',
    priceType: 'navigateToSort',
    isGrouped: 'navigateToSort',
    isFiltered: 'navigateToSort',
    filterPriceChangeStatus: 'navigateToSort',
    excludedSets: {
      handler: 'navigateToSort',
      deep: true,
    },
    excludedRarities: {
      handler: 'navigateToSort',
      deep: true,
    },
    '$route'(to, from) {
      // Only reload data if the page type actually changed (path or view query param)
      // Don't reload if only filter/sort query params changed
      const pageTypeChanged = to.path !== from.path || to.query.view !== from.query.view;
      
      if (pageTypeChanged) {
        // Reset filter/sort options to defaults when switching pages
        this.sortBy = 'price-desc';
        this.priceType = 'low';
        this.isGrouped = true;
        this.isFiltered = true;
        this.filterPriceChangeStatus = true;
        this.excludedSets = [];
        this.excludedRarities = [];
      }
      
      this.initializeFromRoute();
      
      if (pageTypeChanged) {
        // Page type changed (e.g., switching between foil and non-foil, or precon/sealed)
        this.loadAndRenderCards();
      }
      // If only query params changed (sort, priceType, etc.), the computed property
      // setsDataToRender will automatically update without reloading data
    },
    isFoilPage: {
        handler(newVal) {
            this.loadAndRenderCards();
        },
        immediate: false,
    },
    isPreconPage: {
        handler(newVal) {
            this.loadAndRenderCards();
        },
        immediate: false,
    },
    isSealedPage: {
        handler(newVal) {
            this.loadAndRenderCards();
        },
        immediate: false,
    },
  },
  template: `
    <div>
        <h1>{{ isPreconPage ? (gameConfig?.GAME_TITLE || "Sorcerer's Ledger") + " Preconstructed Deck Prices Overview" : (isSealedPage ? (gameConfig?.GAME_TITLE || "Sorcerer's Ledger") + " Sealed Products Prices Overview" : (isFoilPage ? (gameConfig?.GAME_TITLE || "Sorcerer's Ledger") + " Foil Card Prices Overview" : (gameConfig?.GAME_TITLE || "Sorcerer's Ledger") + " Non-Foil Card Prices Overview")) }}</h1>

        <div v-if="!isDataLoaded" class="loading-indicator">
            Loading...
        </div>

        <div v-if="isDataLoaded" class="sort-controls">
            <div class="sort-group">
                <label for="sort-select">Sort by:</label>
                <select id="sort-select" v-model="sortBy">
                    <option value="price-asc">Price (Low to High)</option>
                    <option value="price-desc">Price (High to Low)</option>
                    <option value="name-asc">Name (A to Z)</option>
                    <option value="name-desc">Name (Z to A)</option>
                </select>
            </div>
            <div class="price-type-group">
                <label for="price-type-select">Price Type:</label>
                <div class="price-type-wrapper">
                    <select id="price-type-select" 
                            v-model="priceType">
                        <option value="market" title="Not all prices are tracked by market">TCGplayer Market</option>
                        <option value="low">TCGplayer Low</option>
                        <option value="mid">TCGplayer Mid</option>
                        <option value="high">TCGplayer High</option>
                    </select>
                    <div v-if="priceType === 'market' && !isMobileOrTablet()" 
                         class="price-type-tooltip">
                        Not all prices are tracked by market
                    </div>
                    <span v-if="priceType === 'market'" class="price-type-disclaimer-mobile">*Not all prices are tracked by market</span>
                </div>
            </div>
            <button 
                type="button" 
                class="filter-button"
                @click="openFilterModal">
                Filters
                <span 
                  v-if="hasActiveExclusionFilters" 
                  class="filter-button-badge">
                  {{ activeExclusionCount }}
                </span>
            </button>
        </div>

        <CardDisplay v-if="isDataLoaded"
            :setsDataToRender="setsDataToRender"
            :allSetsCardData="allSetsCardData"
            :allSetsCardDataByName="allSetsCardDataByName"
            :RARITIES="RARITIES"
            :SET_ICONS="SET_ICONS"
            :SET_ORDER="SET_ORDER"
            :excludedSets="excludedSets"
            :excludedRarities="excludedRarities"
            :isFoilPage="isFoilPage"
            :isPreconPage="isPreconPage"
            :isSealedPage="isSealedPage"
            :filterPriceChangeStatus="filterPriceChangeStatus"
            :allOldSetsCardData="allOldSetsCardData"
            :isGrouped="isGrouped"
            :priceType="priceType"
            :sortBy="sortBy"
            :showHoverImage="showHoverImage.bind(this)"
            :hideHoverImage="hideHoverImage.bind(this)"
            :showMobileModal="showMobileModal.bind(this)"
            :tcgplayerTrackingLink="tcgplayerTrackingLink"
            :productInfoBySet="productInfoBySet"
            :setSlugMap="SET_SLUG_MAP"
            :tcgplayerCategorySlug="TCGPLAYER_CATEGORY_SLUG"
        />

        <div 
            v-if="isFilterModalVisible" 
            class="modal-overlay filter-modal-overlay"
            @click="closeFilterModal">
            <div class="modal-content filter-modal-content" @click.stop>
                <button class="modal-close-button" @click="closeFilterModal">
                    <img src="assets/sl-modal-close.png" alt="Close">
                </button>
                <h2 class="filter-modal-title">Filters</h2>
                <div class="filter-modal-body">
                    <section class="filter-section">
                        <h3>General</h3>
                        <div class="filter-options">
                            <label 
                                v-if="!isPreconPage && !isSealedPage" 
                                for="group-by-rarity-modal" 
                                class="filter-option">
                                <input 
                                    type="checkbox" 
                                    id="group-by-rarity-modal" 
                                    v-model="isGrouped">
                                <span>Group by Rarity</span>
                            </label>
                            <label 
                                v-if="!isPreconPage && !isSealedPage" 
                                for="filter-by-value-modal" 
                                class="filter-option">
                                <input 
                                    type="checkbox" 
                                    id="filter-by-value-modal" 
                                    v-model="isFiltered">
                                <span>Show Only High Value Cards</span>
                            </label>
                            <label 
                                for="filter-by-price-change-modal" 
                                class="filter-option">
                                <input 
                                    type="checkbox" 
                                    id="filter-by-price-change-modal" 
                                    v-model="filterPriceChangeStatus">
                                <span>Price Changes >= $1 (Last Week)</span>
                            </label>
                        </div>
                    </section>

                    <section class="filter-section">
                        <div class="filter-section-header">
                            <h3>Filter by Set</h3>
                            <button 
                                type="button" 
                                class="filter-link-button"
                                @click="toggleSelectAllSets">
                                {{ allSetsSelected ? 'Clear All' : 'Select All' }}
                            </button>
                        </div>
                        <div class="filter-options filter-options-scroll">
                            <label 
                                v-for="setName in availableSets" 
                                :key="setName" 
                                class="filter-option">
                                <input 
                                    type="checkbox" 
                                    :value="setName" 
                                    v-model="excludedSets">
                                <span>{{ setName }}</span>
                            </label>
                        </div>
                    </section>

                    <section 
                        v-if="!isPreconPage && !isSealedPage" 
                        class="filter-section">
                        <div class="filter-section-header">
                            <h3>Filter by Rarity</h3>
                            <button 
                                type="button" 
                                class="filter-link-button"
                                @click="toggleSelectAllRarities">
                                {{ allRaritiesSelected ? 'Clear All' : 'Select All' }}
                            </button>
                        </div>
                        <div class="filter-options">
                            <label 
                                v-for="rarity in RARITIES" 
                                :key="rarity" 
                                class="filter-option">
                                <input 
                                    type="checkbox" 
                                    :value="rarity" 
                                    v-model="excludedRarities">
                                <span>{{ rarity }}</span>
                            </label>
                        </div>
                    </section>

                    <div class="filter-actions">
                        <button 
                            type="button" 
                            class="filter-clear-button"
                            @click="resetFilters">
                            Reset filters
                        </button>
                        <button 
                            type="button" 
                            class="filter-clear-button"
                            @click="clearAllFilters">
                            Clear all filters
                        </button>
                        <button 
                            type="button" 
                            class="filter-apply-button"
                            @click="closeFilterModal">
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="hoverImageUrl !== null" 
             class="hover-image show-hover-image"
             :style="{ top: hoverImagePosition.top + 'px', left: hoverImagePosition.left + 'px' }">
            <div v-if="hoverImageUrl && isFoilPage" class="foil-image-wrapper">
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
            <div v-if="!hoverImageUrl || showImageError" class="hover-image-text">Image Not Available</div>
        </div>

        <div v-if="isMobileModalVisible" 
             id="mobile-image-modal" 
             class="modal-overlay"
             @click="hideMobileModal">
            <div class="modal-content" @click.stop>
                <button class="modal-close-button" @click="hideMobileModal">
                    <img src="assets/sl-modal-close.png" alt="Close">
                </button>
                <div v-if="mobileModalImageUrl && mobileModalIsFoil" class="foil-image-wrapper" :class="{ 'modal-image-horizontal': mobileModalIsHorizontal }">
                    <img :src="mobileModalImageUrl" 
                         alt="Card Image Not Available" 
                         class="modal-image" 
                         @error="handleModalImageError"
                         oncontextmenu="return false;">
                </div>
                <img v-else-if="mobileModalImageUrl" 
                     :src="mobileModalImageUrl" 
                     alt="Card Image Not Available" 
                     class="modal-image" 
                     @error="handleModalImageError"
                     oncontextmenu="return false;">
                <div v-if="!mobileModalImageUrl || showModalImageError" class="modal-no-image-text">Image Not Available</div>
                
                <div class="mobile-buy-buttons" v-if="mobileModalCardName">
                    <a :href="getMobileTcgplayerLink()" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       class="buy-option-button buy-tcgplayer">
                        Buy on TCGplayer
                    </a>
                </div>
            </div>
        </div>

        <footer v-if="isDataLoaded" class="affiliate-disclosure-footer">
            <div class="affiliate-disclosure-content">
                <h3>Affiliate Disclosure</h3>
                <p>
                    Links on {{ gameConfig?.GAME_TITLE || "Sorcerer's Ledger" }} to card vendors like TCGplayer are affiliate links. If you make a purchase through these links, we may earn a commission at no extra cost to you. This helps support our site.
                </p>
                <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
                    Copyright © Legendary Ledgers LLC, 2025
                </p>
            </div>
        </footer>

        <button 
            v-if="showScrollToTop && !isMobileOrTablet()" 
            @click="scrollToTop" 
            class="scroll-to-top"
            aria-label="Scroll to top">
            ↑
        </button>
    </div>
  `
}

