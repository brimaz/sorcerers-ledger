/**
 * Exchange Rate Service
 * Fetches and caches exchange rates daily from a free API
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Path to store exchange rates (similar to tcgplayer_token.json)
const repoRoot = path.join(__dirname, '..', '..', '..');
const RATES_FILE = path.join(repoRoot, 'exchange_rates.json');

// Free exchange rate API (no API key required for basic usage)
// Using exchangerate-api.com - free tier allows 1,500 requests/month
const EXCHANGE_RATE_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

// Supported currencies (USD is base, so rate is always 1.0)
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'AUD', 'JPY', 'NZD', 'CAD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK'];

// Lock to prevent concurrent API calls
let apiCallInProgress = null;

/**
 * Fetch exchange rates from API
 * @returns {Promise<Object>} Exchange rates object
 */
function fetchExchangeRatesFromAPI() {
  console.log('Exchange rate API hit - fetching from exchangerate-api.com');
  return new Promise((resolve, reject) => {
    https.get(EXCHANGE_RATE_API_URL, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          
          if (jsonData.rates) {
            // Extract only the currencies we support
            const rates = {
              USD: 1.0, // Base currency
              lastUpdated: new Date().toISOString(),
              source: 'exchangerate-api.com'
            };

            SUPPORTED_CURRENCIES.forEach(currency => {
              if (currency !== 'USD' && jsonData.rates[currency]) {
                rates[currency] = jsonData.rates[currency];
              }
            });

            resolve(rates);
          } else {
            reject(new Error('Invalid API response: missing rates'));
          }
        } catch (error) {
          reject(new Error(`Failed to parse API response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Failed to fetch exchange rates: ${error.message}`));
    });
  });
}

/**
 * Load exchange rates from file
 * @returns {Object|null} Exchange rates or null if file doesn't exist
 */
function loadExchangeRatesFromFile() {
  try {
    if (fs.existsSync(RATES_FILE)) {
      const data = fs.readFileSync(RATES_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('Failed to load exchange rates from file:', error.message);
  }
  return null;
}

/**
 * Save exchange rates to file
 * @param {Object} rates - Exchange rates object
 */
function saveExchangeRatesToFile(rates) {
  try {
    fs.writeFileSync(RATES_FILE, JSON.stringify(rates, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save exchange rates to file:', error.message);
  }
}

/**
 * Check if rates need to be refreshed (older than 24 hours)
 * @param {Object} rates - Exchange rates object
 * @returns {boolean} True if rates need refresh
 */
function needsRefresh(rates) {
  if (!rates || !rates.lastUpdated) {
    return true;
  }

  const lastUpdated = new Date(rates.lastUpdated);
  const now = new Date();
  const hoursSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60);

  // Refresh if older than 20 hours (refresh daily, with some buffer)
  return hoursSinceUpdate > 20;
}

/**
 * Get exchange rates, fetching from API if needed
 * @param {boolean} forceRefresh - Force refresh even if rates are recent
 * @returns {Promise<Object>} Exchange rates
 */
async function getExchangeRates(forceRefresh = false) {
  // Try to load from file first
  let rates = loadExchangeRatesFromFile();

  // If we need to refresh (or force refresh), fetch from API
  if (forceRefresh || needsRefresh(rates)) {
    // If an API call is already in progress, wait for it to complete
    if (apiCallInProgress) {
      console.log('Exchange rate API call already in progress, waiting for it to complete...');
      try {
        const fetchedRates = await apiCallInProgress;
        // Save the fetched rates and return them (don't clear lock - original caller will do that)
        saveExchangeRatesToFile(fetchedRates);
        return fetchedRates;
      } catch (error) {
        // If the in-progress call failed, continue with our own attempt
        console.warn('Previous API call failed, attempting new fetch...');
        apiCallInProgress = null;
      }
    }

    // Start a new API call
    try {
      console.log('Fetching fresh exchange rates from API...');
      apiCallInProgress = fetchExchangeRatesFromAPI();
      rates = await apiCallInProgress;
      saveExchangeRatesToFile(rates);
      console.log('Exchange rates updated successfully');
      apiCallInProgress = null; // Clear the lock
    } catch (error) {
      apiCallInProgress = null; // Clear the lock on error
      console.error('Failed to fetch exchange rates:', error.message);
      
      // If we have cached rates, use them even if stale
      if (rates) {
        console.log('Using cached exchange rates (may be stale)');
        return rates;
      }
      
      // If no cached rates and fetch failed, return default rates
      console.warn('No cached rates available, using default rates');
      return getDefaultRates();
    }
  } else {
    console.log('Using cached exchange rates (still fresh)');
  }

  return rates;
}

/**
 * Get default exchange rates (fallback if API fails)
 * @returns {Object} Default exchange rates
 */
function getDefaultRates() {
  return {
    USD: 1.0,
    EUR: 0.92,
    AUD: 1.52,
    JPY: 150.0,
    NZD: 1.66,
    CAD: 1.35,
    GBP: 0.79,
    CHF: 0.88,
    SEK: 10.5,
    NOK: 10.6,
    DKK: 6.87,
    lastUpdated: new Date().toISOString(),
    source: 'default'
  };
}

/**
 * Initialize exchange rates on server startup
 * This will fetch rates if they don't exist or are stale
 */
async function initializeExchangeRates() {
  try {
    await getExchangeRates(false); // Don't force refresh on startup
  } catch (error) {
    console.error('Failed to initialize exchange rates:', error.message);
    // Save default rates if initialization fails
    saveExchangeRatesToFile(getDefaultRates());
  }
}

/**
 * Start scheduled daily refresh of exchange rates
 * Checks every hour and refreshes if rates are stale
 */
function startScheduledRefresh() {
  // Check every hour if rates need refresh
  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  
  setInterval(async () => {
    try {
      const rates = loadExchangeRatesFromFile();
      if (needsRefresh(rates)) {
        console.log('Scheduled refresh: Exchange rates are stale, fetching fresh rates...');
        await getExchangeRates(false); // Don't force - let internal needsRefresh check handle it
      }
    } catch (error) {
      console.error('Scheduled refresh error:', error.message);
    }
  }, CHECK_INTERVAL_MS);
  
  console.log('Exchange rate scheduled refresh started (checks every hour)');
}

module.exports = {
  getExchangeRates,
  initializeExchangeRates,
  startScheduledRefresh,
  getDefaultRates
};

