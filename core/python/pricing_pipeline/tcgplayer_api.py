"""
TCGplayer API integration module.
Handles bearer token management and API requests.
"""

import os
import json
import requests
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import sys

# Add parent directory to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
core_dir = os.path.dirname(os.path.dirname(current_dir))
sys.path.insert(0, core_dir)

from core.python.shared.shared_logger import logger

# Load environment variables
load_dotenv()

# TCGplayer API Configuration
TCGPLAYER_TOKEN_URL = "https://api.tcgplayer.com/token"
TCGPLAYER_API_BASE_URL = "https://api.tcgplayer.com"
TCGPLAYER_API_VERSION = "v1.39.0"

# Get API credentials from environment variables
PUBLIC_KEY = os.getenv("TCGPLAYER_API_PUBLIC_KEY")
PRIVATE_KEY = os.getenv("TCGPLAYER_API_PRIVATE_KEY")

# Token file path - shared across all apps at repo root
# Calculate repo root: go up from core/python/pricing_pipeline to repo root
# current_dir = core/python/pricing_pipeline/
# dirname 1 = core/python/
# dirname 2 = core/
# dirname 3 = repo root
_repo_root = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
TOKEN_FILE = os.path.join(_repo_root, "tcgplayer_token.json")


def get_bearer_token(force_refresh=False, token_file_path=None):
    """
    Get a valid bearer token, refreshing if necessary.
    Only requests a new token if the current one is expired or about to expire.
    
    Args:
        force_refresh: If True, force a token refresh even if current token is valid
        token_file_path: Optional path to token file (defaults to TOKEN_FILE)
        
    Returns:
        Bearer token string, or None if failed
    """
    if not PUBLIC_KEY or not PRIVATE_KEY:
        logger.error("TCGPLAYER_API_PUBLIC_KEY and TCGPLAYER_API_PRIVATE_KEY must be set in .env file")
        return None
    
    token_file = token_file_path or TOKEN_FILE
    
    # Check if token file exists and is still valid
    if not force_refresh and os.path.exists(token_file):
        try:
            with open(token_file, 'r') as f:
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
                    logger.info(f"Using existing TCGplayer bearer token (expires in {minutes_remaining:.1f} minutes, at {expires_at.isoformat()}).")
                    return token_info.get("access_token")
                else:
                    if time_until_expiry > 0:
                        logger.info(f"Token expires soon (in {time_until_expiry/60:.1f} minutes, at {expires_at.isoformat()}), refreshing...")
                    else:
                        logger.info(f"Token has expired ({abs(time_until_expiry)/60:.1f} minutes ago, was {expires_at.isoformat()}), refreshing...")
        except (KeyError, ValueError, TypeError, json.JSONDecodeError) as e:
            logger.warning(f"Error reading token file, will refresh: {e}")
    
    # Request a new bearer token
    logger.info("Requesting new TCGplayer bearer token...")
    
    data = {
        "grant_type": "client_credentials",
        "client_id": PUBLIC_KEY,
        "client_secret": PRIVATE_KEY
    }
    
    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    try:
        response = requests.post(TCGPLAYER_TOKEN_URL, data=data, headers=headers)
        response.raise_for_status()
        
        token_data = response.json()
        bearer_token = token_data.get("access_token")
        
        if bearer_token:
            # Store token with expiry time (subtract 1 minute as safety margin)
            now_utc = datetime.now(timezone.utc)
            expires_in = token_data.get("expires_in", 1209599)  # Default to ~14 days if not provided
            expires_at = now_utc + timedelta(seconds=expires_in) - timedelta(minutes=1)
            
            token_info = {
                "access_token": bearer_token,
                "token_type": token_data.get("token_type", "bearer"),
                "expires_in": expires_in,
                "expires_at": expires_at.isoformat(),
                "userName": token_data.get("userName", PUBLIC_KEY),
                ".issued": token_data.get(".issued", ""),
                ".expires": token_data.get(".expires", "")
            }
            
            # Write token file with secure permissions (600 - owner read/write only)
            with open(token_file, 'w') as f:
                json.dump(token_info, f, indent=4)
            # Set secure permissions after writing (Unix/Linux only, safe to ignore on Windows)
            try:
                os.chmod(token_file, 0o600)
            except (OSError, NotImplementedError):
                # Windows doesn't support Unix-style permissions, which is fine for local dev
                pass
            
            logger.info(f"✓ Successfully obtained new TCGplayer bearer token (expires in {expires_in/3600:.1f} hours)")
            return bearer_token
        else:
            logger.error("No access_token in response")
            logger.error(f"Response: {token_data}")
            return None
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to obtain bearer token: {e}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Response status: {e.response.status_code}")
            logger.error(f"Response text: {e.response.text}")
        return None


def fetch_group_pricing(group_id: int, product_type_id: int = 128, bearer_token: str = None):
    """
    Fetch pricing data for a group (set) from TCGplayer API.
    
    Args:
        group_id: The group ID (set ID) to fetch pricing for
        product_type_id: Product type ID (default: 128 for Trading Cards)
        bearer_token: Optional bearer token. If not provided, will get one automatically.
        
    Returns:
        Dictionary with API response data, or None if failed
    """
    if bearer_token is None:
        bearer_token = get_bearer_token()
        if not bearer_token:
            return None
    
    url = f"{TCGPLAYER_API_BASE_URL}/pricing/group/{group_id}"
    params = {
        "productTypeID": product_type_id
    }
    
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {bearer_token}"
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        
        data = response.json()
        
        # Check if response indicates success
        if data.get("success", False):
            return data
        else:
            errors = data.get("errors", [])
            logger.error(f"API request was not successful for group {group_id}")
            if errors:
                logger.error(f"Errors: {errors}")
            else:
                logger.error(f"Response: {data}")
            return None
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch pricing for group {group_id}: {e}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Response status: {e.response.status_code}")
            logger.error(f"Response text: {e.response.text}")
        return None


def fetch_product_pricing(product_ids: list, bearer_token: str = None):
    """
    Fetch pricing data for specific products by product ID.
    
    Args:
        product_ids: List of product IDs to fetch pricing for
        bearer_token: Optional bearer token. If not provided, will get one automatically.
        
    Returns:
        Dictionary with API response data, or None if failed
    """
    if bearer_token is None:
        bearer_token = get_bearer_token()
        if not bearer_token:
            return None
    
    # TCGplayer API accepts comma-separated product IDs
    product_ids_str = ",".join(str(pid) for pid in product_ids)
    
    url = f"{TCGPLAYER_API_BASE_URL}/pricing/product/{product_ids_str}"
    
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {bearer_token}"
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        data = response.json()
        
        # Check if response indicates success
        if data.get("success", False):
            return data
        else:
            errors = data.get("errors", [])
            logger.error("API request was not successful for products")
            if errors:
                logger.error(f"Errors: {errors}")
            return None
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch pricing for products: {e}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Response status: {e.response.status_code}")
            logger.error(f"Response text: {e.response.text}")
        return None


def fetch_product_details(product_ids: list, bearer_token: str = None):
    """
    Fetch product details from TCGplayer catalog API.
    
    Args:
        product_ids: List of product IDs to fetch details for
        bearer_token: Optional bearer token. If not provided, will get one automatically.
        
    Returns:
        Dictionary with API response data, or None if failed
    """
    if bearer_token is None:
        bearer_token = get_bearer_token()
        if not bearer_token:
            return None
    
    # TCGplayer API accepts comma-separated product IDs
    product_ids_str = ",".join(str(pid) for pid in product_ids)
    
    url = f"{TCGPLAYER_API_BASE_URL}/catalog/products/{product_ids_str}"
    
    # Add getExtendedFields=true to get all product attributes including rarity
    params = {
        "getExtendedFields": True
    }
    
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {bearer_token}"
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        
        data = response.json()
        
        # Check if response indicates success
        if data.get("success", False):
            return data
        else:
            errors = data.get("errors", [])
            logger.error("API request was not successful for product details")
            if errors:
                logger.error(f"Errors: {errors}")
            return None
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to fetch product details: {e}")
        if hasattr(e, 'response') and e.response is not None:
            logger.error(f"Response status: {e.response.status_code}")
            logger.error(f"Response text: {e.response.text}")
        return None

