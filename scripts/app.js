const { createApp } = Vue
import { CardDisplay } from './components/CardDisplay.js';
import { CardItem } from './components/CardItem.js';

createApp({
  components: {
    CardDisplay,
    CardItem,
  },
  data() {
    return {
      message: 'Hello Vue!',
      allSetsCardData: {},
      allSetsCardDataByName: {},
      allSetsCardDataByRarityPrice: {},
      allSetsCardDataByRarityName: {},
      allOldSetsCardData: {},
      isFoilPage: false,
      RARITIES: ["Unique", "Elite", "Exceptional", "Ordinary"],
      SET_ICONS: {
          "Alpha": "α",
          "Beta": "β",
          "Dust Reward Promos": "★",
          "Arthurian Legends Promo": "★",
          "Arthurian Legends": "⚔️",
          "Dragonlord": "🐉",
      },
      RARITY_PRICE_THRESHOLDS: {
          "Unique": 1.5,
          "Elite": 1.5,
          "Exceptional": 0.75,
          "Ordinary": 0.75,
      },
      sortBy: 'price-desc', // Default sort option
      priceType: 'low', // Default price type (low, mid, high, market)
      isGrouped: true, // Default
      isFiltered: true, // Default
      filterPriceChangeStatus: true, // Default
      mobileModalImageUrl: null,
      mobileModalCardName: null,
      mobileModalSetName: null,
      mobileModalIsFoil: false,
      isMobileModalVisible: false,
      isNavExpanded: false,
      hoverImageUrl: null,
      hoverImagePosition: { top: 0, left: 0 },
      showImageError: false,
      showModalImageError: false,
      isHoverImageHorizontal: false,
      tcgplayerTrackingLink: '', // TCGplayer API tracking link from .env
      productInfoBySet: {}, // Product info loaded from product_info_{setName}.json files
      showScrollToTop: false, // Show scroll-to-top button
    }
  },
  async mounted() {
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    this.isFoilPage = viewParam === 'foil'; // Initialize isFoilPage from URL on mount
    
    const priceTypeParam = urlParams.get('priceType');
    if (priceTypeParam && ['low', 'mid', 'high', 'market'].includes(priceTypeParam)) {
      this.priceType = priceTypeParam;
    }

    // Load TCGplayer tracking link from server
    try {
      const configResponse = await fetch('/api/config');
      const config = await configResponse.json();
      this.tcgplayerTrackingLink = config.tcgplayerTrackingLink || '';
    } catch (error) {
      console.warn('Could not load TCGplayer tracking link:', error);
    }

    // Load product info files for each set
    await this.loadProductInfoFiles();

    await this.loadAndRenderCards();
    
    // Add scroll event listener for scroll-to-top button
    window.addEventListener('scroll', this.handleScroll);
  },
  beforeUnmount() {
    // Clean up scroll event listener
    window.removeEventListener('scroll', this.handleScroll);
  },
  methods: {
    async loadAndRenderCards() {
        try {
            const OLDEST_CARD_DATA_FILE = await this.getOldestCardDataFile();

            const response = await fetch('card-data/card_data.json');
            const data = await response.json();

            // Only fetch old data if an archived file exists
            let oldData = {};
            if (OLDEST_CARD_DATA_FILE) {
                try {
                    const oldResponse = await fetch(OLDEST_CARD_DATA_FILE);
                    oldData = await oldResponse.json();
                } catch (error) {
                    console.warn('Could not load old card data for comparison:', error);
                    oldData = {};
                }
            } else {
            }

            const urlParams = new URLSearchParams(window.location.search);
            const viewParam = urlParams.get('view');

            const pageTitleElement = document.querySelector('h1');
            if (pageTitleElement) {
                pageTitleElement.textContent = this.isFoilPage ? "Sorcery Foil Card Prices Overview" : "Sorcery Non-Foil Card Prices Overview";
            }

            document.title = this.isFoilPage ? "Sorcery Foil Card Prices Overview" : "Sorcery Non-Foil Card Prices Overview";

            const nonFoilLink = document.querySelector('a[href*="view=nonfoil"]');
            const foilLink = document.querySelector('a[href*="view=foil"]');

            if (nonFoilLink) {
                nonFoilLink.classList.toggle('active', !this.isFoilPage);
            }
            if (foilLink) {
                foilLink.classList.toggle('active', this.isFoilPage);
            }

            // Helper function to filter out cards without product IDs
            const filterCardsWithProductIds = (cardArray) => {
                if (!Array.isArray(cardArray)) return cardArray;
                return cardArray.filter(card => card && card.tcgplayerProductId);
            };

            // Helper function to filter cards in rarity-grouped data
            const filterRarityGroupedData = (rarityData) => {
                if (!rarityData || typeof rarityData !== 'object') return rarityData;
                const filtered = {};
                for (const rarity in rarityData) {
                    filtered[rarity] = filterCardsWithProductIds(rarityData[rarity]);
                }
                return filtered;
            };

            for (const setName in data) {
                // Filter out cards without product IDs from all data structures
                this.allSetsCardData[setName] = filterCardsWithProductIds(this.isFoilPage ? data[setName].foil : data[setName].nonFoil);
                this.allSetsCardDataByName[setName] = filterCardsWithProductIds(this.isFoilPage ? data[setName].foilByName : data[setName].nonFoilByName);
                this.allSetsCardDataByRarityPrice[setName] = filterRarityGroupedData(this.isFoilPage ? data[setName].foilByRarityPrice : data[setName].nonFoilByRarityPrice);
                this.allSetsCardDataByRarityName[setName] = filterRarityGroupedData(this.isFoilPage ? data[setName].foilByRarityName : data[setName].nonFoilByRarityName);
            }

            for (const setName in oldData) {
                this.allOldSetsCardData[setName] = this.isFoilPage ? oldData[setName].foil : oldData[setName].nonFoil;
            }

            const sortParam = urlParams.get('sort');
            const priceTypeParam = urlParams.get('priceType');
            const groupRarityParam = urlParams.get('groupRarity');
            const filterValueParam = urlParams.get('filterValue');
            const filterPriceChangeParam = urlParams.get('filterPriceChange');

            if (groupRarityParam === 'true') {
                this.isGrouped = true;
            } else if (groupRarityParam === null) {
                this.isGrouped = true;
            }
            else {
                this.isGrouped = false;
            }

            if (filterValueParam === 'true') {
                this.isFiltered = true;
            } else if (filterValueParam === null) {
                this.isFiltered = true;
            }
            else {
                this.isFiltered = false;
            }

            if (filterPriceChangeParam === 'true') {
                this.filterPriceChangeStatus = true;
            } else if (filterPriceChangeParam === null) {
                this.filterPriceChangeStatus = true;
            }
            else {
                this.filterPriceChangeStatus = false;
            }

            if (sortParam) {
                this.sortBy = sortParam;
            } else {
                this.sortBy = 'price-desc'; // Set default if no param
            }

            if (priceTypeParam && ['low', 'mid', 'high', 'market'].includes(priceTypeParam)) {
                this.priceType = priceTypeParam;
            } else {
                this.priceType = 'low'; // Set default if no param or invalid
            }
        } catch (error) {
            console.error('Error loading card data:', error);
        }
    },
    async getOldestCardDataFile() {
      const cardDataDirectory = 'card-data';
      const response = await fetch('/list-files?path=' + cardDataDirectory);
      const files = await response.json();

      let oldestTimestamp = null;
      let oldestFile = null;

      for (const file of files) {
        const timestamp = this.extractTimestampFromFilename(file);
        if (timestamp) {
          if (!oldestTimestamp || timestamp < oldestTimestamp) {
            oldestTimestamp = timestamp;
            oldestFile = file;
          }
        }
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
      // Get list of product info files from the server
      // This dynamically discovers all product_info_*.json files
      try {
        const response = await fetch('/list-files?path=card-data/product-info');
        const files = await response.json();
        
        // Filter for product_info_*.json files
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
        // Fallback: try known set names
        const fallbackSetNames = ['Alpha', 'Beta', 'Arthurian_Legends', 'Dragonlord', 'Dust_Reward_Promos', 'Arthurian_Legends_Promo'];
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
          } else { // price-desc
              // Need to re-sort by selected price type
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
                      const threshold = this.RARITY_PRICE_THRESHOLDS[rarity];
                      filteredData[setName][rarity] = processedData[setName][rarity].filter(card => {
                          // Filter out cards without product IDs (no images or links)
                          if (!card.tcgplayerProductId) {
                              return false;
                          }
                          const price = parseFloat(card[priceField] || 0);
                          // Include cards with zero/N/A price since we don't know if they're high value
                          return price === 0 || isNaN(price) || price > threshold;
                      });
                  }
              }
              processedData = filteredData;
          } else {
              // Even if not filtering by price, still filter out cards without product IDs
              const filteredData = {};
              for (const setName in processedData) {
                  filteredData[setName] = {};
                  for (const rarity in processedData[setName]) {
                      filteredData[setName][rarity] = processedData[setName][rarity].filter(card => {
                          // Filter out cards without product IDs (no images or links)
                          return card.tcgplayerProductId;
                      });
                  }
              }
              processedData = filteredData;
          }

          return processedData;

      } else { // Not grouped
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
          } else { // price-desc
              // Need to re-sort by selected price type
              for (const setName in setsData) {
                  processedData[setName] = [...setsData[setName]].sort((a, b) => parseFloat(b[priceField] || 0) - parseFloat(a[priceField] || 0));
              }
          }

          if (isFiltered) {
              const filteredData = {};
              for (const setName in processedData) {
                  filteredData[setName] = processedData[setName].filter(card => {
                      // Filter out cards without product IDs (no images or links)
                      if (!card.tcgplayerProductId) {
                          return false;
                      }
                      const threshold = this.RARITY_PRICE_THRESHOLDS[card.rarity] || 0;
                      const price = parseFloat(card[priceField] || 0);
                      // Include cards with zero/N/A price since we don't know if they're high value
                      return price === 0 || isNaN(price) || price > threshold;
                  });
              }
              processedData = filteredData;
          } else {
              // Even if not filtering by price, still filter out cards without product IDs
              const filteredData = {};
              for (const setName in processedData) {
                  filteredData[setName] = processedData[setName].filter(card => {
                      // Filter out cards without product IDs (no images or links)
                      return card.tcgplayerProductId;
                  });
              }
              processedData = filteredData;
          }

          return processedData;
      }
    },
    navigateToSort() {
      const url = new URL(window.location);
      url.searchParams.set('sort', this.sortBy);
      url.searchParams.set('priceType', this.priceType);
      url.searchParams.set('groupRarity', this.isGrouped);
      url.searchParams.set('filterValue', this.isFiltered);
      url.searchParams.set('filterPriceChange', this.filterPriceChangeStatus);
      window.history.pushState({}, '', url);
    },
    isMobileOrTablet() {
        const isMobile = window.innerWidth <= 1024;
        return isMobile;
    },
    showHoverImage(element, imageUrl, isFoilPage) {
        if (this.isMobileOrTablet()) return; // Don't show hover on mobile

        const rect = element.getBoundingClientRect();
        this.hoverImagePosition = {
            top: rect.bottom + window.scrollY + 5,
            left: rect.left + window.scrollX,
        };
        // Set imageUrl (can be null if image not available)
        this.hoverImageUrl = imageUrl;
        this.isFoilPage = isFoilPage;
        this.showImageError = false; // Reset error state when showing new image
        this.isHoverImageHorizontal = false; // Reset orientation until image loads
    },
    hideHoverImage() {
        this.hoverImageUrl = null;
        this.showImageError = false;
    },
    handleImageError(event) {
        // If image fails to load, show "Image Not Available" text
        this.showImageError = true;
        event.target.style.display = 'none';
    },
    handleHoverImageLoad(event) {
        // Check if image is horizontal (width > height)
        const img = event.target;
        if (img.naturalWidth && img.naturalHeight) {
            this.isHoverImageHorizontal = img.naturalWidth > img.naturalHeight;
        }
    },
    getPriceFieldName(priceType) {
        // Map price type to TCGplayer field name
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
        this.isMobileModalVisible = true;
        this.showModalImageError = false; // Reset error state when showing new modal
    },
    hideMobileModal() {
        this.isMobileModalVisible = false;
        this.mobileModalImageUrl = null;
        this.mobileModalCardName = null;
        this.mobileModalSetName = null;
        this.showModalImageError = false;
    },
    toggleNav() {
        this.isNavExpanded = !this.isNavExpanded;
    },
    isMobileOrTablet() {
        return window.innerWidth <= 1024;
    },
    getMobileTcgplayerLink() {
        if (!this.tcgplayerTrackingLink || !this.mobileModalCardName || !this.mobileModalSetName) {
            return '#';
        }
        
        // Find the card in the current data to get the product ID
        // Note: allSetsCardData is already filtered by isFoilPage, so we need to check the raw data
        let cardProductId = null;
        // We need to access the raw card data to find the card
        // Since allSetsCardData is filtered by current isFoilPage, we need to check both arrays
        // For now, we'll search in the current view's data
        const card = this.allSetsCardData[this.mobileModalSetName]?.find(c => c.name === this.mobileModalCardName);
        if (card && card.tcgplayerProductId) {
            cardProductId = card.tcgplayerProductId;
        }
        
        if (!cardProductId) {
            return '#';
        }
        
        // Convert to string for lookup (object keys are strings)
        const cardProductIdStr = String(cardProductId);
        
        // Get product info to construct proper URL
        let tcgplayerUrl = '';
        if (this.productInfoBySet && this.productInfoBySet[this.mobileModalSetName]) {
            const productInfo = this.productInfoBySet[this.mobileModalSetName][cardProductIdStr];
            if (productInfo && productInfo.url) {
                tcgplayerUrl = productInfo.url;
            }
        }
        
        // Fallback: construct URL from product ID and card name
        if (!tcgplayerUrl) {
            const setSlugMap = {
                'Alpha': 'alpha',
                'Beta': 'beta',
                'Arthurian Legends': 'arthurian-legends',
                'Arthurian Legends Promo': 'arthurian-legends-promo',
                'Dust Reward Promos': 'dust-reward-promos',
                'Dragonlord': 'dragonlord',
            };
            const setSlug = setSlugMap[this.mobileModalSetName] || this.mobileModalSetName.toLowerCase().replace(/\s+/g, '-');
            
            // Use cleanName from product info or fallback to card name
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
            
            tcgplayerUrl = `https://www.tcgplayer.com/product/${cardProductId}/sorcery-contested-realm-${setSlug}-${cardSlug}?Language=English`;
        }
        
        const encodedUrl = encodeURIComponent(tcgplayerUrl);
        return `${this.tcgplayerTrackingLink}?u=${encodedUrl}`;
    },
    handleModalImageError(event) {
        // If image fails to load in modal, show "Image Not Available" text
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
        // Show scroll-to-top button after scrolling down 300px
        this.showScrollToTop = window.scrollY > 300;
    }
  },
  watch: {
    sortBy: 'navigateToSort',
    priceType: 'navigateToSort',
    isGrouped: 'navigateToSort',
    isFiltered: 'navigateToSort',
    filterPriceChangeStatus: 'navigateToSort',
    isFoilPage: {
        handler(newVal) {
            this.loadAndRenderCards();
        },
        immediate: false, // We only want this to run on actual changes, not initial mount
    },
  },
  template: `
    <div>
        <nav :class="{ 'nav-expanded': isNavExpanded }">
            <div class="nav-header" v-if="isMobileOrTablet()">
                <button 
                   @click.stop.prevent="toggleNav" 
                   class="nav-hamburger"
                   :class="{ 'nav-hamburger-active': isNavExpanded }">
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                </button>
            </div>
            <div class="nav-links" :class="{ 'nav-links-visible': !isMobileOrTablet() || isNavExpanded }">
                <a href="#" @click.prevent="setFoilPage(false); isNavExpanded = false" :class="{ active: !isFoilPage }">Non-Foil Overview</a>
                <a href="#" @click.prevent="setFoilPage(true); isNavExpanded = false" :class="{ active: isFoilPage }">Foil Overview</a>
                <a href="terms-of-service.html" class="disclaimer-link" @click="isNavExpanded = false">Terms of Service</a>
                <a href="privacy-policy.html" class="disclaimer-link" @click="isNavExpanded = false">Privacy Policy</a>
                <a href="mailto:contact@sorcerersledger.com" class="contact-email" @click="isNavExpanded = false">contact@sorcerersledger.com</a>
            </div>
            <!-- Mobile menu backdrop -->
            <div v-if="isNavExpanded && isMobileOrTablet()" 
                 class="nav-backdrop" 
                 @click="isNavExpanded = false">
            </div>
        </nav>
        <h1>{{ isFoilPage ? "Sorcery Foil Card Prices Overview" : "Sorcery Non-Foil Card Prices Overview" }}</h1>

        <div class="sort-controls">
            <label for="sort-select">Sort by:</label>
            <select id="sort-select" v-model="sortBy">
                <option value="price-asc">Price (Low to High)</option>
                <option value="price-desc">Price (High to Low)</option>
                <option value="name-asc">Name (A to Z)</option>
                <option value="name-desc">Name (Z to A)</option>
            </select>
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
            <label for="group-by-rarity">Group by Rarity:<input type="checkbox" id="group-by-rarity" v-model="isGrouped"></label>
            <label for="filter-by-value">Show Only High Value Cards:<input type="checkbox" id="filter-by-value" v-model="isFiltered"></label>
            <label for="filter-by-price-change">Price Changes >= $1 (Last Week):<input type="checkbox" id="filter-by-price-change" v-model="filterPriceChangeStatus"></label>
        </div>

        <CardDisplay
            :setsDataToRender="setsDataToRender"
            :allSetsCardData="allSetsCardData"
            :RARITIES="RARITIES"
            :SET_ICONS="SET_ICONS"
            :isFoilPage="isFoilPage"
            :filterPriceChangeStatus="filterPriceChangeStatus"
            :allOldSetsCardData="allOldSetsCardData"
            :isGrouped="isGrouped"
            :priceType="priceType"
            :showHoverImage="showHoverImage.bind(this)"
            :hideHoverImage="hideHoverImage.bind(this)"
            :showMobileModal="showMobileModal.bind(this)"
            :tcgplayerTrackingLink="tcgplayerTrackingLink"
            :productInfoBySet="productInfoBySet"
        />

        <div v-if="hoverImageUrl !== null" 
             class="hover-image show-hover-image"
             :class="{ 'hover-image-horizontal': isHoverImageHorizontal }"
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
                <div v-if="mobileModalImageUrl && mobileModalIsFoil" class="foil-image-wrapper">
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
                
                <!-- Buy buttons for mobile -->
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

        <footer class="affiliate-disclosure-footer">
            <div class="affiliate-disclosure-content">
                <h3>Affiliate Disclosure</h3>
                <p>
                    Links on Sorcerer's Ledger to card vendors like TCGplayer are affiliate links. If you make a purchase through these links, we may earn a commission at no extra cost to you. This helps support our site.
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
  `,
  computed: {
    setsDataToRender() {
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
}).mount('#app')
