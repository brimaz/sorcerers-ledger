"""
TCGplayer pricing fetcher.
Fetches pricing data from TCGplayer API using group IDs and maps it to the card data structure.
"""

import json
import os
from typing import Dict
from tcgplayer_api import get_bearer_token, fetch_group_pricing
from tcgplayer_product_info import SORCERY_SET_GROUP_IDS
from shared_logger import logger

# Rarities (keeping for data structure compatibility)
RARITIES = ["Unique", "Elite", "Exceptional", "Ordinary"]

TCGPLAYER_PRODUCT_TYPE_ID = 128  # Trading cards product type


def _load_existing_card_data(output_file_path: str) -> dict:
    """Load existing card data from file."""
    try:
        with open(output_file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except Exception as e:
        logger.warning(f"Could not load existing card data: {e}")
        return {}


def _save_card_data_intermediate(data: dict, output_file_path: str):
    """Save card data to file."""
    try:
        with open(output_file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
    except Exception as e:
        logger.error(f"Error saving card data: {e}")


def _load_product_info_file(set_name: str, product_info_dir: str = "card-data/product-info") -> Dict[int, dict]:
    """
    Load product info file for a set and create a mapping by product ID.
    
    Args:
        set_name: Name of the set
        product_info_dir: Directory containing product info files (default: card-data/product-info)
        
    Returns:
        Dictionary mapping product_id -> product info
    """
    safe_set_name = set_name.replace(" ", "_").replace("/", "_")
    product_info_file = os.path.join(product_info_dir, f"product_info_{safe_set_name}.json")
    
    try:
        with open(product_info_file, 'r', encoding='utf-8') as f:
            product_info_list = json.load(f)
        
        product_map = {}
        for product in product_info_list:
            product_id = product.get("productId")
            if product_id:
                product_map[product_id] = product
        
        return product_map
    except FileNotFoundError:
        logger.warning(f"Product info file not found: {product_info_file}")
        return {}
    except Exception as e:
        logger.warning(f"Could not load product info file: {e}")
        return {}


def _create_price_mapping_from_group_pricing(pricing_data: dict) -> Dict[int, dict]:
    """
    Create a mapping of product ID to pricing information from group pricing response.
    
    Args:
        pricing_data: API response from fetch_group_pricing
        
    Returns:
        Dictionary mapping product_id -> pricing info
    """
    price_map = {}
    
    if not pricing_data or not pricing_data.get("success"):
        return price_map
    
    results = pricing_data.get("results", [])
    
    for price_info in results:
        product_id = price_info.get("productId")
        if product_id:
            price_map[product_id] = {
                "lowPrice": price_info.get("lowPrice", 0),
                "midPrice": price_info.get("midPrice", 0),
                "highPrice": price_info.get("highPrice", 0),
                "marketPrice": price_info.get("marketPrice", 0),
                "directLowPrice": price_info.get("directLowPrice"),
                "subTypeName": price_info.get("subTypeName", ""),  # "Normal" or "Foil"
            }
    
    return price_map


def _is_foil_product(sub_type_name: str) -> bool:
    """Determine if a product is foil based on subTypeName."""
    return sub_type_name and sub_type_name.lower() == "foil"


def _is_sealed_preconstructed_product(product_name: str) -> bool:
    """
    Determine if a product is a sealed preconstructed product.
    Includes deck boxes and decks without parentheses (e.g., "Preconstructed Deck Box", 
    "Preconstructed Deck: Air").
    Excludes singles with "(Preconstructed Deck)".
    
    Args:
        product_name: The product name to check
        
    Returns:
        True if the product is a sealed preconstructed product
    """
    if not product_name:
        return False
    
    product_name_lower = product_name.lower()
    
    # Check for sealed preconstructed products
    if "preconstructed deck box" in product_name_lower:
        return True
    if "preconstructed deck:" in product_name_lower:
        return True
    # Check for "Preconstructed Deck" without parentheses (sealed deck)
    if "preconstructed deck" in product_name_lower and "(" not in product_name:
        return True
    
    return False


def _is_preconstructed_product(product_name: str) -> bool:
    """
    Determine if a product is a single card from a preconstructed deck.
    Only includes items with "(Preconstructed Deck)" in the name.
    Excludes sealed products like "Preconstructed Deck Box" or "Preconstructed Deck: ".
    
    Args:
        product_name: The product name to check
        
    Returns:
        True if the product is a single card from a preconstructed deck
    """
    if not product_name:
        return False
    
    # Only items with "(Preconstructed Deck)" are singles from precons
    return "(Preconstructed Deck)" in product_name


def _is_sealed_product(product_name: str, set_name: str = "") -> bool:
    """
    Determine if a product is a sealed product (not an individual card).
    Includes sealed preconstructed products (deck boxes, decks without parentheses).
    Excludes single cards like "(Pledge Pack)" or "(Preconstructed Deck)" items.
    
    Args:
        product_name: The product name to check
        set_name: The set name (used for set-specific checks like "Dragonlord Box")
        
    Returns:
        True if the product is sealed (booster box, booster case, booster pack, 
        preconstructed deck box, preconstructed deck without parentheses, etc.)
    """
    if not product_name:
        return False
    
    # Exclude single cards with parentheses (these are individual cards, not sealed)
    if "(Pledge Pack)" in product_name or "(Preconstructed Deck)" in product_name:
        return False
    
    product_name_lower = product_name.lower()
    set_name_lower = set_name.lower() if set_name else ""
    
    # Check for sealed preconstructed products (deck boxes, decks without parentheses)
    if "preconstructed deck box" in product_name_lower:
        return True
    if "preconstructed deck:" in product_name_lower:
        return True
    # Check for "Preconstructed Deck" without parentheses (sealed deck)
    if "preconstructed deck" in product_name_lower and "(" not in product_name:
        return True
    
    # Keywords that indicate sealed products
    sealed_keywords = [
        "booster box",
        "booster box case",
        "booster case",
        "booster pack",
        "pledge pack",  # Only sealed pledge packs (without parentheses)
        "display",
        "booster display"
    ]
    
    # Check for set-specific sealed products (e.g., "Dragonlord Box" for Dragonlord set)
    if set_name_lower and f"{set_name_lower} box" in product_name_lower:
        return True
    
    return any(keyword in product_name_lower for keyword in sealed_keywords)


def generate_card_data_from_tcgplayer(
    output_file_path: str,
    product_type_id: int = 128,
    test_mode: bool = False,
    test_set_name: str = None
):
    """
    Generate card data JSON from TCGplayer API pricing data using group IDs.
    
    Args:
        output_file_path: Path to output JSON file
        product_type_id: Product type ID (default: 128 for Sorcery: Contested Realm)
        test_mode: If True, only process test set
        test_set_name: Set name to test (if test_mode is True)
    """
    logger.info("Starting TCGplayer card data generation using group IDs...")
    logger.info(f"Processing {len(SORCERY_SET_GROUP_IDS)} sets")
    
    # Load existing card data for resume functionality
    all_sets_processed_data = _load_existing_card_data(output_file_path)
    
    # Get bearer token
    bearer_token = get_bearer_token()
    if not bearer_token:
        logger.error("Could not obtain TCGplayer bearer token")
        return
    
    # Process each set
    for set_name, group_id in SORCERY_SET_GROUP_IDS.items():
        # Test mode filter
        if test_mode and set_name != test_set_name:
            continue
        
        logger.info("=" * 60)
        logger.info(f"Processing set: {set_name} (Group ID: {group_id})")
        logger.info("=" * 60)
        
        # Initialize set data structure if needed
        if set_name not in all_sets_processed_data:
            all_sets_processed_data[set_name] = {
                "nonFoil": [],
                "foil": [],
                "sealed": [],  # Sealed products (booster boxes, preconstructed deck boxes, etc.)
                "preconstructed": [],  # Individual cards from preconstructed decks
                "nonFoilByName": [],
                "foilByName": [],
                "sealedByName": [],
                "preconstructedByName": [],
                "nonFoilByRarityPrice": {r: [] for r in RARITIES},
                "foilByRarityPrice": {r: [] for r in RARITIES},
                "nonFoilByRarityName": {r: [] for r in RARITIES},
                "foilByRarityName": {r: [] for r in RARITIES},
            }
        
        # Get set data for checking existing products
        set_data = all_sets_processed_data[set_name]
        
        # Load product info for this set
        product_info_map = _load_product_info_file(set_name)
        if not product_info_map:
            logger.warning(f"No product info found for {set_name}, skipping...")
            continue
        
        logger.info(f"Loaded product info for {len(product_info_map)} products")
        
        # Fetch pricing data for the group
        logger.info(f"Fetching pricing data for group {group_id}...")
        pricing_data = fetch_group_pricing(group_id, product_type_id, bearer_token)
        
        if not pricing_data:
            logger.error(f"Could not fetch pricing data for {set_name}")
            continue
        
        # Create mapping of product ID to pricing
        price_map = _create_price_mapping_from_group_pricing(pricing_data)
        logger.info(f"Loaded pricing data for {len(price_map)} products")
        
        # Create a set of existing product IDs to avoid duplicates
        existing_product_ids = set()
        for card_list in [set_data.get("nonFoil", []), set_data.get("foil", []), 
                          set_data.get("sealed", []), set_data.get("preconstructed", [])]:
            for card in card_list:
                product_id = card.get("tcgplayerProductId")
                if product_id:
                    existing_product_ids.add(product_id)
        
        # Process each product with pricing data
        processed_count = 0
        skipped_count = 0
        for product_id, price_info in price_map.items():
            # Skip if product already exists (avoid duplicates when resuming)
            if product_id in existing_product_ids:
                skipped_count += 1
                continue
            # Get product details from product info
            product_details = product_info_map.get(product_id)
            if not product_details:
                logger.warning(f"Product ID {product_id} not found in product info, skipping...")
                continue
            
            product_name = product_details.get("name", "")
            if not product_name:
                continue
            
            # Check categorization order matters:
            # 1. Check if sealed preconstructed product (deck box, deck without parentheses) -> sealed
            # 2. Check if preconstructed single (has "(Preconstructed Deck)") -> preconstructed
            # 3. Check if sealed product (booster boxes, cases, packs, but not "(Pledge Pack)") -> sealed
            # 4. Otherwise -> regular card (nonFoil/foil)
            
            # Check for sealed preconstructed products first (these go to sealed, not preconstructed)
            is_sealed_precon = _is_sealed_preconstructed_product(product_name)
            
            # Check for preconstructed singles (only items with "(Preconstructed Deck)")
            is_preconstructed = _is_preconstructed_product(product_name) if not is_sealed_precon else False
            
            # Determine if this is a sealed product (booster boxes, cases, packs, sealed precons)
            # Exclude "(Pledge Pack)" singles - those are regular cards
            is_sealed = is_sealed_precon or (_is_sealed_product(product_name, set_name) if not is_preconstructed else False)
            
            # Determine if this is a foil product (only for individual cards, not sealed or preconstructed)
            # Check both subTypeName and product name for foil indication
            is_foil = False
            if not is_sealed and not is_preconstructed:
                is_foil = _is_foil_product(price_info.get("subTypeName", "")) or "(Foil)" in product_name
            
            # Helper function to safely convert price values (handles None)
            def safe_float(value, default=0.0):
                """Convert value to float, handling None values."""
                if value is None:
                    return default
                try:
                    return float(value)
                except (ValueError, TypeError):
                    return default
            
            # Extract pricing
            low_price = safe_float(price_info.get("lowPrice"))
            mid_price = safe_float(price_info.get("midPrice"))
            high_price = safe_float(price_info.get("highPrice"))
            market_price = safe_float(price_info.get("marketPrice"))
            # If marketPrice is 0, fall back to midPrice
            if market_price == 0.0:
                market_price = safe_float(price_info.get("midPrice"))
            
            # Get rarity from product info (only for individual cards, not sealed)
            rarity = product_details.get("rarity", "") if not is_sealed else ""
            
            # Create card info object (removed rarity and slug fields)
            card_info = {
                "name": product_name,
                "tcgplayerProductId": product_id,  # Store product ID for image lookup
                "tcgplayerLowPrice": f"{low_price:.2f}",
                "tcgplayerMidPrice": f"{mid_price:.2f}",
                "tcgplayerHighPrice": f"{high_price:.2f}",
                "tcgplayerMarketPrice": f"{market_price:.2f}",
                "set_name": set_name,
            }
            
            # Route to appropriate category
            if is_sealed:
                # Add to sealed products list (booster boxes, deck boxes, etc.)
                all_sets_processed_data[set_name]["sealed"].append(card_info)
            elif is_preconstructed:
                # Add to preconstructed cards list (individual cards from preconstructed decks)
                all_sets_processed_data[set_name]["preconstructed"].append(card_info)
            else:
                # Add to rarity-grouped lists if rarity is available
                if rarity and rarity in RARITIES:
                    if is_foil:
                        all_sets_processed_data[set_name]["foilByRarityPrice"][rarity].append(card_info)
                        all_sets_processed_data[set_name]["foilByRarityName"][rarity].append(card_info)
                    else:
                        all_sets_processed_data[set_name]["nonFoilByRarityPrice"][rarity].append(card_info)
                        all_sets_processed_data[set_name]["nonFoilByRarityName"][rarity].append(card_info)
                
                # Add to appropriate list based on foil/non-foil
                if is_foil:
                    all_sets_processed_data[set_name]["foil"].append(card_info)
                else:
                    all_sets_processed_data[set_name]["nonFoil"].append(card_info)
            
            processed_count += 1
        
        if skipped_count > 0:
            logger.info(f"Processed {processed_count} new products for {set_name} (skipped {skipped_count} already existing)")
        else:
            logger.info(f"Processed {processed_count} products for {set_name}")
    
    # Final sorting after all data is gathered for each set
    logger.info("Sorting card data...")
    for set_name in all_sets_processed_data:
        def sort_by_price(cards):
            # Sort by TCGplayer market price
            return sorted(cards, key=lambda x: float(x.get("tcgplayerMarketPrice", "0") or 0), reverse=True)
        
        def sort_by_name(cards):
            # Sort case-insensitively for consistent ordering
            return sorted(cards, key=lambda x: (x.get("name", "") or "").lower())
        
        all_sets_processed_data[set_name]["nonFoil"] = sort_by_price(all_sets_processed_data[set_name]["nonFoil"])
        all_sets_processed_data[set_name]["nonFoilByName"] = sort_by_name(all_sets_processed_data[set_name]["nonFoil"])
        
        all_sets_processed_data[set_name]["foil"] = sort_by_price(all_sets_processed_data[set_name]["foil"])
        all_sets_processed_data[set_name]["foilByName"] = sort_by_name(all_sets_processed_data[set_name]["foil"])
        
        all_sets_processed_data[set_name]["sealed"] = sort_by_price(all_sets_processed_data[set_name]["sealed"])
        all_sets_processed_data[set_name]["sealedByName"] = sort_by_name(all_sets_processed_data[set_name]["sealed"])
        
        all_sets_processed_data[set_name]["preconstructed"] = sort_by_price(all_sets_processed_data[set_name]["preconstructed"])
        all_sets_processed_data[set_name]["preconstructedByName"] = sort_by_name(all_sets_processed_data[set_name]["preconstructed"])
        
        for rarity_key in RARITIES:
            all_sets_processed_data[set_name]["nonFoilByRarityPrice"][rarity_key] = sort_by_price(
                all_sets_processed_data[set_name]["nonFoilByRarityPrice"][rarity_key]
            )
            all_sets_processed_data[set_name]["nonFoilByRarityName"][rarity_key] = sort_by_name(
                all_sets_processed_data[set_name]["nonFoilByRarityName"][rarity_key]
            )
            
            all_sets_processed_data[set_name]["foilByRarityPrice"][rarity_key] = sort_by_price(
                all_sets_processed_data[set_name]["foilByRarityPrice"][rarity_key]
            )
            all_sets_processed_data[set_name]["foilByRarityName"][rarity_key] = sort_by_name(
                all_sets_processed_data[set_name]["foilByRarityName"][rarity_key]
            )
    
    # Final save with sorted data
    _save_card_data_intermediate(all_sets_processed_data, output_file_path)
    logger.info(f"Final save complete. Card data saved to {output_file_path}")
