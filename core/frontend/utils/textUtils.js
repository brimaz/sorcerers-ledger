/**
 * Text utility functions for frontend components
 * 
 * Shared utilities for text processing, normalization, and matching.
 */

/**
 * Convert non-American English characters to their American English equivalents.
 * Examples: ï -> i, Ä -> A, é -> e, ö -> o, etc.
 * This matches the Python normalize_to_american_english function from ebay-scripts/ebay_parser.py.
 * 
 * @param {string} text - Input string that may contain non-ASCII characters
 * @returns {string} String with characters normalized to American English equivalents
 */
export function normalizeToAmericanEnglish(text) {
  if (!text) {
    return text;
  }
  
  // Normalize to NFD (decomposed form) which separates base characters from diacritics
  // Then remove combining diacritical marks using regex
  // Combining marks are in the Unicode range \u0300-\u036F and related ranges
  const normalized = text.normalize('NFD');
  // Remove combining diacritical marks (Unicode category Mn - Mark, nonspacing)
  // This regex matches combining marks in the most common ranges:
  // \u0300-\u036F: Combining Diacritical Marks
  // \u1AB0-\u1AFF: Combining Diacritical Marks Extended
  // \u1DC0-\u1DFF: Combining Diacritical Marks Supplement
  // \u20D0-\u20FF: Combining Diacritical Marks for Symbols
  // \uFE20-\uFE2F: Combining Half Marks
  const asciiText = normalized.replace(/[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g, '');
  // Normalize back to NFC (composed form) for consistency
  return asciiText.normalize('NFC');
}

