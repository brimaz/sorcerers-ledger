import os
import json
import time
from datetime import datetime, timedelta, timezone

# TCGplayer imports (current implementation)
from tcgplayer_pricing import generate_card_data_from_tcgplayer
from tcgplayer_product_info import generate_product_info_files

# eBay imports (kept for future use - commented out but available)
# from ebay_bulk_fetch import generate_card_data_json
# from ebay_auth import get_application_access_token

# --- Configuration ---
# TCGplayer Configuration
TCGPLAYER_PRODUCT_TYPE_ID = 128  # Trading cards product type (Sorcery: Contested Realm product type ID)

# eBay Configuration (for future use)
# TOKEN_FILE = "ebay_token.json"

CACHE_DURATION_HOURS = 24 # How long to consider card_data.json fresh
TEST_MODE = False # Set to True to only process "Philosopher's Stone" from "Alpha" set for testing
TEST_CARD_NAME = "Philosopher's Stone"
TEST_SET_NAME = "Alpha"

# eBay token management (kept for future use)
# def get_or_refresh_access_token():
#     # Check if token file exists and is still valid
#     if os.path.exists(TOKEN_FILE):
#         try:
#             with open(TOKEN_FILE, 'r') as f:
#                 token_info = json.load(f)
#             expires_at_value = token_info.get("expires_at", "")
#             if expires_at_value:
#                 # Handle both string ISO format and numeric timestamp
#                 if isinstance(expires_at_value, str):
#                     # Parse ISO format, handling 'Z' as UTC
#                     if expires_at_value.endswith('Z'):
#                         expires_at = datetime.fromisoformat(expires_at_value.replace('Z', '+00:00'))
#                     else:
#                         expires_at = datetime.fromisoformat(expires_at_value)
#                 else:
#                     # Assume it's a timestamp
#                     expires_at = datetime.fromtimestamp(expires_at_value, tz=timezone.utc)
#                 
#                 # Ensure both times are timezone-aware for proper comparison
#                 if expires_at.tzinfo is None:
#                     expires_at = expires_at.replace(tzinfo=timezone.utc)
#                 
#                 now = datetime.now(timezone.utc)
#                 time_until_expiry = (expires_at - now).total_seconds()
#                 
#                 # Check if token expires more than 5 minutes from now
#                 if expires_at > now + timedelta(minutes=5):
#                     minutes_remaining = time_until_expiry / 60
#                     print(f"Using existing eBay access token (expires in {minutes_remaining:.1f} minutes, at {expires_at.isoformat()}).")
#                     return token_info["access_token"]
#                 else:
#                     if time_until_expiry > 0:
#                         print(f"Token expires soon (in {time_until_expiry/60:.1f} minutes, at {expires_at.isoformat()}), refreshing...")
#                     else:
#                         print(f"Token has expired ({abs(time_until_expiry)/60:.1f} minutes ago, was {expires_at.isoformat()}), refreshing...")
#         except (KeyError, ValueError, TypeError) as e:
#             print(f"Error reading token file, will refresh: {e}")
#     
#     # If token doesn't exist or is expired/about to expire, get a new one
#     print("Refreshing eBay access token...")
#     new_token_info = get_application_access_token()
#     if new_token_info:
#         # Store new token with expiry time (subtract 1 minute as safety margin for refresh)
#         now_utc = datetime.now(timezone.utc)
#         expires_at = now_utc + timedelta(seconds=new_token_info["expires_in"]) - timedelta(minutes=1)
#         new_token_info["expires_at"] = expires_at.isoformat()
#         with open(TOKEN_FILE, 'w') as f:
#             json.dump(new_token_info, f, indent=4)
#         print("New eBay access token obtained and saved.")
#         return new_token_info["access_token"]
#     return None

def cleanup_old_archives(card_data_dir: str, days_to_keep: int = 8):
    """
    Delete archived card_data.json files older than the specified number of days.
    Only deletes files matching the pattern card_data_YYYYMMDD_HHMMSS.json
    
    Args:
        card_data_dir: Directory containing card data files
        days_to_keep: Number of days to keep archived files (default: 8)
    """
    if not os.path.exists(card_data_dir):
        return
    
    now = datetime.now()
    cutoff_date = now - timedelta(days=days_to_keep)
    deleted_count = 0
    
    try:
        for filename in os.listdir(card_data_dir):
            # Only process archived files (card_data_YYYYMMDD_HHMMSS.json), not the main card_data.json
            if filename.startswith("card_data_") and filename.endswith(".json") and filename != "card_data.json":
                file_path = os.path.join(card_data_dir, filename)
                
                # Extract date from filename: card_data_YYYYMMDD_HHMMSS.json
                # Format: card_data_20251118_080434.json -> extract "20251118"
                try:
                    # Remove prefix "card_data_" and suffix ".json"
                    date_time_str = filename[10:-5]  # "card_data_" is 10 chars, ".json" is 5 chars
                    # Split by underscore to get date and time parts
                    date_str = date_time_str.split('_')[0]  # "20251118"
                    # Parse the date: YYYYMMDD
                    file_date_from_name = datetime.strptime(date_str, "%Y%m%d")
                    
                    file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path))
                    
                    # Calculate days since file date
                    days_old = (now.date() - file_date_from_name.date()).days
                    
                    # Delete if the date in the filename is older than the cutoff
                    # We use < cutoff_date.date() to keep files that are exactly days_to_keep old
                    # (e.g., if days_to_keep=8, keep files from 8 days ago, delete files from 9+ days ago)
                    if file_date_from_name.date() < cutoff_date.date():
                        os.remove(file_path)
                        deleted_count += 1
                        print(f"Deleted old archive: {filename} (filename date: {file_date_from_name.date()}, mtime: {file_mtime.date()}, {days_old} days old)")
                except (ValueError, IndexError) as e:
                    # If filename doesn't match expected format, skip it
                    print(f"Warning: Could not parse date from filename '{filename}': {e}")
                    continue
        
        if deleted_count > 0:
            print(f"Cleaned up {deleted_count} archived file(s) older than {days_to_keep} days.")
    except Exception as e:
        print(f"Error cleaning up old archives: {e}")

def main():
    # 1. TCGplayer token management is handled automatically in tcgplayer_api.py
    # (Token is checked and refreshed if needed when making API calls)
    # 
    # Note: We no longer use sorcery_card_list.json - all data comes from TCGplayer group IDs

    # 3. Prepare for card data generation (resume logic will handle skipping complete cards)
    output_file = "card-data/card_data.json"
    
    if os.path.exists(output_file):
        modified_time = datetime.fromtimestamp(os.path.getmtime(output_file))
        print(f"Found existing card_data.json (last updated {modified_time.strftime('%Y-%m-%d %H:%M:%S')}). Will resume from existing data.")
    else:
        print("card_data.json not found. Starting fresh update.")
    
    # 4. Archive existing card_data.json only if it's from a previous day
    # (Don't archive if resuming same-day run)
    card_data_dir = "card-data"
    
    if os.path.exists(output_file):
        modified_time = datetime.fromtimestamp(os.path.getmtime(output_file))
        today = datetime.now().date()
        file_date = modified_time.date()
        
        # Only archive if file is from a previous day
        if file_date < today:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            archive_file = f"{card_data_dir}/card_data_{timestamp}.json"
            
            # Rename current file to archived name
            os.rename(output_file, archive_file)
            print(f"Archived previous day's card_data.json to {archive_file}")
        else:
            print(f"Resuming from existing card_data.json (same day, last updated {modified_time.strftime('%Y-%m-%d %H:%M:%S')})")
    
    # 5. Generate product info files from TCGplayer catalog API (only if they don't exist)
    print("\n" + "=" * 60)
    print("Checking product info files from TCGplayer catalog...")
    print("=" * 60)
    print("(Product info files are only generated if they don't already exist)")
    product_info_dir = os.path.join(card_data_dir, "product-info")
    generate_product_info_files(product_info_dir)
    print("Product info files check complete.")
    
    # 6. Generate card data from TCGplayer (processes all sets defined in group ID mapping)
    print("\n" + "=" * 60)
    print("Starting TCGplayer card data parsing...")
    print("=" * 60)
    generate_card_data_from_tcgplayer(
        output_file,
        product_type_id=TCGPLAYER_PRODUCT_TYPE_ID,
        test_mode=TEST_MODE,
        test_set_name=TEST_SET_NAME
    )
    print("TCGplayer card data parsing complete.")
    
    # 7. Clean up old archived files (older than 8 days)
    cleanup_old_archives(card_data_dir, days_to_keep=8)
    
    # eBay integration (for future use - uncomment if needed)
    # # 2. Get or refresh eBay access token
    # ebay_access_token = get_or_refresh_access_token()
    # if not ebay_access_token:
    #     print("Failed to obtain eBay access token. Exiting.")
    #     return
    # 
    # # Set as environment variable for eBay parser scripts
    # os.environ["EBAY_ACCESS_TOKEN"] = ebay_access_token
    # 
    # # 5. Generate card data from eBay (will resume if file exists)
    # print("Starting eBay card data parsing...")
    # generate_card_data_json(output_file, test_mode=TEST_MODE, test_card_name=TEST_CARD_NAME, test_set_name=TEST_SET_NAME)
    # print("eBay card data parsing complete.")
    # 
    # # Clean up environment variable
    # if "EBAY_ACCESS_TOKEN" in os.environ:
    #     del os.environ["EBAY_ACCESS_TOKEN"]

if __name__ == "__main__":
    main()
