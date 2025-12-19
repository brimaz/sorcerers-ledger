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

// Deck calculator Format 1 configuration (Sorcery-specific)
export const DECK_FORMAT1_CONFIG = {
  // Section headers to ignore when parsing Format 1 deck lists
  sectionsToIgnore: ['Avatar', 'Aura', 'Artifact', 'Minion', 'Magic', 'Site'],
  // Regex pattern to detect Format 1 section headers
  sectionHeaderPattern: /^(Avatar|Aura|Artifact|Minion|Magic|Site)\s*\(/i,
  // Custom placeholder text for the deck input
  placeholderText: 'Paste deck list here (supports 3 formats)\n\nFormat 1: Copy/paste from curiosa.io (including headers)\nFormat 2: \'1 Card Name\'\nFormat 3: \'2x Card Name\'',
  // Custom text for the format button
  formatButtonText: 'Format curiosa.io Deck List',
  // Custom text for the sample decklist button
  sampleDecklistButtonText: 'Show curiosa.io Sample Decklist',
  // Sample decklist for Format 1 guide
  sampleDecklist: `Avatar (1)
1Bladedancer
Aura (3)
2Summoning Sphere
1
1Atlantean Fate
5
Artifact (17)
1Amethyst Core
1
1Aquamarine Core
1
1Key to the City
1
1Philosopher's Stone
1
2Torshammar Trinket
1
1Poisonous Dagger
2
2Toolbox
2
2Blade of Thorns
3
1Crown of the Victor
3
2Sword and Shield
3
2Flaming Sword
4
1Rhongomyniad
4
Minion (31)
1Highland Princess
2
1Polar Explorers
2
1Sir Tom Thumb
2
2Tooth Faeries
2
3Brobdingnag Bullfrog
3
2Heretics of Seth
3
3Lugbog Cat
3
2Mesmer Demon
3
1Sir Pelleas
3
3Tufted Turtles
3
2Bound Spirit
4
2Hyperparasite
4
1Pirate Ship
4
1Ruler of Thul
4
1Archangel Raphael
5
1Hounds of Ondaros
5
2Lacuna Entity
5
1Maiden, Mother, Crone
5
1Questing Beast
5
Magic (9)
1Plague of Frogs
1
1Disenchant
2
1Lightning Bolt
2
1Marine Voyage
2
1Recall
2
1Attack by Night
3
2Invigorate
3
1Mesmerism
4
Site (30)
3Algae Bloom
3Aqueduct
1Dark Tower
3Deep Sea
3Floodplain
1Garden of Eden
1Gothic Tower
3Lighthouse
1Lone Tower
3Mountain Peaks
4Pond
1The Colour Out of Space
3Windmill
1Zap!
1
1Blink
2
1Disenchant
2
1Lightning Bolt
2
1Old Salt Anchorman
2
1Rain of Arrows
2
1Riptide
2
1Murder of Crows
3
Riptide
2Sjaelström
3`
};

