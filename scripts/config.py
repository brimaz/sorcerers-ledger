# scripts/config.py
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Environment Settings ---
# Set to True for Sandbox, False for Production
EBAY_SANDBOX_ENV = os.getenv("EBAY_SANDBOX_ENV", "False").lower() == "true"

# --- eBay API Credentials ---
# Get these from your eBay Developer Program application settings
# App ID (Client ID)
EBAY_CLIENT_ID = os.getenv("EBAY_CLIENT_ID", "")
# Cert ID (Client Secret for Client Credentials Grant)
EBAY_CERT_ID = os.getenv("EBAY_CERT_ID", "")

# --- eBay API Endpoints ---
# Buy API - Browse endpoint for current and sold listings (using itemSoldFilter for sold)
EBAY_BUY_API_ENDPOINT = "https://api.ebay.com/buy/browse/v1/item_summary/search"

# OAuth Token Endpoints
EBAY_OAUTH_TOKEN_SANDBOX_URL = "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
EBAY_OAUTH_TOKEN_PRODUCTION_URL = "https://api.ebay.com/identity/v1/oauth2/token"

# Analytics API Endpoints
EBAY_ANALYTICS_API_ENDPOINT = "https://api.ebay.com/developer/analytics/v1_beta/rate_limit/"
EBAY_ANALYTICS_API_SANDBOX_ENDPOINT = "https://api.sandbox.ebay.com/developer/analytics/v1_beta/rate_limit/"
