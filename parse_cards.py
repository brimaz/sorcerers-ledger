import re
import json
from jinja2 import Environment, FileSystemLoader
import requests # Added for fetch_tcgplayer_data

def fetch_tcgplayer_data(url: str) -> list:
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an HTTPError for bad responses (4xx or 5xx)
        data = response.json()
        return data.get("result", [])
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from the API: {e}")
        return []
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON response: {e}")
        return []

# API URLs for TCGplayer sets
tcgplayer_api_urls = {
    "Alpha": "https://infinite-api.tcgplayer.com/priceguide/set/23335/cards/?rows=5000&productTypeID=128",
    "Beta": "https://infinite-api.tcgplayer.com/priceguide/set/23336/cards/?rows=5000&productTypeID=128",
    "Dust Reward Promos": "https://infinite-api.tcgplayer.com/priceguide/set/23514/cards/?rows=5000&productTypeID=128",
}

def get_card_data_from_api(set_name: str):
    url = tcgplayer_api_urls.get(set_name)
    if not url:
        print(f"Error: API URL for set '{set_name}' not found.")
        return []
    return fetch_tcgplayer_data(url)

# Fetch and process data for all sets
all_sets_processed_data = {}

for set_name, api_url in tcgplayer_api_urls.items():
    raw_cards_data = get_card_data_from_api(set_name)
    
    non_foil_cards = []
    foil_cards = []

    for card in raw_cards_data:
        card_name = card.get("productName", "N/A")
        price = card.get("marketPrice", 0.0)
        condition = card.get("condition", "N/A")
        rarity = card.get("rarity", "N/A")
        product_id = card.get("productID", None)

        # Apply condition abbreviations
        condition_abbreviations = {
            "Damaged": "D",
            "Heavily Played Foil": "HPF",
            "Lightly Played": "LP",
            "Lightly Played Foil": "LPF",
            "Moderately Played": "MP",
            "Moderately Played Foil": "MPF",
            "Near Mint": "NM",
            "Near Mint Foil": "NMF",
        }
        abbreviated_condition = condition_abbreviations.get(condition, condition) # Use original if no abbreviation found

        price_str = f"{price:.2f}"

        card_info = {"name": card_name, "price": price_str, "condition": abbreviated_condition, "rarity": rarity, "productID": product_id}

        if card.get("printing") == "Foil":
            foil_cards.append(card_info)
        else:
            non_foil_cards.append(card_info)

    # Sort cards by price (descending)
    def sort_by_price(cards):
        return sorted(cards, key=lambda x: float(x["price"].replace(',', '')), reverse=True)

    all_sets_processed_data[set_name] = {
        "nonFoil": sort_by_price(non_foil_cards),
        "foil": sort_by_price(foil_cards),
    }

# Set up Jinja2 environment
env = Environment(loader=FileSystemLoader('.'))
template = env.get_template('template.html')

# Prepare data for the Non-Foil Overview Page
non_foil_overview_data = {}
for set_name, data in all_sets_processed_data.items():
    non_foil_overview_data[set_name] = data["nonFoil"]

# Render the Non-Foil Overview Page (index.html)
html_output_non_foil_overview = template.render(
    page_title="Sorcery Non-Foil Card Prices Overview",
    all_sets_card_data=non_foil_overview_data,
    is_foil_page=False,
    current_page="nonfoil_overview"
)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html_output_non_foil_overview)
print(f"Successfully generated index.html (Non-Foil Overview Page).")

# Prepare data for the Foil Overview Page
foil_overview_data = {}
for set_name, data in all_sets_processed_data.items():
    foil_overview_data[set_name] = data["foil"]

# Render the Foil Overview Page (foil_overview.html)
html_output_foil_overview = template.render(
    page_title="Sorcery Foil Card Prices Overview",
    all_sets_card_data=foil_overview_data,
    is_foil_page=True,
    current_page="foil_overview"
)

with open('foil_overview.html', 'w', encoding='utf-8') as f:
    f.write(html_output_foil_overview)
print(f"Successfully generated foil_overview.html (Foil Overview Page).")
