"""
Sorcery: Contested Realm game configuration.
Contains all game-specific constants and rules.
"""

GAME_ID = "sorcery"
GAME_NAME = "Sorcerer's Ledger"

# TCGplayer product type for this game
TCGPLAYER_PRODUCT_TYPE_ID = 128  # Trading Cards (Sorcery)

# Set name → TCGplayer group ID
SET_GROUP_IDS = {
    "Alpha": 23335,
    "Beta": 23336,
    "Dust Reward Promos": 23514,
    "Arthurian Legends Promo": 23778,
    "Arthurian Legends": 23588,
    "Dragonlord": 24378,
    "Gothic": 24471,
}

# Rarity metadata
RARITIES = ["Unique", "Elite", "Exceptional", "Ordinary"]

RARITY_NORMALIZER = {
    "unique": "Unique",
    "elite": "Elite",
    "exceptional": "Exceptional",
    "ordinary": "Ordinary",
}

# Rules for categorizing products based on names
SEALED_KEYWORDS = [
    "booster box",
    "booster box case",
    "booster case",
    "booster pack",
    "pledge pack",
    "display",
    "booster display",
]

# Set-specific sealed product patterns: (set_name_lower, pattern_in_product_name)
SET_SPECIFIC_SEALED_PATTERNS = [
    ("dragonlord", "dragonlord box"),
]


def is_sealed_preconstructed_product_name(name: str) -> bool:
    """
    Determine if a product is a sealed preconstructed product.
    Includes deck boxes and decks without parentheses.
    """
    if not name:
        return False
    n = name.lower()
    return (
        "preconstructed deck box" in n or
        "preconstructed deck:" in n or
        ("preconstructed deck" in n and "(" not in name)
    )


def is_preconstructed_single_name(name: str) -> bool:
    """
    Determine if a product is a single card from a preconstructed deck.
    Only includes items with "(Preconstructed Deck)" in the name.
    """
    return "(Preconstructed Deck)" in (name or "")


def is_sealed_product_name(name: str, set_name: str = "") -> bool:
    """
    Determine if a product is a sealed product (not an individual card).
    Includes sealed preconstructed products (deck boxes, decks without parentheses).
    Excludes single cards like "(Pledge Pack)" or "(Preconstructed Deck)" items.
    """
    if not name:
        return False

    # Exclude single cards with parentheses (these are individual cards, not sealed)
    if "(Pledge Pack)" in name or "(Preconstructed Deck)" in name:
        return False

    n = name.lower()
    set_lower = (set_name or "").lower()

    # Check for sealed preconstructed products first
    if is_sealed_preconstructed_product_name(name):
        return True

    # Check for set-specific sealed products
    for base, pattern in SET_SPECIFIC_SEALED_PATTERNS:
        if base in set_lower and pattern in n:
            return True

    # Check for general sealed keywords
    return any(keyword in n for keyword in SEALED_KEYWORDS)

