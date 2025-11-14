import requests
import base64
import json
from datetime import datetime, timedelta
from config import (
    EBAY_CLIENT_ID,
    EBAY_CERT_ID,
    EBAY_SANDBOX_ENV,
    EBAY_OAUTH_TOKEN_SANDBOX_URL,
    EBAY_OAUTH_TOKEN_PRODUCTION_URL,
    EBAY_BUY_API_ENDPOINT,
)

def get_application_access_token():
    if EBAY_SANDBOX_ENV:
        token_url = EBAY_OAUTH_TOKEN_SANDBOX_URL
    else:
        token_url = EBAY_OAUTH_TOKEN_PRODUCTION_URL

    # Encode client ID and client secret for Basic authentication
    auth_string = f"{EBAY_CLIENT_ID}:{EBAY_CERT_ID}"
    encoded_auth_string = base64.b64encode(auth_string.encode("utf-8")).decode("utf-8")

    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {encoded_auth_string}",
    }

    data = {
        "grant_type": "client_credentials",
        "scope": "https://api.ebay.com/oauth/api_scope", # Client Credentials scope for viewing public data
    }

    try:
        response = requests.post(token_url, headers=headers, data=data)
        response.raise_for_status()  # Raise an exception for HTTP errors
        token_info = response.json()
        return token_info["access_token"]
    except requests.exceptions.RequestException as e:
        print(f"Error obtaining access token: {e}")
        if response is not None:
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
        return None

def test_sold_listings_api_call(query: str, access_token: str):
    """Test Buy API Browse endpoint for sold listings using itemSoldFilter"""
    if not access_token:
        print("[ERROR] No access token provided. Cannot make Buy API call for sold listings.")
        return False

    print(f"\n{'='*60}")
    print("TEST 1: Buy API - Sold Listings (Using itemSoldFilter)")
    print(f"{'='*60}")
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json"
    }

    params = {
        "q": query,
        "item_filters": "itemSoldFilter:{true}",  # Filter for sold items only
        "limit": 10,  # Limit to 10 for testing
        "sort": "newlyListed"  # Sort by newly listed
    }

    try:
        response = requests.get(EBAY_BUY_API_ENDPOINT, headers=headers, params=params)
        print(f"[INFO] Status Code: {response.status_code}")
        
        # Check for HTTP errors
        if response.status_code != 200:
            print(f"[ERROR] HTTP {response.status_code} Error")
            print(f"Response: {response.text[:1000]}")
            return False
        
        data = response.json()
        
        items = data.get("itemSummaries", [])
        total_items = data.get("total", 0)
        
        if total_items > 0:
            print(f"[OK] Found {total_items} sold listings")
            if items:
                print(f"[OK] Sample item: {items[0].get('title', 'N/A')}")
                price = items[0].get('price', {})
                if price:
                    value = price.get('value', 'N/A')
                    currency = price.get('currency', 'USD')
                    print(f"  Price: {currency} {value}")
                # Check if item shows as sold
                condition = items[0].get('condition', 'N/A')
                print(f"  Condition: {condition}")
            return True
        else:
            print("[WARN] No sold listings found (this might be expected if no items match)")
            return True
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Error making Buy API call for sold listings: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"  Status Code: {e.response.status_code}")
            print(f"  Response: {e.response.text[:1000]}")
        return False
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_buy_api_call(access_token: str, query: str):
    """Test Buy API for current listings (requires OAuth token)"""
    if not access_token:
        print("No access token provided. Cannot make Buy API call.")
        return False

    print(f"\n{'='*60}")
    print("TEST 2: Buy API (Current Listings) - OAuth Token Required")
    print(f"{'='*60}")

    headers = {
        "Authorization": f"Bearer {access_token}",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json"
    }

    params = {
        "q": query,
        "limit": 10  # Limit to 10 for testing
    }

    try:
        response = requests.get(EBAY_BUY_API_ENDPOINT, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        
        print(f"[OK] Status Code: {response.status_code}")
        
        items = data.get("itemSummaries", [])
        total_items = data.get("total", 0)
        print(f"[OK] Found {total_items} current listings")
        if items:
            print(f"[OK] Sample item: {items[0].get('title', 'N/A')}")
            price = items[0].get('price', {})
            if price:
                value = price.get('value', 'N/A')
                currency = price.get('currency', 'USD')
                print(f"  Price: {currency} {value}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Error making Buy API call: {e}")
        if 'response' in locals() and response is not None:
            print(f"  Status Code: {response.status_code}")
            print(f"  Response: {response.text[:500]}")
        return False
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        return False

if __name__ == "__main__":
    print(f"{'='*60}")
    print("eBay API Production Test")
    print(f"{'='*60}")
    print(f"Environment: {'SANDBOX' if EBAY_SANDBOX_ENV else 'PRODUCTION'}")
    print(f"Client ID: {EBAY_CLIENT_ID[:10]}..." if EBAY_CLIENT_ID else "Client ID: NOT SET")
    print(f"{'='*60}\n")
    
    # Test query - using a Sorcery card for relevance
    test_query = "Sorcery Contested Realm"
    
    # Test 1: OAuth Token Generation
    print(f"\n{'='*60}")
    print("Getting OAuth Access Token...")
    print(f"{'='*60}")
    access_token = get_application_access_token()
    
    if not access_token:
        print("[ERROR] Failed to obtain access token.")
        sold_success = False
        buy_success = False
    else:
        print(f"[OK] Successfully obtained access token")
        print(f"  Token (first 20 chars): {access_token[:20]}...")
        
        # Test 2: Buy API for Sold Listings (using itemSoldFilter)
        sold_success = test_sold_listings_api_call(test_query, access_token)
        
        # Test 3: Buy API for Current Listings
        buy_success = test_buy_api_call(access_token, test_query)
    
    # Summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}")
    print(f"OAuth Token Generation: {'[PASS]' if access_token else '[FAIL]'}")
    print(f"Buy API (Sold Listings): {'[PASS]' if sold_success else '[FAIL]'}")
    print(f"Buy API (Current Listings): {'[PASS]' if buy_success else '[FAIL]'}")
    print(f"{'='*60}")
