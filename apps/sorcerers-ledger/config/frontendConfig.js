// Sorcery: Contested Realm frontend configuration

export const GAME_ID = 'sorcery';
export const GAME_TITLE = "Sorcerer's Ledger";

// Legal and contact information
export const GAME_NAME = "Sorcery: Contested Realm™";
export const PUBLISHER_NAME = "Erik's Curiosa Limited";
export const CONTACT_EMAIL = "contact@sorcerersledger.com";

export const RARITIES = ["Unique", "Elite", "Exceptional", "Ordinary"];

export const RARITY_PRICE_THRESHOLDS = {
  Unique: 1.5,
  Elite: 1.5,
  Exceptional: 0.75,
  Ordinary: 0.75,
};

export const SET_ICONS = {
  "Alpha": "α",
  "Beta": "β",
  "Alpha (Preconstructed)": "α",
  "Beta (Preconstructed)": "β",
  "Dust Reward Promos": "★",
  "Arthurian Legends Promo": "★",
  "Arthurian Legends": "⚔️",
  "Dragonlord": "🐉",
  "Gothic": "🦇",
};

export const SET_ORDER = [
  "Alpha",
  "Alpha (Preconstructed)",
  "Beta",
  "Beta (Preconstructed)",
  "Dust Reward Promos",
  "Arthurian Legends",
  "Arthurian Legends Promo",
  "Dragonlord",
  "Gothic",
];

// For fallback URL building if productInfo URL is missing
export const TCGPLAYER_CATEGORY_SLUG = "sorcery-contested-realm";

export const SET_SLUG_MAP = {
  "Alpha": "alpha",
  "Beta": "beta",
  "Alpha (Preconstructed)": "alpha",
  "Beta (Preconstructed)": "beta",
  "Arthurian Legends": "arthurian-legends",
  "Arthurian Legends Promo": "arthurian-legends-promo",
  "Dust Reward Promos": "dust-reward-promos",
  "Dragonlord": "dragonlord",
  "Gothic": "gothic",
};

// Which sets to treat as "preconstructed" source sets
export const PRECON_SOURCE_SETS = ["Alpha", "Beta"];

