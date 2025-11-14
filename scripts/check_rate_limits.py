import requests
import json
import os
from datetime import datetime
from config import (
    EBAY_SANDBOX_ENV,
    EBAY_ANALYTICS_API_ENDPOINT,
    EBAY_ANALYTICS_API_SANDBOX_ENDPOINT,
)
from batch_update import get_or_refresh_access_token


def get_rate_limits(access_token: str = None, api_name: str = None, api_context: str = None):
    """
    Retrieve rate limit information from eBay Analytics API.
    
    Args:
        access_token: OAuth access token. If None, will attempt to get/refresh from token file.
        api_name: Optional filter for specific API (e.g., 'browse', 'inventory', 'taxonomy', 'tradingapi')
        api_context: Optional filter for API context (e.g., 'buy', 'sell', 'commerce', 'developer', 'tradingapi')
    
    Returns:
        dict: Rate limit data, or None if error occurred
    """
    if not access_token:
        access_token = get_or_refresh_access_token()
        if not access_token:
            return None
    
    if EBAY_SANDBOX_ENV:
        endpoint = EBAY_ANALYTICS_API_SANDBOX_ENDPOINT
    else:
        endpoint = EBAY_ANALYTICS_API_ENDPOINT
    
    params = {}
    if api_name:
        params["api_name"] = api_name
    if api_context:
        params["api_context"] = api_context
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(endpoint, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException:
        return None
    except Exception:
        return None


def format_time_window(seconds: int) -> str:
    """Convert seconds to human-readable time format."""
    if seconds < 60:
        return f"{seconds} seconds"
    elif seconds < 3600:
        minutes = seconds // 60
        return f"{minutes} minute{'s' if minutes != 1 else ''}"
    elif seconds < 86400:
        hours = seconds // 3600
        return f"{hours} hour{'s' if hours != 1 else ''}"
    else:
        days = seconds // 86400
        return f"{days} day{'s' if days != 1 else ''}"


def print_rate_limits(rate_limits_data: dict):
    """Pretty print rate limit information."""
    if not rate_limits_data or "rateLimits" not in rate_limits_data:
        print("No rate limit data available.")
        return
    
    rate_limits = rate_limits_data.get("rateLimits", [])
    
    if not rate_limits:
        print("No rate limits found.")
        return
    
    print(f"\n{'='*80}")
    print("eBay API Rate Limits")
    print(f"{'='*80}")
    print(f"Environment: {'SANDBOX' if EBAY_SANDBOX_ENV else 'PRODUCTION'}")
    print(f"Total APIs: {len(rate_limits)}")
    print(f"{'='*80}\n")
    
    for api_info in rate_limits:
        api_context = api_info.get("apiContext", "N/A")
        api_name = api_info.get("apiName", "N/A")
        api_version = api_info.get("apiVersion", "N/A")
        
        print(f"API: {api_name} ({api_context}) - Version: {api_version}")
        print("-" * 80)
        
        resources = api_info.get("resources", [])
        if not resources:
            print("  No resources found.")
            print()
            continue
        
        for resource in resources:
            resource_name = resource.get("name", "N/A")
            rates = resource.get("rates", [])
            
            if not rates:
                print(f"  Resource: {resource_name}")
                print("    No rate limit data available.")
                print()
                continue
            
            print(f"  Resource: {resource_name}")
            
            for rate in rates:
                count = rate.get("count", 0)
                limit = rate.get("limit", 0)
                remaining = rate.get("remaining", 0)
                reset = rate.get("reset", "N/A")
                time_window = rate.get("timeWindow", 0)
                
                if limit > 0:
                    percentage = (count / limit) * 100
                else:
                    percentage = 0
                
                reset_time_str = "N/A"
                if reset != "N/A":
                    try:
                        reset_dt = datetime.fromisoformat(reset.replace('Z', '+00:00'))
                        reset_time_str = reset_dt.strftime("%Y-%m-%d %H:%M:%S UTC")
                    except:
                        reset_time_str = reset
                
                print(f"    Calls Made: {count:,} / {limit:,} ({percentage:.1f}% used)")
                print(f"    Remaining: {remaining:,}")
                print(f"    Time Window: {format_time_window(time_window)}")
                print(f"    Reset Time: {reset_time_str}")
                
                if percentage >= 90:
                    print(f"    ⚠️  WARNING: {percentage:.1f}% of rate limit used!")
                elif percentage >= 75:
                    print(f"    ⚠️  CAUTION: {percentage:.1f}% of rate limit used")
                
                print()
        
        print()


def main():
    """Main function to check and display rate limits."""
    import sys
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    if os.path.basename(script_dir) == "scripts":
        os.chdir(project_root)
    
    api_name = None
    api_context = None
    
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            if arg.startswith("--api-name="):
                api_name = arg.split("=", 1)[1]
            elif arg.startswith("--api-context="):
                api_context = arg.split("=", 1)[1]
            elif arg == "--help" or arg == "-h":
                print("Usage: python check_rate_limits.py [--api-name=NAME] [--api-context=CONTEXT]")
                print("\nOptions:")
                print("  --api-name=NAME      Filter by API name (e.g., 'browse', 'inventory', 'tradingapi')")
                print("  --api-context=CONTEXT Filter by API context (e.g., 'buy', 'sell', 'commerce', 'tradingapi')")
                print("\nExamples:")
                print("  python check_rate_limits.py")
                print("  python check_rate_limits.py --api-name=browse")
                print("  python check_rate_limits.py --api-context=buy")
                return
    
    rate_limits_data = get_rate_limits(api_name=api_name, api_context=api_context)
    
    if rate_limits_data:
        print_rate_limits(rate_limits_data)


if __name__ == "__main__":
    main()

