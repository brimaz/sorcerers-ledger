"""
TCGplayer product info generator.
Fetches product details from TCGplayer catalog API using group IDs and creates JSON files per set.
"""

import json
import os
from typing import Dict, List, Set
from tcgplayer_api import get_bearer_token, fetch_product_details, fetch_group_pricing
from shared_logger import logger

# Sorcery set to group ID mappings
SORCERY_SET_GROUP_IDS = {
    "Alpha": 23335,
    "Beta": 23336,
    "Dust Reward Promos": 23514,
    "Arthurian Legends Promo": 23778,
    "Arthurian Legends": 23588,
    "Dragonlord": 24378,
    # "Gothic": 24471,  # Commented out - no pricing data yet
}

TCGPLAYER_PRODUCT_TYPE_ID = 128  # Trading cards product type


def collect_product_ids_from_group_pricing(group_id: int, product_type_id: int, bearer_token: str) -> Set[int]:
    """
    Collect all product IDs from a group's pricing data.
    
    Args:
        group_id: TCGplayer group ID
        product_type_id: Product type ID
        bearer_token: Bearer token for API authentication
        
    Returns:
        Set of product IDs
    """
    product_ids = set()
    
    logger.info(f"Fetching pricing data for group {group_id}...")
    pricing_data = fetch_group_pricing(group_id, product_type_id, bearer_token)
    
    if pricing_data and pricing_data.get("success"):
        results = pricing_data.get("results", [])
        for price_info in results:
            product_id = price_info.get("productId")
            if product_id:
                product_ids.add(product_id)
        logger.info(f"Found {len(product_ids)} unique product IDs in pricing data")
    else:
        logger.warning(f"Could not fetch pricing data for group {group_id}")
    
    return product_ids


def fetch_products_in_batches(product_ids: List[int], bearer_token: str, batch_size: int = 100):
    """
    Fetch product details in batches to avoid URL length limits.
    
    Args:
        product_ids: List of product IDs to fetch
        bearer_token: Bearer token for API authentication
        batch_size: Number of product IDs per batch (default: 100)
        
    Returns:
        Dictionary mapping product_id -> product details
    """
    product_map = {}
    total_batches = (len(product_ids) + batch_size - 1) // batch_size
    
    for batch_num in range(total_batches):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, len(product_ids))
        batch_ids = product_ids[start_idx:end_idx]
        
        logger.info(f"Fetching product details batch {batch_num + 1}/{total_batches} ({len(batch_ids)} products)...")
        
        product_data = fetch_product_details(batch_ids, bearer_token)
        if product_data and product_data.get("success"):
            results = product_data.get("results", [])
            for product in results:
                product_id = product.get("productId")
                if product_id:
                    # Extract rarity from extendedData if available
                    # API uses getExtendedFields=true but returns extendedData property
                    rarity = ""
                    extended_data = product.get("extendedData", [])
                    if extended_data:
                        # Look for rarity in extended data
                        for field in extended_data:
                            field_name = field.get("name", "")
                            # Try exact match first
                            if field_name == "Rarity" or field_name.lower() == "rarity":
                                rarity_value = field.get("value", "")
                                # Normalize rarity values to match our expected format
                                # TCGplayer might return different casing or variations
                                rarity_map = {
                                    "unique": "Unique",
                                    "elite": "Elite",
                                    "exceptional": "Exceptional",
                                    "ordinary": "Ordinary"
                                }
                                rarity = rarity_map.get(rarity_value.lower(), rarity_value)
                                break
                        
                        # If still not found, try looking for any field containing "rarity"
                        if not rarity:
                            for field in extended_data:
                                field_name = field.get("name", "").lower()
                                if "rarity" in field_name:
                                    rarity_value = field.get("value", "")
                                    rarity_map = {
                                        "unique": "Unique",
                                        "elite": "Elite",
                                        "exceptional": "Exceptional",
                                        "ordinary": "Ordinary"
                                    }
                                    rarity = rarity_map.get(rarity_value.lower(), rarity_value)
                                    break
                    
                    # Extract only the fields we need
                    product_map[product_id] = {
                        "productId": product_id,
                        "name": product.get("name", ""),
                        "cleanName": product.get("cleanName", ""),
                        "imageUrl": product.get("imageUrl", ""),
                        "url": product.get("url", ""),  # TCGplayer product URL
                        "rarity": rarity  # Rarity from extended fields
                    }
            logger.info(f"✓ Retrieved {len(results)} products")
        else:
            logger.warning(f"✗ Failed to fetch batch")
    
    return product_map


def generate_product_info_files(output_dir: str = "card-data/product-info"):
    """
    Generate product info JSON files per set from TCGplayer catalog API using group IDs.
    
    Args:
        output_dir: Directory to save product info JSON files (default: card-data/product-info)
    """
    logger.info("Starting TCGplayer product info generation using group IDs...")
    logger.info(f"Processing {len(SORCERY_SET_GROUP_IDS)} sets")
    
    # Get bearer token
    bearer_token = get_bearer_token()
    if not bearer_token:
        logger.error("Could not obtain TCGplayer bearer token")
        return
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Process each set
    for set_name, group_id in SORCERY_SET_GROUP_IDS.items():
        logger.info("=" * 60)
        logger.info(f"Processing set: {set_name} (Group ID: {group_id})")
        logger.info("=" * 60)
        
        # Check if product info file already exists
        safe_set_name = set_name.replace(" ", "_").replace("/", "_")
        output_file = os.path.join(output_dir, f"product_info_{safe_set_name}.json")
        
        if os.path.exists(output_file):
            logger.info(f"✓ Product info file already exists: {output_file}")
            logger.info(f"Skipping generation (product info doesn't change frequently)")
            continue
        
        # Collect product IDs from pricing data
        product_ids_set = collect_product_ids_from_group_pricing(
            group_id, TCGPLAYER_PRODUCT_TYPE_ID, bearer_token
        )
        
        if not product_ids_set:
            logger.warning(f"No product IDs found for {set_name}, skipping...")
            continue
        
        logger.info(f"Total unique product IDs: {len(product_ids_set)}")
        
        # Convert set to list for batch processing
        product_ids_list = list(product_ids_set)
        
        # Fetch product details in batches
        product_map = fetch_products_in_batches(product_ids_list, bearer_token)
        
        if not product_map:
            logger.error(f"No product data retrieved for {set_name}")
            continue
        
        # Create product info array (sorted by product ID for consistency)
        product_info_list = []
        for product_id in sorted(product_ids_list):
            if product_id in product_map:
                product_info_list.append(product_map[product_id])
            else:
                logger.warning(f"Product ID {product_id} not found in API response")
        
        # Save to JSON file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(product_info_list, f, ensure_ascii=False, indent=2)
        
        logger.info(f"✓ Saved {len(product_info_list)} products to {output_file}")
    
    logger.info("=" * 60)
    logger.info("Product info generation complete!")
    logger.info("=" * 60)


if __name__ == "__main__":
    generate_product_info_files()
