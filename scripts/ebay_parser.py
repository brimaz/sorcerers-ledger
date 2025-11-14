import json
import os
import requests
import time
import unicodedata
from datetime import datetime, timedelta
from config import EBAY_BUY_API_ENDPOINT

# --- eBay API Configuration ---
# EBAY_ACCESS_TOKEN is now read from environment variable set by batch_update.py for Buy API calls
# Moved into fetch_current_ebay_card_data function to ensure it's read after being set.
# EBAY_ACCESS_TOKEN = os.environ.get("EBAY_ACCESS_TOKEN") # Still needed for Buy API

RARITIES = ["Ordinary", "Exceptional", "Elite", "Unique"]

# Rate limiting configuration
API_CALL_DELAY = 0.7  # Delay in seconds between API calls
MAX_RETRY_DELAY = 60  # Maximum delay for exponential backoff (60 seconds)
INITIAL_RETRY_DELAY = 1  # Initial delay for exponential backoff (1 second)

# Track last API call time for rate limiting
_last_api_call_time = 0

# Keywords to exclude from listings (bulk/lot listings)
EXCLUSION_KEYWORDS = [
    "bulk", "lot", "lots", "bundle", "bundles", 
    "multiple", "set of", "pack of", "group of",
    "collection", "playset", "play set"
]

# Keywords to identify graded cards (exclude from non-graded price tracking)
GRADED_KEYWORDS = [
    "psa", "bgs", "cgc", "sgc", "hga", "gma", "kga",
    "psa 10", "psa 9", "psa 8", "bgs 10", "bgs 9", "bgs 8",
    "cgc 10", "cgc 9", "cgc 8", "graded", "slab", "slabbed"
]

def normalize_to_american_english(text: str) -> str:
    """
    Convert non-American English characters to their American English equivalents.
    Examples: ï -> i, Ä -> A, é -> e, etc.
    
    Args:
        text: Input string that may contain non-ASCII characters
        
    Returns:
        String with characters normalized to American English equivalents
    """
    if not text:
        return text
    
    # Normalize to NFD (decomposed form) which separates base characters from diacritics
    # Then remove combining diacritical marks
    normalized = unicodedata.normalize('NFD', text)
    # Filter out combining marks (characters with category 'Mn' - Mark, nonspacing)
    ascii_text = ''.join(
        char for char in normalized 
        if unicodedata.category(char) != 'Mn'
    )
    # Normalize back to NFC (composed form) for consistency
    return unicodedata.normalize('NFC', ascii_text)

def _wait_for_rate_limit():
    """Wait to maintain rate limit between API calls."""
    global _last_api_call_time
    current_time = time.time()
    time_since_last_call = current_time - _last_api_call_time
    
    if time_since_last_call < API_CALL_DELAY:
        sleep_time = API_CALL_DELAY - time_since_last_call
        time.sleep(sleep_time)
    
    _last_api_call_time = time.time()

def _make_rate_limited_request(url, headers, params, max_retries=5):
    """
    Make an API request with rate limiting and exponential backoff for 429 errors.
    
    Args:
        url: API endpoint URL
        headers: Request headers
        params: Request parameters
        max_retries: Maximum number of retry attempts
    
    Returns:
        Response object or None if all retries failed
    """
    _wait_for_rate_limit()
    
    retry_count = 0
    retry_delay = INITIAL_RETRY_DELAY
    
    while retry_count <= max_retries:
        try:
            response = requests.get(url, headers=headers, params=params)
            
            # Check for rate limit error (429)
            if response.status_code == 429:
                # Check for X-RateLimit-Reset header
                reset_header = response.headers.get('X-RateLimit-Reset')
                
                if reset_header:
                    try:
                        # Parse reset time (could be Unix timestamp or seconds until reset)
                        reset_time = float(reset_header)
                        
                        # If it's a large number, assume it's a Unix timestamp
                        if reset_time > 1000000000:
                            wait_seconds = reset_time - time.time()
                        else:
                            # Otherwise assume it's seconds until reset
                            wait_seconds = reset_time
                        
                        if wait_seconds > 0:
                            print(f"  Rate limited (429). Waiting {wait_seconds:.1f} seconds until reset (from X-RateLimit-Reset header)...")
                            time.sleep(wait_seconds)
                            retry_delay = INITIAL_RETRY_DELAY  # Reset delay after waiting for reset
                            retry_count += 1
                            continue
                    except (ValueError, TypeError):
                        pass
                
                # No valid reset header, use exponential backoff
                if retry_count < max_retries:
                    print(f"  Rate limited (429). Retrying in {retry_delay:.1f} seconds (attempt {retry_count + 1}/{max_retries})...")
                    time.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, MAX_RETRY_DELAY)  # Double delay, cap at max
                    retry_count += 1
                    continue
                else:
                    print(f"  Rate limited (429). Max retries ({max_retries}) exceeded.")
                    return None
            
            # For other HTTP errors, raise exception
            response.raise_for_status()
            return response
            
        except requests.exceptions.RequestException as e:
            if retry_count < max_retries:
                print(f"  Request error: {e}. Retrying in {retry_delay:.1f} seconds (attempt {retry_count + 1}/{max_retries})...")
                time.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, MAX_RETRY_DELAY)
                retry_count += 1
            else:
                raise
    
    return None

def is_graded_card(item: dict) -> bool:
    """
    Check if an item is a graded card based on title keywords.
    Returns True if the item appears to be graded.
    """
    title = ""
    if isinstance(item, dict):
        # Buy API structure (title is a string)
        title = str(item.get("title", "")).lower()
    
    # Check if title contains any graded card keywords
    for keyword in GRADED_KEYWORDS:
        if keyword in title:
            return True
    return False

def should_exclude_item(item: dict) -> bool:
    """
    Check if an item should be excluded based on title keywords.
    Returns True if the item should be excluded (contains exclusion keywords or is graded).
    """
    # Exclude graded cards
    if is_graded_card(item):
        return True
    
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
        response = _make_rate_limited_request(EBAY_BUY_API_ENDPOINT, headers, params)
        if response is None:
            return []
        
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
        response = _make_rate_limited_request(EBAY_BUY_API_ENDPOINT, headers, params)
        if response is None:
            return []
        
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

def _load_existing_card_data(output_file_path: str) -> dict:
    """
    Load existing card data from file if it exists.
    
    Args:
        output_file_path: Path to card data JSON file
    
    Returns:
        Dictionary with existing card data, or empty dict if file doesn't exist
    """
    if not os.path.exists(output_file_path):
        return {}
    
    try:
        with open(output_file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Warning: Could not load existing card data: {e}")
        return {}

def _is_card_complete(existing_data: dict, card_name: str, set_name: str) -> bool:
    """
    Check if a card-set combination is already complete in the existing data.
    A card is considered complete if it has both nonFoil and foil entries with valid data.
    
    Args:
        existing_data: Existing card data dictionary
        card_name: Name of the card
        set_name: Name of the set
    
    Returns:
        True if card is complete, False otherwise
    """
    if set_name not in existing_data:
        return False
    
    set_data = existing_data[set_name]
    
    # Check if card exists in both nonFoil and foil arrays
    nonfoil_found = False
    foil_found = False
    
    for card in set_data.get("nonFoil", []):
        if card.get("name") == card_name:
            # Check if it has valid price data
            price = card.get("price", "0")
            avg_sold = card.get("avgSoldPrice", "0")
            avg_current = card.get("avgCurrentPrice", "0")
            try:
                if float(price) > 0 or float(avg_sold) > 0 or float(avg_current) > 0:
                    nonfoil_found = True
                    break
            except (ValueError, TypeError):
                pass
    
    for card in set_data.get("foil", []):
        if card.get("name") == card_name:
            # Check if it has valid price data
            price = card.get("price", "0")
            avg_sold = card.get("avgSoldPrice", "0")
            avg_current = card.get("avgCurrentPrice", "0")
            try:
                if float(price) > 0 or float(avg_sold) > 0 or float(avg_current) > 0:
                    foil_found = True
                    break
            except (ValueError, TypeError):
                pass
    
    return nonfoil_found and foil_found

def generate_card_data_json(output_file_path: str, test_mode: bool = True, test_card_name: str = "Philosopher's Stone", test_set_name: str = "Alpha"):
    """
    Generate card data JSON from eBay API.
    Can resume from existing data if the file exists.
    
    Args:
        output_file_path: Path to output JSON file
        test_mode: If True, only process the specified test card
        test_card_name: Card name to process in test mode
        test_set_name: Set name to process in test mode
    """
    # Load existing data if it exists (for resume functionality)
    all_sets_processed_data = _load_existing_card_data(output_file_path)
    if all_sets_processed_data:
        print(f"Found existing card data. Resuming from previous run...")
    
    master_card_list = load_master_card_list()
    if not master_card_list:
        print("Failed to load master card list. Exiting.")
        return

    if test_mode:
        print(f"TEST MODE: Only processing {test_card_name} from {test_set_name} set")

    # Count total card-set combinations and already processed cards
    total_combinations = 0
    already_processed = 0
    for card_name, card_info in master_card_list.items():
        if test_mode and card_name != test_card_name:
            continue
        for set_details in card_info["sets"]:
            if test_mode and set_details["set_name"] != test_set_name:
                continue
            total_combinations += 1
            if _is_card_complete(all_sets_processed_data, card_name, set_details["set_name"]):
                already_processed += 1
    
    remaining = total_combinations - already_processed
    print(f"Total card-set combinations: {total_combinations}")
    if already_processed > 0:
        print(f"Already processed: {already_processed}")
        print(f"Remaining to process: {remaining}")
    print(f"Saving progress every 50 cards...")
    
    processed_count = already_processed
    SAVE_INTERVAL = 50  # Save every 50 cards

    for card_name, card_info in master_card_list.items():
        # Test mode filter
        if test_mode and card_name != test_card_name:
            continue
            
        for set_details in card_info["sets"]:
            set_name = set_details["set_name"]
            rarity_from_master = set_details["rarity"]
            slug = set_details.get("slug")
            
            # Test mode filter for set
            if test_mode and set_name != test_set_name:
                continue

            # Check if card is already complete - skip if so
            if _is_card_complete(all_sets_processed_data, card_name, set_name):
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
            # Normalize card name and set name for American English keyboard compatibility
            normalized_card_name = normalize_to_american_english(card_name)
            normalized_set_name = normalize_to_american_english(set_name)
            
            # Non-foil sold query
            search_query_sold_nonfoil = f"Sorcery {normalized_card_name} {normalized_set_name} -foil"
            print(f"Fetching sold NON-FOIL data for {card_name} in {set_name} (Rarity: {rarity_from_master})...")
            raw_sold_items_nonfoil = fetch_sold_ebay_card_data(search_query_sold_nonfoil)
            
            # Foil sold query
            search_query_sold_foil = f"Sorcery {normalized_card_name} {normalized_set_name} foil"
            print(f"Fetching sold FOIL data for {card_name} in {set_name} (Rarity: {rarity_from_master})...")
            raw_sold_items_foil = fetch_sold_ebay_card_data(search_query_sold_foil)
            
            # Parse sold prices and separate by foil/non-foil
            sold_prices_nonfoil = []
            sold_prices_foil = []
            
            print(f"  Found {len(raw_sold_items_nonfoil)} sold non-foil items")
            for item in raw_sold_items_nonfoil:
                if not is_foil_item(item) and not is_graded_card(item):  # Exclude foil and graded
                    # Buy API format: price -> value
                    price_info = item.get("price", {})
                    price_value = price_info.get("value", "0.0")
                    try:
                        sold_prices_nonfoil.append(float(price_value))
                    except ValueError:
                        pass
            
            print(f"  Found {len(raw_sold_items_foil)} sold foil items")
            for item in raw_sold_items_foil:
                if is_foil_item(item) and not is_graded_card(item):  # Confirm foil and exclude graded
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
            # Use normalized names (already computed above)
            # Non-foil current query
            search_query_current_nonfoil = f"Sorcery {normalized_card_name} {normalized_set_name} -foil"
            print(f"Fetching current NON-FOIL data for {card_name} in {set_name} (Rarity: {rarity_from_master})...") 
            raw_current_items_nonfoil = fetch_current_ebay_card_data(search_query_current_nonfoil)

            # Foil current query
            search_query_current_foil = f"Sorcery {normalized_card_name} {normalized_set_name} foil"
            print(f"Fetching current FOIL data for {card_name} in {set_name} (Rarity: {rarity_from_master})...") 
            raw_current_items_foil = fetch_current_ebay_card_data(search_query_current_foil)

            # Parse current prices and separate by foil/non-foil
            current_prices_nonfoil = []
            current_prices_foil = []
            
            print(f"  Found {len(raw_current_items_nonfoil)} current non-foil items")
            for item in raw_current_items_nonfoil:
                if not is_foil_item(item) and not is_graded_card(item):  # Exclude foil and graded
                    price_info = item.get("price", {})
                    price_value = price_info.get("value", "0.0")
                    try:
                        current_prices_nonfoil.append(float(price_value))
                    except ValueError:
                        pass
            
            print(f"  Found {len(raw_current_items_foil)} current foil items")
            for item in raw_current_items_foil:
                if is_foil_item(item) and not is_graded_card(item):  # Confirm foil and exclude graded
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
                "slug": slug,
                "set_name": set_name,
            }

            # Create foil card info
            card_info_foil = {
                "name": card_name,
                "price": f"{market_price_foil:.2f}",  # Market price: average of sold and current averages
                "avgSoldPrice": f"{avg_sold_price_foil:.2f}",
                "avgCurrentPrice": f"{avg_current_price_foil:.2f}",
                "condition": condition_foil,
                "rarity": rarity_from_master,
                "slug": slug,
                "set_name": set_name,
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

            # Periodic save every SAVE_INTERVAL cards
            processed_count += 1
            if processed_count % SAVE_INTERVAL == 0:
                _save_card_data_intermediate(all_sets_processed_data, output_file_path)
                print(f"  Progress: {processed_count}/{total_combinations} cards processed (saved)")

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

    # Final save with sorted data
    _save_card_data_intermediate(all_sets_processed_data, output_file_path)
    print(f"Final save complete. Total cards processed: {processed_count}")

def _save_card_data_intermediate(data: dict, output_file_path: str):
    """
    Save card data to file (used for periodic saves and final save).
    
    Args:
        data: The card data dictionary to save
        output_file_path: Path to output JSON file
    """
    try:
        with open(output_file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Error saving card data: {e}")
