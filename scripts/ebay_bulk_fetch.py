#!/usr/bin/env python3
"""
eBay Bulk Fetch Parser: Fetch all Sorcery Contested Realm listings by set,
then filter and aggregate by card to generate card_data.json.

This reduces API calls from hundreds to just a few calls per set (typically 2 per set).
"""

import json
import os
import re
import requests
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from config import EBAY_BUY_API_ENDPOINT
from ebay_auth import get_application_access_token
from ebay_parser import (
    _make_rate_limited_request,
    _wait_for_rate_limit,
    is_foil_item,
    is_graded_card,
    should_exclude_item,
    normalize_to_american_english,
    load_master_card_list,
    RARITIES
)

# Cache for exchange rates to avoid repeated API calls
_exchange_rate_cache = {}

def get_exchange_rate_to_usd(currency: str) -> float:
    """
    Get exchange rate from given currency to USD.
    Uses exchangerate-api.com (free, no API key required).
    Caches rates to avoid repeated API calls.
    
    Args:
        currency: Currency code (e.g., 'EUR', 'GBP', 'CAD')
        
    Returns:
        Exchange rate (multiply foreign currency by this to get USD)
    """
    if currency.upper() == 'USD':
        return 1.0
    
    currency = currency.upper()
    
    # Check cache first
    if currency in _exchange_rate_cache:
        return _exchange_rate_cache[currency]
    
    try:
        # Use exchangerate-api.com free endpoint (no API key needed)
        # This gets rates from European Central Bank
        url = f"https://api.exchangerate-api.com/v4/latest/{currency}"
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        # Get USD rate
        usd_rate = data.get('rates', {}).get('USD', None)
        if usd_rate:
            _exchange_rate_cache[currency] = usd_rate
            return usd_rate
        else:
            print(f"  [WARNING] Could not find USD rate for {currency}, assuming 1.0")
            return 1.0
    except Exception as e:
        print(f"  [WARNING] Error fetching exchange rate for {currency}: {e}")
        print(f"  [WARNING] Assuming 1.0 (no conversion)")
        return 1.0

def convert_price_to_usd(price_value: float, currency: str) -> float:
    """
    Convert a price to USD.
    
    Args:
        price_value: The price value
        currency: Currency code (e.g., 'USD', 'EUR', 'GBP')
        
    Returns:
        Price in USD
    """
    if currency.upper() == 'USD':
        return price_value
    
    exchange_rate = get_exchange_rate_to_usd(currency)
    return price_value * exchange_rate

def fetch_all_sold_listings(query: str) -> List[dict]:
    """
    Fetch all sold listings for a query with pagination.
    Returns all items across all pages.
    """
    ebay_access_token = os.environ.get("EBAY_ACCESS_TOKEN")
    if not ebay_access_token:
        print("EBAY_ACCESS_TOKEN not found. Please ensure batch_update.py sets it.")
        return []
    
    headers = {
        "Authorization": f"Bearer {ebay_access_token}",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json"
    }
    
    print(f"Fetching all SOLD listings for: {query}")
    all_items = []
    offset = 0
    limit = 200
    max_items = 10000
    
    while offset < max_items:
        params = {
            "q": query,
            "filter": "itemSoldOutcome:{SOLD}",
            "limit": limit,
            "offset": offset,
            "sort": "-endDate"
        }
        
        response = _make_rate_limited_request(EBAY_BUY_API_ENDPOINT, headers, params)
        if response is None:
            break
        
        data = response.json()
        page_items = data.get("itemSummaries", [])
        
        if offset == 0:
            total_items = data.get("total", 0)
            print(f"  Total sold items available: {total_items}")
        
        all_items.extend(page_items)
        print(f"  Fetched page {offset // limit + 1}: {len(page_items)} items (total so far: {len(all_items)})")
        
        # Check if we've retrieved all available items
        if len(all_items) >= total_items:
            print(f"  Retrieved all {total_items} items reported by API")
            break
        
        if len(page_items) < limit:
            if len(page_items) == 0:
                print(f"  No more items available (got 0 items on this page)")
                break
            if len(all_items) < total_items * 0.1:
                print(f"  [WARNING] Got {len(page_items)} items (less than limit {limit}) but API reports {total_items} total")
                print(f"  [WARNING] eBay Buy API has a maximum return limit (~500-1000 items) even if more exist")
                print(f"  [WARNING] Stopping pagination - API will not return more results")
                break
        
        offset += limit
    
    if len(all_items) < total_items:
        print(f"  [NOTE] Fetched {len(all_items)} items but API reports {total_items} total")
        print(f"  [NOTE] This is a known eBay Buy API limitation - it caps results at ~500-1000 items")
    print(f"  Total sold items fetched: {len(all_items)}")
    return all_items

def fetch_all_current_listings(query: str) -> List[dict]:
    """
    Fetch all current listings for a query with pagination.
    Returns all items across all pages.
    """
    ebay_access_token = os.environ.get("EBAY_ACCESS_TOKEN")
    if not ebay_access_token:
        print("EBAY_ACCESS_TOKEN not found. Please ensure batch_update.py sets it.")
        return []
    
    headers = {
        "Authorization": f"Bearer {ebay_access_token}",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json"
    }
    
    print(f"Fetching all CURRENT listings for: {query}")
    all_items = []
    offset = 0
    limit = 200
    max_items = 10000
    
    while offset < max_items:
        params = {
            "q": query,
            "limit": limit,
            "offset": offset
        }
        
        response = _make_rate_limited_request(EBAY_BUY_API_ENDPOINT, headers, params)
        if response is None:
            break
        
        data = response.json()
        page_items = data.get("itemSummaries", [])
        
        if offset == 0:
            total_items = data.get("total", 0)
            print(f"  Total current items available: {total_items}")
        
        all_items.extend(page_items)
        print(f"  Fetched page {offset // limit + 1}: {len(page_items)} items (total so far: {len(all_items)})")
        
        # Check if we've retrieved all available items
        if len(all_items) >= total_items:
            print(f"  Retrieved all {total_items} items reported by API")
            break
        
        if len(page_items) < limit:
            if len(page_items) == 0:
                print(f"  No more items available (got 0 items on this page)")
                break
            if len(all_items) < total_items * 0.1:
                print(f"  [WARNING] Got {len(page_items)} items (less than limit {limit}) but API reports {total_items} total")
                print(f"  [WARNING] eBay Buy API has a maximum return limit (~500-1000 items) even if more exist")
                print(f"  [WARNING] Stopping pagination - API will not return more results")
                break
        
        offset += limit
    
    if len(all_items) < total_items:
        print(f"  [NOTE] Fetched {len(all_items)} items but API reports {total_items} total")
        print(f"  [NOTE] This is a known eBay Buy API limitation - it caps results at ~500-1000 items")
    print(f"  Total current items fetched: {len(all_items)}")
    return all_items

def is_promo_card(title: str, set_name: str) -> bool:
    """
    Check if a listing is a promo card.
    Returns True if:
    1. The title contains "promo" (case-insensitive), OR
    2. The set name is a known promo set
    """
    # Check if title contains "promo"
    normalized_title = normalize_to_american_english(title).lower()
    if "promo" in normalized_title:
        return True
    
    # Check if set name is a promo set
    promo_sets = [
        "Dust Reward Promos",
        "Arthurian Legends Promo",
        "dustRewardPromo",
        "arthurianLegendsPromo"
    ]
    
    normalized_set_name = normalize_to_american_english(set_name).lower()
    for promo_set in promo_sets:
        if normalize_to_american_english(promo_set).lower() == normalized_set_name:
            return True
    
    return False

def extract_card_info_from_title(title: str, master_card_list: Dict) -> Optional[Tuple[str, str]]:
    """
    Try to extract card name and set name from an eBay listing title.
    Returns (card_name, set_name) if found, None otherwise.
    Uses word boundary matching for better accuracy.
    Excludes promo sets and cards with "promo" in the title.
    """
    
    # Normalize title for matching
    normalized_title = normalize_to_american_english(title).lower()
    
    # Skip if title contains "promo" - we want to exclude promo cards
    if "promo" in normalized_title:
        return None
    
    # Try to match against master card list
    # Sort by card name length (longer names first) to avoid partial matches
    cards_sorted = sorted(master_card_list.items(), key=lambda x: len(x[0]), reverse=True)
    
    # Define promo sets to exclude
    promo_sets = [
        "Dust Reward Promos",
        "Arthurian Legends Promo",
        "dustRewardPromo",
        "arthurianLegendsPromo"
    ]
    normalized_promo_sets = {normalize_to_american_english(ps).lower() for ps in promo_sets}
    
    for card_name, card_info in cards_sorted:
        normalized_card_name = normalize_to_american_english(card_name).lower()
        
        # Create word boundary pattern for card name
        # Escape special regex characters
        card_pattern = r'\b' + re.escape(normalized_card_name) + r'\b'
        
        # Check if card name appears in title with word boundaries
        if not re.search(card_pattern, normalized_title):
            continue
        
        # Check each set for this card
        # Sort sets by name length (longer first) for better matching
        sets_sorted = sorted(card_info.get("sets", []), key=lambda x: len(x.get("set_name", "")), reverse=True)
        
        for set_info in sets_sorted:
            set_name = set_info.get("set_name", "")
            if not set_name:
                continue
            
            # Skip promo sets
            normalized_set_name = normalize_to_american_english(set_name).lower()
            if normalized_set_name in normalized_promo_sets:
                continue
            
            # Create word boundary pattern for set name
            set_pattern = r'\b' + re.escape(normalized_set_name) + r'\b'
            
            # Check if set name appears in title with word boundaries
            if re.search(set_pattern, normalized_title):
                return (card_name, set_name)
    
    return None

def filter_and_group_listings(sold_items: List[dict], current_items: List[dict], master_card_list: Dict) -> Dict:
    """
    Filter listings and group by card name, set, and foil/non-foil.
    Returns: {
        (card_name, set_name, is_foil): {
            'sold_prices': [...],
            'current_prices': [...],
            'completed_prices': [...]  # Same as sold for now
        }
    }
    """
    all_items = sold_items + current_items
    total_items = len(all_items)
    print(f"\nFiltering and grouping {total_items} listings ({len(sold_items)} sold, {len(current_items)} current)...")
    
    grouped = {}
    excluded_graded = 0
    excluded_keywords = 0
    excluded_promo = 0
    unmatched = 0
    matched = 0
    processed_count = 0
    
    # Progress update interval (update every N items)
    PROGRESS_INTERVAL = max(100, total_items // 20)  # Update at least 20 times, or every 100 items
    
    # Process sold items
    print(f"\nProcessing {len(sold_items)} sold items...")
    for idx, item in enumerate(sold_items):
        processed_count += 1
        
        # Show progress periodically
        if processed_count % PROGRESS_INTERVAL == 0 or processed_count == total_items:
            percentage = (processed_count / total_items) * 100
            print(f"  Progress: {processed_count:,}/{total_items:,} ({percentage:.1f}%) - Matched: {matched:,}, Excluded: {excluded_graded + excluded_keywords + excluded_promo:,}, Unmatched: {unmatched:,}")
        # Filter out graded cards
        if is_graded_card(item):
            excluded_graded += 1
            continue
        
        # Filter out bulk/lot listings
        if should_exclude_item(item):
            excluded_keywords += 1
            continue
        
        # Try to extract card info from title
        title = item.get("title", "")
        card_info = extract_card_info_from_title(title, master_card_list)
        
        if card_info is None:
            unmatched += 1
            continue
        
        card_name, set_name = card_info
        
        # Double-check for promo cards (in case they slipped through)
        if is_promo_card(title, set_name):
            excluded_promo += 1
            continue
        
        is_foil = is_foil_item(item)
        
        # Get price and currency
        price_info = item.get("price", {})
        price_value = price_info.get("value", "0.0")
        currency = price_info.get("currency", "USD")
        
        try:
            price = float(price_value)
            # Convert to USD if needed
            price_usd = convert_price_to_usd(price, currency)
        except (ValueError, TypeError):
            continue
        
        # Group by (card_name, set_name, is_foil)
        key = (card_name, set_name, is_foil)
        if key not in grouped:
            grouped[key] = {
                'sold_prices': [],
                'current_prices': [],
                'completed_prices': []
            }
        
        grouped[key]['sold_prices'].append(price_usd)
        grouped[key]['completed_prices'].append(price_usd)
        matched += 1
    
    # Process current items
    print(f"\nProcessing {len(current_items)} current items...")
    for idx, item in enumerate(current_items):
        processed_count += 1
        
        # Show progress periodically
        if processed_count % PROGRESS_INTERVAL == 0 or processed_count == total_items:
            percentage = (processed_count / total_items) * 100
            print(f"  Progress: {processed_count:,}/{total_items:,} ({percentage:.1f}%) - Matched: {matched:,}, Excluded: {excluded_graded + excluded_keywords + excluded_promo:,}, Unmatched: {unmatched:,}")
        # Filter out graded cards
        if is_graded_card(item):
            excluded_graded += 1
            continue
        
        # Filter out bulk/lot listings
        if should_exclude_item(item):
            excluded_keywords += 1
            continue
        
        # Try to extract card info from title
        title = item.get("title", "")
        card_info = extract_card_info_from_title(title, master_card_list)
        
        if card_info is None:
            unmatched += 1
            continue
        
        card_name, set_name = card_info
        
        # Double-check for promo cards (in case they slipped through)
        if is_promo_card(title, set_name):
            excluded_promo += 1
            continue
        
        is_foil = is_foil_item(item)
        
        # Get price and currency
        price_info = item.get("price", {})
        price_value = price_info.get("value", "0.0")
        currency = price_info.get("currency", "USD")
        
        try:
            price = float(price_value)
            # Convert to USD if needed
            price_usd = convert_price_to_usd(price, currency)
        except (ValueError, TypeError):
            continue
        
        # Group by (card_name, set_name, is_foil)
        key = (card_name, set_name, is_foil)
        if key not in grouped:
            grouped[key] = {
                'sold_prices': [],
                'current_prices': [],
                'completed_prices': []
            }
        
        grouped[key]['current_prices'].append(price_usd)
        matched += 1
    
    # Final progress update
    print(f"\n  Progress: {processed_count:,}/{total_items:,} (100.0%) - Complete!")
    print(f"\n  Filtering Summary:")
    print(f"    Excluded {excluded_graded:,} graded cards")
    print(f"    Excluded {excluded_keywords:,} bulk/lot listings")
    print(f"    Excluded {excluded_promo:,} promo cards")
    print(f"    Unmatched: {unmatched:,} listings")
    print(f"    Matched: {matched:,} listings")
    print(f"    Unique card/set/foil combinations: {len(grouped):,}")
    
    return grouped

def calculate_medians(grouped_data: Dict) -> Dict:
    """
    Calculate median prices for each card/set/foil combination.
    Returns same structure but with medians instead of price lists.
    Median is more robust to outliers than average.
    """
    print("\nCalculating median prices...")
    
    medians = {}
    
    def get_median(prices: List[float]) -> float:
        """Calculate median of a list of prices."""
        if not prices:
            return 0.0
        sorted_prices = sorted(prices)
        n = len(sorted_prices)
        if n % 2 == 0:
            # Even number of items - average the two middle values
            return (sorted_prices[n // 2 - 1] + sorted_prices[n // 2]) / 2.0
        else:
            # Odd number of items - return the middle value
            return sorted_prices[n // 2]
    
    for (card_name, set_name, is_foil), prices in grouped_data.items():
        sold_prices = prices['sold_prices']
        current_prices = prices['current_prices']
        completed_prices = prices['completed_prices']
        
        median_sold = get_median(sold_prices)
        median_current = get_median(current_prices)
        median_completed = get_median(completed_prices)
        
        # Market price: median of sold and current medians (same as original logic but with medians)
        market_price = (median_sold + median_current) / 2 if (median_sold > 0 and median_current > 0) else (median_sold if median_sold > 0 else median_current)
        
        medians[(card_name, set_name, is_foil)] = {
            'avgSoldPrice': median_sold,  # Keep same key name for compatibility
            'avgCurrentPrice': median_current,  # Keep same key name for compatibility
            'avgCompletedPrice': median_completed,  # Keep same key name for compatibility
            'marketPrice': market_price,
            'sold_count': len(sold_prices),
            'current_count': len(current_prices)
        }
    
    return medians

def _generate_card_data_from_medians(medians: Dict, master_card_list: Dict, output_file: str):
    """
    Generate card_data.json structure from median prices.
    """
    print(f"\nGenerating {output_file}...")
    
    # Initialize structure
    all_sets_processed_data = {}
    
    # Get all sets from master card list
    all_sets = set()
    for card_info in master_card_list.values():
        for set_info in card_info.get("sets", []):
            all_sets.add(set_info.get("set_name"))
    
    # Initialize all sets
    for set_name in all_sets:
        all_sets_processed_data[set_name] = {
            "nonFoil": [],
            "foil": [],
            "nonFoilByName": [],
            "foilByName": [],
            "nonFoilByRarityPrice": {r: [] for r in RARITIES},
            "foilByRarityPrice": {r: [] for r in RARITIES},
            "nonFoilByRarityName": {r: [] for r in RARITIES},
            "foilByRarityName": {r: [] for r in RARITIES},
        }
    
    # Add cards with median prices
    for (card_name, set_name, is_foil), median_data in medians.items():
        # Get rarity and slug from master card list
        card_info = master_card_list.get(card_name)
        if not card_info:
            continue
        
        set_info = None
        for s in card_info.get("sets", []):
            if s.get("set_name") == set_name:
                set_info = s
                break
        
        if not set_info:
            continue
        
        rarity = set_info.get("rarity", "Ordinary")
        slug = set_info.get("slug", "")
        
        # Create card entry
        condition = "NMF" if is_foil else "NM"
        card_entry = {
            "name": card_name,
            "price": f"{median_data['marketPrice']:.2f}",
            "avgSoldPrice": f"{median_data['avgSoldPrice']:.2f}",
            "avgCurrentPrice": f"{median_data['avgCurrentPrice']:.2f}",
            "condition": condition,
            "rarity": rarity,
            "slug": slug,
            "set_name": set_name,
        }
        
        # Add to appropriate lists
        if is_foil:
            all_sets_processed_data[set_name]["foil"].append(card_entry)
            all_sets_processed_data[set_name]["foilByName"].append(card_entry)
            if rarity in all_sets_processed_data[set_name]["foilByRarityPrice"]:
                all_sets_processed_data[set_name]["foilByRarityPrice"][rarity].append(card_entry)
            if rarity in all_sets_processed_data[set_name]["foilByRarityName"]:
                all_sets_processed_data[set_name]["foilByRarityName"][rarity].append(card_entry)
        else:
            all_sets_processed_data[set_name]["nonFoil"].append(card_entry)
            all_sets_processed_data[set_name]["nonFoilByName"].append(card_entry)
            if rarity in all_sets_processed_data[set_name]["nonFoilByRarityPrice"]:
                all_sets_processed_data[set_name]["nonFoilByRarityPrice"][rarity].append(card_entry)
            if rarity in all_sets_processed_data[set_name]["nonFoilByRarityName"]:
                all_sets_processed_data[set_name]["nonFoilByRarityName"][rarity].append(card_entry)
    
    # Sort all arrays
    for set_name in all_sets_processed_data:
        # Sort by price descending
        all_sets_processed_data[set_name]["nonFoil"].sort(
            key=lambda x: float(x["price"].replace(',', '')), reverse=True
        )
        all_sets_processed_data[set_name]["foil"].sort(
            key=lambda x: float(x["price"].replace(',', '')), reverse=True
        )
        
        # Sort by name
        all_sets_processed_data[set_name]["nonFoilByName"].sort(key=lambda x: x["name"])
        all_sets_processed_data[set_name]["foilByName"].sort(key=lambda x: x["name"])
        
        # Sort by rarity/price
        for rarity in RARITIES:
            if rarity in all_sets_processed_data[set_name]["nonFoilByRarityPrice"]:
                all_sets_processed_data[set_name]["nonFoilByRarityPrice"][rarity].sort(
                    key=lambda x: float(x["price"].replace(',', '')), reverse=True
                )
            if rarity in all_sets_processed_data[set_name]["foilByRarityPrice"]:
                all_sets_processed_data[set_name]["foilByRarityPrice"][rarity].sort(
                    key=lambda x: float(x["price"].replace(',', '')), reverse=True
                )
            
            if rarity in all_sets_processed_data[set_name]["nonFoilByRarityName"]:
                all_sets_processed_data[set_name]["nonFoilByRarityName"][rarity].sort(
                    key=lambda x: x["name"]
                )
            if rarity in all_sets_processed_data[set_name]["foilByRarityName"]:
                all_sets_processed_data[set_name]["foilByRarityName"][rarity].sort(
                    key=lambda x: x["name"]
                )
    
    # Save to file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_sets_processed_data, f, ensure_ascii=False, indent=4)
    
    print(f"  Saved {output_file}")
    print(f"  Total sets: {len(all_sets_processed_data)}")
    
    # Count cards
    total_nonfoil = sum(len(data["nonFoil"]) for data in all_sets_processed_data.values())
    total_foil = sum(len(data["foil"]) for data in all_sets_processed_data.values())
    print(f"  Total non-foil cards: {total_nonfoil}")
    print(f"  Total foil cards: {total_foil}")

def get_or_refresh_access_token():
    """
    Get or refresh eBay access token.
    Checks for cached token first, then gets a new one if needed.
    """
    TOKEN_FILE = "ebay_token.json"
    
    # Check if token file exists and is still valid
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, 'r') as f:
                token_info = json.load(f)
            expires_at_value = token_info.get("expires_at", "")
            if expires_at_value:
                # Handle both string ISO format and numeric timestamp
                if isinstance(expires_at_value, str):
                    # Parse ISO format, handling 'Z' as UTC
                    if expires_at_value.endswith('Z'):
                        expires_at = datetime.fromisoformat(expires_at_value.replace('Z', '+00:00'))
                    else:
                        expires_at = datetime.fromisoformat(expires_at_value)
                else:
                    # Assume it's a timestamp
                    expires_at = datetime.fromtimestamp(expires_at_value, tz=timezone.utc)
                
                # Ensure both times are timezone-aware for proper comparison
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                
                now = datetime.now(timezone.utc)
                time_until_expiry = (expires_at - now).total_seconds()
                
                # Check if token expires more than 5 minutes from now
                if expires_at > now + timedelta(minutes=5):
                    minutes_remaining = time_until_expiry / 60
                    print(f"Using existing eBay access token (expires in {minutes_remaining:.1f} minutes).")
                    return token_info["access_token"]
                else:
                    if time_until_expiry > 0:
                        print(f"Token expires soon (in {time_until_expiry/60:.1f} minutes), refreshing...")
                    else:
                        print(f"Token has expired ({abs(time_until_expiry)/60:.1f} minutes ago), refreshing...")
        except (KeyError, ValueError, TypeError) as e:
            print(f"Error reading token file, will refresh: {e}")
    
    # If token doesn't exist or is expired/about to expire, get a new one
    print("Refreshing eBay access token...")
    new_token_info = get_application_access_token()
    if new_token_info:
        # Store new token with expiry time (subtract 1 minute as safety margin for refresh)
        now_utc = datetime.now(timezone.utc)
        expires_at = now_utc + timedelta(seconds=new_token_info["expires_in"]) - timedelta(minutes=1)
        new_token_info["expires_at"] = expires_at.isoformat()
        with open(TOKEN_FILE, 'w') as f:
            json.dump(new_token_info, f, indent=4)
        print("New eBay access token obtained and saved.")
        return new_token_info["access_token"]
    return None

def generate_card_data_json(output_file_path: str, test_mode: bool = False, test_card_name: str = None, test_set_name: str = None):
    """
    Generate card data JSON from eBay API using bulk fetch approach.
    This function matches the signature expected by batch_update.py.
    
    Args:
        output_file_path: Path to output JSON file (typically "card-data/card_data.json")
        test_mode: Not used in bulk fetch approach (kept for compatibility)
        test_card_name: Not used in bulk fetch approach (kept for compatibility)
        test_set_name: Not used in bulk fetch approach (kept for compatibility)
    """
    print("=" * 80)
    print("eBay Bulk Fetch Parser - Query by Set Approach")
    print("=" * 80)
    
    # Get or refresh eBay access token
    print("\nObtaining eBay access token...")
    ebay_access_token = get_or_refresh_access_token()
    if not ebay_access_token:
        print("Failed to obtain eBay access token. Exiting.")
        return
    
    # Set as environment variable for API calls
    os.environ["EBAY_ACCESS_TOKEN"] = ebay_access_token
    
    # Load master card list
    print("\nLoading master card list...")
    master_card_list = load_master_card_list()
    if not master_card_list:
        print("Failed to load master card list. Exiting.")
        # Clean up environment variable
        if "EBAY_ACCESS_TOKEN" in os.environ:
            del os.environ["EBAY_ACCESS_TOKEN"]
        return
    
    print(f"Loaded {len(master_card_list)} cards from master list")
    
    # Get all unique sets from master card list
    all_sets = set()
    for card_info in master_card_list.values():
        for set_info in card_info.get("sets", []):
            set_name = set_info.get("set_name")
            if set_name:
                all_sets.add(set_name)
    
    print(f"\nFound {len(all_sets)} sets: {', '.join(sorted(all_sets))}")
    
    # Fetch all listings by set
    print("\n" + "=" * 80)
    print("FETCHING ALL LISTINGS BY SET")
    print("=" * 80)
    
    all_sold_items = []
    all_current_items = []
    
    for set_name in sorted(all_sets):
        print(f"\n--- Processing {set_name} ---")
        query = f"Sorcery Contested Realm {set_name}"
        
        sold_items = fetch_all_sold_listings(query)
        current_items = fetch_all_current_listings(query)
        
        all_sold_items.extend(sold_items)
        all_current_items.extend(current_items)
        
        print(f"  {set_name}: {len(sold_items)} sold + {len(current_items)} current = {len(sold_items) + len(current_items)} items")
    
    print(f"\n" + "=" * 80)
    print(f"TOTAL ITEMS FETCHED")
    print("=" * 80)
    print(f"Total sold items: {len(all_sold_items)}")
    print(f"Total current items: {len(all_current_items)}")
    print(f"Grand total: {len(all_sold_items) + len(all_current_items)} items")
    
    # Filter and group
    print("\n" + "=" * 80)
    print("FILTERING AND GROUPING")
    print("=" * 80)
    
    grouped_data = filter_and_group_listings(all_sold_items, all_current_items, master_card_list)
    
    # Calculate medians
    print("\n" + "=" * 80)
    print("CALCULATING MEDIAN PRICES")
    print("=" * 80)
    
    medians = calculate_medians(grouped_data)
    
    # Generate card data JSON
    print("\n" + "=" * 80)
    print("GENERATING CARD DATA")
    print("=" * 80)
    
    _generate_card_data_from_medians(medians, master_card_list, output_file_path)
    
    print("\n" + "=" * 80)
    print("DONE!")
    print("=" * 80)
    print(f"\nGenerated: {output_file_path}")
    total_api_calls = len(all_sets) * 2
    print(f"Total API calls made: {total_api_calls} ({len(all_sets)} sets × 2 calls per set)")
    
    # Clean up environment variable
    if "EBAY_ACCESS_TOKEN" in os.environ:
        del os.environ["EBAY_ACCESS_TOKEN"]

def main():
    """Main function for standalone execution."""
    generate_card_data_json("card-data/card_data.json")

if __name__ == "__main__":
    main()

