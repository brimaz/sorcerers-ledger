import json
import os
import requests
from datetime import datetime, timedelta
from config import EBAY_BUY_API_ENDPOINT

# --- eBay API Configuration ---
# EBAY_ACCESS_TOKEN is now read from environment variable set by batch_update.py for Buy API calls
# Moved into fetch_current_ebay_card_data function to ensure it's read after being set.
# EBAY_ACCESS_TOKEN = os.environ.get("EBAY_ACCESS_TOKEN") # Still needed for Buy API

RARITIES = ["Ordinary", "Exceptional", "Elite", "Unique"]

# Keywords to exclude from listings (bulk/lot listings)
EXCLUSION_KEYWORDS = [
    "bulk", "lot", "lots", "bundle", "bundles", 
    "multiple", "set of", "pack of", "group of",
    "collection", "playset", "play set"
]

def should_exclude_item(item: dict) -> bool:
    """
    Check if an item should be excluded based on title keywords.
    Returns True if the item should be excluded (contains exclusion keywords).
    """
    title = ""
    if isinstance(item, dict):
        # Buy API structure (title is a string)
        title = str(item.get("title", "")).lower()
    
    # Check if title contains any exclusion keywords
    for keyword in EXCLUSION_KEYWORDS:
        if keyword in title:
            return True
    return False

def fetch_sold_ebay_card_data(query: str) -> list:
    # Buy API Browse endpoint with itemSoldFilter for sold listings (uses OAuth)
    ebay_access_token = os.environ.get("EBAY_ACCESS_TOKEN")
    if not ebay_access_token:
        print("EBAY_ACCESS_TOKEN not found for Buy API. Please ensure batch_update.py sets it.")
        return []

    headers = {
        "Authorization": f"Bearer {ebay_access_token}",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US", # Specify the marketplace
        "Content-Type": "application/json"
    }

    # Use simple query (exclusions applied via post-filtering, not in query)
    # Negative keywords in query can be too restrictive and filter out valid results
    print(f"  Query: {query}")
    
    params = {
        "q": query,  # Simple query without exclusion terms
        "item_filters": "itemSoldFilter:{true}",  # Filter for sold items only
        "limit": 100,
        "sort": "newlyListed"  # Sort by newly listed (most recent first)
    }
    
    try:
        response = requests.get(EBAY_BUY_API_ENDPOINT, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        
        # The Buy API returns items directly under 'itemSummaries'
        items = data.get("itemSummaries", [])
        total = data.get("total", 0)
        print(f"  API returned {total} total items, {len(items)} in this page")
        
        # Filter out items that contain exclusion keywords (post-filtering)
        filtered_items = []
        excluded_items = []
        for item in items:
            if should_exclude_item(item):
                excluded_items.append(item.get("title", "Unknown"))
            else:
                filtered_items.append(item)
        
        if excluded_items:
            print(f"  Filtered out {len(excluded_items)} bulk/lot listings:")
            for excluded_title in excluded_items[:3]:  # Show first 3 excluded items
                print(f"    - {excluded_title[:80]}...")
            if len(excluded_items) > 3:
                print(f"    ... and {len(excluded_items) - 3} more")
        
        print(f"  After filtering: {len(filtered_items)} items remaining")
        return filtered_items
    except requests.exceptions.RequestException as e:
        print(f"Error fetching eBay SOLD data for {query}: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Status Code: {e.response.status_code}")
            print(f"Response: {e.response.text[:500]}")
        return []
    except json.JSONDecodeError as e:
        print(f"Error decoding eBay SOLD API response for {query}: {e}")
        return []

def fetch_current_ebay_card_data(query: str) -> list:
    # Re-enable EBAY_ACCESS_TOKEN retrieval for when this function is re-enabled
    ebay_access_token = os.environ.get("EBAY_ACCESS_TOKEN")
    if not ebay_access_token:
        print("EBAY_ACCESS_TOKEN not found for Buy API. Please ensure batch_update.py sets it.")
        return []

    headers = {
        "Authorization": f"Bearer {ebay_access_token}",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US", # Specify the marketplace
        "Content-Type": "application/json"
    }

    # Use simple query (exclusions applied via post-filtering, not in query)
    # Negative keywords in query can be too restrictive and filter out valid results
    print(f"  Query: {query}")
    
    params = {
        "q": query,  # Simple query without exclusion terms
        "limit": 100
    }

    try:
        response = requests.get(EBAY_BUY_API_ENDPOINT, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        
        # The Buy API returns items directly under 'itemSummaries'
        items = data.get("itemSummaries", [])
        total = data.get("total", 0)
        print(f"  API returned {total} total items, {len(items)} in this page")
        
        # Filter out items that contain exclusion keywords (post-filtering)
        filtered_items = []
        excluded_items = []
        for item in items:
            if should_exclude_item(item):
                excluded_items.append(item.get("title", "Unknown"))
            else:
                filtered_items.append(item)
        
        if excluded_items:
            print(f"  Filtered out {len(excluded_items)} bulk/lot listings:")
            for excluded_title in excluded_items[:3]:  # Show first 3 excluded items
                print(f"    - {excluded_title[:80]}...")
            if len(excluded_items) > 3:
                print(f"    ... and {len(excluded_items) - 3} more")
        
        print(f"  After filtering: {len(filtered_items)} items remaining")
        return filtered_items
    except requests.exceptions.RequestException as e:
        print(f"Error fetching eBay CURRENT data for {query}: {e}")
        return []
    except json.JSONDecodeError as e:
        print(f"Error decoding eBay CURRENT API response for {query}: {e}")
        return []

def load_master_card_list(file_path="card-data/sorcery_card_list.json"):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: Master card list not found at {file_path}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error decoding master card list: {e}")
        return None

def is_foil_item(item, item_title_key="title"):
    """
    Determine if an eBay item is a foil variant based on title/description.
    Checks for common foil indicators in the item title.
    """
    # Try to get title from different possible structures
    title = ""
    if isinstance(item, dict):
        # Finding API structure (title is often a list)
        title_list = item.get("title", [])
        if title_list and isinstance(title_list, list) and len(title_list) > 0:
            title = str(title_list[0]).lower()
        # Buy API structure (title is a string)
        elif "title" in item:
            title = str(item.get("title", "")).lower()
    
    # Common foil indicators in eBay listings
    foil_keywords = ["foil", "holo", "holofoil", "foil card", "foil version"]
    return any(keyword in title for keyword in foil_keywords)

def generate_card_data_json(output_file_path: str, test_mode: bool = True, test_card_name: str = "Philosopher's Stone", test_set_name: str = "Alpha"):
    """
    Generate card data JSON from eBay API.
    
    Args:
        output_file_path: Path to output JSON file
        test_mode: If True, only process the specified test card
        test_card_name: Card name to process in test mode
        test_set_name: Set name to process in test mode
    """
    all_sets_processed_data = {}
    master_card_list = load_master_card_list()
    if not master_card_list:
        print("Failed to load master card list. Exiting.")
        return

    if test_mode:
        print(f"TEST MODE: Only processing {test_card_name} from {test_set_name} set")

    for card_name, card_info in master_card_list.items():
        # Test mode filter
        if test_mode and card_name != test_card_name:
            continue
            
        for set_details in card_info["sets"]:
            set_name = set_details["set_name"]
            rarity_from_master = set_details["rarity"]
            
            # Test mode filter for set
            if test_mode and set_name != test_set_name:
                continue

            if set_name not in all_sets_processed_data:
                all_sets_processed_data[set_name] = {
                    "nonFoil": [], "foil": [],
                    "nonFoilByName": [], "foilByName": [],
                    "nonFoilByRarityPrice": {r: [] for r in RARITIES},
                    "foilByRarityPrice": {r: [] for r in RARITIES},
                    "nonFoilByRarityName": {r: [] for r in RARITIES},
                    "foilByRarityName": {r: [] for r in RARITIES},
                }

            # --- Fetch Sold Data (Buy API with itemSoldFilter) - Separate queries for foil and non-foil ---
            # Simplified query - just card name and set, let the API do the matching
            # Non-foil sold query
            search_query_sold_nonfoil = f"Sorcery {card_name} {set_name} -foil"
            print(f"Fetching sold NON-FOIL data for {card_name} in {set_name} (Rarity: {rarity_from_master})...")
            raw_sold_items_nonfoil = fetch_sold_ebay_card_data(search_query_sold_nonfoil)
            
            # Foil sold query
            search_query_sold_foil = f"Sorcery {card_name} {set_name} foil"
            print(f"Fetching sold FOIL data for {card_name} in {set_name} (Rarity: {rarity_from_master})...")
            raw_sold_items_foil = fetch_sold_ebay_card_data(search_query_sold_foil)
            
            # Parse sold prices and separate by foil/non-foil
            sold_prices_nonfoil = []
            sold_prices_foil = []
            
            print(f"  Found {len(raw_sold_items_nonfoil)} sold non-foil items")
            for item in raw_sold_items_nonfoil:
                if not is_foil_item(item):  # Double-check it's not foil
                    # Buy API format: price -> value
                    price_info = item.get("price", {})
                    price_value = price_info.get("value", "0.0")
                    try:
                        sold_prices_nonfoil.append(float(price_value))
                    except ValueError:
                        pass
            
            print(f"  Found {len(raw_sold_items_foil)} sold foil items")
            for item in raw_sold_items_foil:
                if is_foil_item(item):  # Confirm it's foil
                    # Buy API format: price -> value
                    price_info = item.get("price", {})
                    price_value = price_info.get("value", "0.0")
                    try:
                        sold_prices_foil.append(float(price_value))
                    except ValueError:
                        pass
            
            print(f"  Extracted {len(sold_prices_nonfoil)} non-foil sold prices")
            print(f"  Extracted {len(sold_prices_foil)} foil sold prices")

            avg_sold_price_nonfoil = sum(sold_prices_nonfoil) / len(sold_prices_nonfoil) if sold_prices_nonfoil else 0.0
            avg_sold_price_foil = sum(sold_prices_foil) / len(sold_prices_foil) if sold_prices_foil else 0.0
            
            print(f"  Non-foil sold average: ${avg_sold_price_nonfoil:.2f}")
            print(f"  Foil sold average: ${avg_sold_price_foil:.2f}")

            # --- Fetch Current Data (Buy API) - Separate queries for foil and non-foil ---
            # Simplified query - just card name and set
            # Non-foil current query
            search_query_current_nonfoil = f"Sorcery {card_name} {set_name} -foil"
            print(f"Fetching current NON-FOIL data for {card_name} in {set_name} (Rarity: {rarity_from_master})...") 
            raw_current_items_nonfoil = fetch_current_ebay_card_data(search_query_current_nonfoil)

            # Foil current query
            search_query_current_foil = f"Sorcery {card_name} {set_name} foil"
            print(f"Fetching current FOIL data for {card_name} in {set_name} (Rarity: {rarity_from_master})...") 
            raw_current_items_foil = fetch_current_ebay_card_data(search_query_current_foil)

            # Parse current prices and separate by foil/non-foil
            current_prices_nonfoil = []
            current_prices_foil = []
            
            print(f"  Found {len(raw_current_items_nonfoil)} current non-foil items")
            for item in raw_current_items_nonfoil:
                if not is_foil_item(item):  # Double-check it's not foil
                    price_info = item.get("price", {})
                    price_value = price_info.get("value", "0.0")
                    try:
                        current_prices_nonfoil.append(float(price_value))
                    except ValueError:
                        pass
            
            print(f"  Found {len(raw_current_items_foil)} current foil items")
            for item in raw_current_items_foil:
                if is_foil_item(item):  # Confirm it's foil
                    price_info = item.get("price", {})
                    price_value = price_info.get("value", "0.0")
                    try:
                        current_prices_foil.append(float(price_value))
                    except ValueError:
                        pass
            
            print(f"  Extracted {len(current_prices_nonfoil)} non-foil current prices")
            print(f"  Extracted {len(current_prices_foil)} foil current prices")
            
            avg_current_price_nonfoil = sum(current_prices_nonfoil) / len(current_prices_nonfoil) if current_prices_nonfoil else 0.0
            avg_current_price_foil = sum(current_prices_foil) / len(current_prices_foil) if current_prices_foil else 0.0
            
            print(f"  Non-foil current average: ${avg_current_price_nonfoil:.2f}")
            print(f"  Foil current average: ${avg_current_price_foil:.2f}")

            # --- Calculate Market Price (Average of sold average and current average) ---
            # This gives equal weight to sold prices (actual transactions) and current prices (asking prices)
            # Non-foil
            if avg_sold_price_nonfoil > 0 and avg_current_price_nonfoil > 0:
                # Both have data: average the two averages
                market_price_nonfoil = (avg_sold_price_nonfoil + avg_current_price_nonfoil) / 2.0
            elif avg_sold_price_nonfoil > 0:
                # Only sold data available: use sold average
                market_price_nonfoil = avg_sold_price_nonfoil
            elif avg_current_price_nonfoil > 0:
                # Only current data available: use current average
                market_price_nonfoil = avg_current_price_nonfoil
            else:
                # No data available
                market_price_nonfoil = 0.0

            # Foil
            if avg_sold_price_foil > 0 and avg_current_price_foil > 0:
                # Both have data: average the two averages
                market_price_foil = (avg_sold_price_foil + avg_current_price_foil) / 2.0
            elif avg_sold_price_foil > 0:
                # Only sold data available: use sold average
                market_price_foil = avg_sold_price_foil
            elif avg_current_price_foil > 0:
                # Only current data available: use current average
                market_price_foil = avg_current_price_foil
            else:
                # No data available
                market_price_foil = 0.0
            
            print(f"  Final market price (non-foil): ${market_price_nonfoil:.2f}")
            print(f"  Final market price (foil): ${market_price_foil:.2f}")

            condition_nonfoil = "NM"
            condition_foil = "NMF"

            # Create non-foil card info
            card_info_nonfoil = {
                "name": card_name,
                "price": f"{market_price_nonfoil:.2f}",  # Market price: average of sold and current averages
                "avgSoldPrice": f"{avg_sold_price_nonfoil:.2f}",
                "avgCurrentPrice": f"{avg_current_price_nonfoil:.2f}",
                "condition": condition_nonfoil,
                "rarity": rarity_from_master,
            }

            # Create foil card info
            card_info_foil = {
                "name": card_name,
                "price": f"{market_price_foil:.2f}",  # Market price: average of sold and current averages
                "avgSoldPrice": f"{avg_sold_price_foil:.2f}",
                "avgCurrentPrice": f"{avg_current_price_foil:.2f}",
                "condition": condition_foil,
                "rarity": rarity_from_master,
            }

            # Add to appropriate lists
            all_sets_processed_data[set_name]["nonFoil"].append(card_info_nonfoil)
            all_sets_processed_data[set_name]["foil"].append(card_info_foil)
            
            if rarity_from_master in all_sets_processed_data[set_name]["nonFoilByRarityPrice"]:
                all_sets_processed_data[set_name]["nonFoilByRarityPrice"][rarity_from_master].append(card_info_nonfoil)
            if rarity_from_master in all_sets_processed_data[set_name]["nonFoilByRarityName"]:
                all_sets_processed_data[set_name]["nonFoilByRarityName"][rarity_from_master].append(card_info_nonfoil)
            
            if rarity_from_master in all_sets_processed_data[set_name]["foilByRarityPrice"]:
                all_sets_processed_data[set_name]["foilByRarityPrice"][rarity_from_master].append(card_info_foil)
            if rarity_from_master in all_sets_processed_data[set_name]["foilByRarityName"]:
                all_sets_processed_data[set_name]["foilByRarityName"][rarity_from_master].append(card_info_foil)

    # Final sorting after all data is gathered for each set
    for set_name in all_sets_processed_data:
        def sort_by_price(cards):
            return sorted(cards, key=lambda x: float(x["price"].replace(',', '')), reverse=True)

        def sort_by_name(cards):
            return sorted(cards, key=lambda x: x["name"])

        all_sets_processed_data[set_name]["nonFoil"] = sort_by_price(all_sets_processed_data[set_name]["nonFoil"])
        all_sets_processed_data[set_name]["nonFoilByName"] = sort_by_name(all_sets_processed_data[set_name]["nonFoil"])
        
        all_sets_processed_data[set_name]["foil"] = sort_by_price(all_sets_processed_data[set_name]["foil"])
        all_sets_processed_data[set_name]["foilByName"] = sort_by_name(all_sets_processed_data[set_name]["foil"])

        for rarity_key in RARITIES:
            all_sets_processed_data[set_name]["nonFoilByRarityPrice"][rarity_key] = sort_by_price(all_sets_processed_data[set_name]["nonFoilByRarityPrice"][rarity_key])
            all_sets_processed_data[set_name]["nonFoilByRarityName"][rarity_key] = sort_by_name(all_sets_processed_data[set_name]["nonFoilByRarityName"][rarity_key])

            all_sets_processed_data[set_name]["foilByRarityPrice"][rarity_key] = sort_by_price(all_sets_processed_data[set_name]["foilByRarityPrice"][rarity_key])
            all_sets_processed_data[set_name]["foilByRarityName"][rarity_key] = sort_by_name(all_sets_processed_data[set_name]["foilByRarityName"][rarity_key])

    with open(output_file_path, 'w', encoding='utf-8') as f:
        json.dump(all_sets_processed_data, f, ensure_ascii=False, indent=4)
