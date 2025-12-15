import requests
import base64
import json
import os
from config import (
    EBAY_CLIENT_ID,
    EBAY_CERT_ID,
    EBAY_SANDBOX_ENV,
    EBAY_OAUTH_TOKEN_SANDBOX_URL,
    EBAY_OAUTH_TOKEN_PRODUCTION_URL,
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
        access_token = token_info["access_token"]
        expires_in = token_info["expires_in"]
        print(f"Successfully obtained eBay application access token. Expires in {expires_in} seconds.")
        return {"access_token": access_token, "expires_in": expires_in}
    except requests.exceptions.RequestException as e:
        print(f"Error obtaining access token: {e}")
        if response is not None: # Ensure response object exists before accessing
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
        return None

if __name__ == "__main__":
    print("Attempting to get eBay application access token...")
    token_info = get_application_access_token()
    if token_info:
        print("Successfully obtained access token:")
        print(token_info["access_token"])
        print(f"Expires In: {token_info['expires_in']} seconds")
    else:
        print("Failed to obtain access token.")
