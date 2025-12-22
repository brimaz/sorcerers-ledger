/**
 * Currency utility module for multi-currency support
 * Handles currency conversion, formatting, and exchange rate management
 */

// Exchange rates (USD as base currency)
// Rates are fetched from the server API and cached locally
let EXCHANGE_RATES = {
  USD: 1.0,
  EUR: 0.92,  // Default fallback rates
  AUD: 1.52,
  JPY: 150.0,
  NZD: 1.66,
  CAD: 1.35,
  GBP: 0.79,
  CHF: 0.88,
  SEK: 10.5,
  NOK: 10.6,
  DKK: 6.87,
};

// Track if rates have been loaded
let ratesLoaded = false;
let ratesLoadPromise = null;

// Currency display information
const CURRENCY_INFO = {
  USD: { symbol: '$', name: 'US Dollar', code: 'USD' },
  EUR: { symbol: '€', name: 'Euro', code: 'EUR' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', code: 'AUD' },
  JPY: { symbol: '¥', name: 'Japanese Yen', code: 'JPY' },
  NZD: { symbol: 'NZ$', name: 'New Zealand Dollar', code: 'NZD' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', code: 'CAD' },
  GBP: { symbol: '£', name: 'British Pound', code: 'GBP' },
  CHF: { symbol: 'CHF', name: 'Swiss Franc', code: 'CHF' },
  SEK: { symbol: 'kr', name: 'Swedish Krona', code: 'SEK' },
  NOK: { symbol: 'kr', name: 'Norwegian Krone', code: 'NOK' },
  DKK: { symbol: 'kr', name: 'Danish Krone', code: 'DKK' },
};

// Supported currencies list
export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_INFO);

// Default currency
const DEFAULT_CURRENCY = 'USD';

// Storage key for user's selected currency
const CURRENCY_STORAGE_KEY = 'sorcerers-ledger-currency';

/**
 * Get the currently selected currency from localStorage
 * @returns {string} Currency code (defaults to USD)
 */
export function getSelectedCurrency() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_CURRENCY;
  }
  
  try {
    const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (stored && SUPPORTED_CURRENCIES.includes(stored)) {
      return stored;
    }
  } catch (e) {
    console.warn('Failed to read currency from localStorage:', e);
  }
  
  return DEFAULT_CURRENCY;
}

/**
 * Set the selected currency in localStorage
 * @param {string} currencyCode - Currency code to set
 */
export function setSelectedCurrency(currencyCode) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  
  if (!SUPPORTED_CURRENCIES.includes(currencyCode)) {
    console.warn(`Invalid currency code: ${currencyCode}`);
    return;
  }
  
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, currencyCode);
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('currency-changed', { detail: { currency: currencyCode } }));
  } catch (e) {
    console.warn('Failed to save currency to localStorage:', e);
  }
}

/**
 * Get exchange rate for a currency (relative to USD)
 * @param {string} currencyCode - Currency code
 * @returns {number} Exchange rate
 */
export function getExchangeRate(currencyCode) {
  // Ensure rates are loaded (non-blocking)
  if (!ratesLoaded && !ratesLoadPromise) {
    ensureExchangeRatesLoaded().catch(() => {
      // Silently fail - will use default rates
    });
  }
  
  return EXCHANGE_RATES[currencyCode] || 1.0;
}

/**
 * Convert USD amount to another currency
 * @param {number} usdAmount - Amount in USD
 * @param {string} targetCurrency - Target currency code
 * @returns {number} Converted amount
 */
export function convertFromUSD(usdAmount, targetCurrency = null) {
  if (!targetCurrency) {
    targetCurrency = getSelectedCurrency();
  }
  
  if (targetCurrency === 'USD') {
    return usdAmount;
  }
  
  const rate = getExchangeRate(targetCurrency);
  return usdAmount * rate;
}

/**
 * Get currency information
 * @param {string} currencyCode - Currency code (defaults to selected currency)
 * @returns {Object} Currency info object with symbol, name, and code
 */
export function getCurrencyInfo(currencyCode = null) {
  if (!currencyCode) {
    currencyCode = getSelectedCurrency();
  }
  
  return CURRENCY_INFO[currencyCode] || CURRENCY_INFO[DEFAULT_CURRENCY];
}

/**
 * Format a price value with currency symbol
 * @param {number|string} price - Price value (in USD)
 * @param {Object} options - Formatting options
 * @param {string} options.currency - Currency code (defaults to selected currency)
 * @param {number} options.minimumFractionDigits - Minimum decimal places (default: 2)
 * @param {number} options.maximumFractionDigits - Maximum decimal places (default: 2)
 * @param {boolean} options.showSymbol - Whether to show currency symbol (default: true)
 * @returns {string} Formatted price string
 */
export function formatPrice(price, options = {}) {
  const {
    currency = null,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showSymbol = true
  } = options;
  
  // Handle invalid prices
  const priceNum = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(priceNum) || priceNum === 0) {
    return 'N/A';
  }
  
  const targetCurrency = currency || getSelectedCurrency();
  const convertedPrice = convertFromUSD(priceNum, targetCurrency);
  const currencyInfo = getCurrencyInfo(targetCurrency);
  
  // For JPY, typically no decimal places
  const minDecimals = targetCurrency === 'JPY' ? 0 : minimumFractionDigits;
  const maxDecimals = targetCurrency === 'JPY' ? 0 : maximumFractionDigits;
  
  // Format the number
  const formattedNumber = convertedPrice.toLocaleString('en-US', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
  
  if (!showSymbol) {
    return formattedNumber;
  }
  
  // Add currency symbol
  // For currencies with symbol before (most), add prefix
  // For currencies with symbol after (like some krone), add suffix
  if (targetCurrency === 'SEK' || targetCurrency === 'NOK' || targetCurrency === 'DKK') {
    return `${formattedNumber} ${currencyInfo.symbol}`;
  } else if (targetCurrency === 'CHF') {
    return `${currencyInfo.symbol} ${formattedNumber}`;
  } else {
    return `${currencyInfo.symbol}${formattedNumber}`;
  }
}

/**
 * Format price using Intl.NumberFormat (for more advanced formatting)
 * @param {number|string} price - Price value (in USD)
 * @param {Object} options - Formatting options
 * @returns {string} Formatted price string
 */
export function formatPriceIntl(price, options = {}) {
  const {
    currency = null,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2
  } = options;
  
  // Handle invalid prices
  const priceNum = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(priceNum) || priceNum === 0) {
    return 'N/A';
  }
  
  const targetCurrency = currency || getSelectedCurrency();
  const convertedPrice = convertFromUSD(priceNum, targetCurrency);
  
  // For JPY, typically no decimal places
  const minDecimals = targetCurrency === 'JPY' ? 0 : minimumFractionDigits;
  const maxDecimals = targetCurrency === 'JPY' ? 0 : maximumFractionDigits;
  
  try {
    // Try to use Intl.NumberFormat with currency
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: targetCurrency,
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals
    }).format(convertedPrice);
  } catch (e) {
    // Fallback to custom formatting if Intl doesn't support the currency
    return formatPrice(price, options);
  }
}

/**
 * Update exchange rates (called with fetched rates from server API)
 * @param {Object} rates - Object mapping currency codes to exchange rates
 */
export function updateExchangeRates(rates) {
  Object.keys(rates).forEach(currency => {
    if (EXCHANGE_RATES.hasOwnProperty(currency)) {
      EXCHANGE_RATES[currency] = rates[currency];
    }
  });
  
  ratesLoaded = true;
  
  // Dispatch event to notify components
  window.dispatchEvent(new CustomEvent('exchange-rates-updated'));
}

/**
 * Fetch exchange rates from server API
 * Rates are cached on the server and updated daily
 * @param {boolean} forceRefresh - Force server to refresh rates
 * @returns {Promise<void>}
 */
export async function fetchExchangeRates(forceRefresh = false) {
  // If already loading, return the existing promise
  if (ratesLoadPromise && !forceRefresh) {
    return ratesLoadPromise;
  }

  ratesLoadPromise = (async () => {
    try {
      const url = forceRefresh 
        ? '/api/exchange-rates?refresh=true'
        : '/api/exchange-rates';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.rates) {
        updateExchangeRates(data.rates);
        console.log('Exchange rates loaded from server', {
          lastUpdated: data.lastUpdated,
          currencies: Object.keys(data.rates).length
        });
      } else {
        throw new Error('Invalid response format: missing rates');
      }
    } catch (error) {
      console.warn('Failed to fetch exchange rates from server:', error);
      console.warn('Using default/fallback exchange rates');
      // Keep using default rates that are already set
      ratesLoaded = true; // Mark as loaded even with defaults
    }
  })();

  return ratesLoadPromise;
}

/**
 * Ensure exchange rates are loaded (called automatically on first use)
 * @returns {Promise<void>}
 */
export async function ensureExchangeRatesLoaded() {
  if (!ratesLoaded && !ratesLoadPromise) {
    await fetchExchangeRates();
  } else if (ratesLoadPromise) {
    await ratesLoadPromise;
  }
}

