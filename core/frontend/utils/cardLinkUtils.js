/**
 * Utility functions for generating TCGplayer card links
 * Can be used across multiple components (CardItem, DeckCalculator, etc.)
 */

/**
 * Generate a TCGplayer link for a card
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.card - Card object with tcgplayerProductId
 * @param {string} options.setName - Name of the set
 * @param {string} options.cardName - Name of the card (fallback if productInfo not available)
 * @param {Object} options.gameConfig - Game configuration with SET_SLUG_MAP and TCGPLAYER_CATEGORY_SLUG
 * @param {Object} options.productInfoBySet - Product info by set name, keyed by product ID
 * @param {string} options.tcgplayerTrackingLink - Base TCGplayer tracking link URL
 * @returns {string} TCGplayer link URL, or '#' if invalid
 */
export function generateTcgplayerCardLink({
  card,
  setName,
  cardName,
  gameConfig = {},
  productInfoBySet = {},
  tcgplayerTrackingLink = ''
}) {
  // Validate required inputs
  if (!tcgplayerTrackingLink) {
    console.warn('generateTcgplayerCardLink: Missing tcgplayerTrackingLink', { tcgplayerTrackingLink });
    return '#';
  }
  if (!card || !card.tcgplayerProductId) {
    console.warn('generateTcgplayerCardLink: Missing card or card.tcgplayerProductId', { card, cardName });
    return '#';
  }
  if (!setName) {
    console.warn('generateTcgplayerCardLink: Missing setName', { cardName, setName });
    return '#';
  }
  
  const cardProductId = card.tcgplayerProductId;
  const cardProductIdStr = String(cardProductId);
  let tcgplayerUrl = '';
  
  // Try to get URL from product info first (most accurate)
  if (productInfoBySet && productInfoBySet[setName]) {
    const productInfo = productInfoBySet[setName][cardProductIdStr];
    if (productInfo && productInfo.url) {
      tcgplayerUrl = productInfo.url;
    }
  }
  
  // If no URL from product info, construct it from components
  if (!tcgplayerUrl) {
    const setSlugMap = gameConfig.SET_SLUG_MAP || {};
    const setSlug = setSlugMap[setName] || setName.toLowerCase().replace(/\s+/g, '-');
    
    // Try to get card slug from product info
    let cardSlug = '';
    if (productInfoBySet && productInfoBySet[setName]) {
      const productInfo = productInfoBySet[setName][cardProductIdStr];
      if (productInfo && productInfo.cleanName) {
        cardSlug = productInfo.cleanName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }
    }
    
    // Fallback to card name if no product info
    if (!cardSlug) {
      cardSlug = (cardName || card.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
    
    const categorySlug = gameConfig.TCGPLAYER_CATEGORY_SLUG || 'sorcery-contested-realm';
    tcgplayerUrl = `https://www.tcgplayer.com/product/${cardProductId}/${categorySlug}-${setSlug}-${cardSlug}?Language=English`;
  }
  
  // Encode and wrap with tracking link
  const encodedUrl = encodeURIComponent(tcgplayerUrl);
  return `${tcgplayerTrackingLink}?u=${encodedUrl}`;
}

/**
 * Get set slug from set name
 * 
 * @param {string} setName - Name of the set
 * @param {Object} setSlugMap - Map of set names to slugs
 * @returns {string} URL-friendly slug for the set
 */
export function getSetSlug(setName, setSlugMap = {}) {
  if (setSlugMap[setName]) {
    return setSlugMap[setName];
  }
  return setName.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Get card slug from card name or product info
 * 
 * @param {string} cardName - Name of the card
 * @param {Object} productInfo - Product info object (optional)
 * @returns {string} URL-friendly slug for the card
 */
export function getCardSlug(cardName, productInfo = null) {
  if (productInfo && productInfo.cleanName) {
    return productInfo.cleanName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
  return (cardName || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

