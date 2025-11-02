import re
import json
from jinja2 import Environment, FileSystemLoader
import requests

def fetch_tcgplayer_data(url: str) -> list:
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        return data.get("result", [])
    except requests.exceptions.RequestException as e:
        return []
    except json.JSONDecodeError as e:
        return []

tcgplayer_api_urls = {
    "Alpha": "https://infinite-api.tcgplayer.com/priceguide/set/23335/cards/?rows=5000&productTypeID=128",
    "Beta": "https://infinite-api.tcgplayer.com/priceguide/set/23336/cards/?rows=5000&productTypeID=128",
    "Dust Reward Promos": "https://infinite-api.tcgplayer.com/priceguide/set/23514/cards/?rows=5000&productTypeID=128",
    "Arthurian Legends Promo": "https://infinite-api.tcgplayer.com/priceguide/set/23778/cards/?rows=5000&productTypeID=128",
    "Arthurian Legends": "https://infinite-api.tcgplayer.com/priceguide/set/23588/cards/?rows=5000&productTypeID=128",
    "Dragonlord": "https://infinite-api.tcgplayer.com/priceguide/set/24378/cards/?rows=5000&productTypeID=128",
}

def get_card_data_from_api(set_name: str):
    url = tcgplayer_api_urls.get(set_name)
    if not url:
        return []
    return fetch_tcgplayer_data(url)

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
        abbreviated_condition = condition_abbreviations.get(condition, condition)

        price_str = f"{price:.2f}"

        card_info = {"name": card_name, "price": price_str, "condition": abbreviated_condition, "rarity": rarity, "productID": product_id}

        if card.get("printing") == "Foil":
            foil_cards.append(card_info)
        else:
            non_foil_cards.append(card_info)

    def sort_by_price(cards):
        return sorted(cards, key=lambda x: float(x["price"].replace(',', '')), reverse=True)

    def sort_by_name(cards):
        return sorted(cards, key=lambda x: x["name"])

    all_sets_processed_data[set_name] = {
        "nonFoil": sort_by_price(non_foil_cards),
        "foil": sort_by_price(foil_cards),
        "nonFoilByName": sort_by_name(non_foil_cards),
        "foilByName": sort_by_name(foil_cards),
    }

    with open('card_data.json', 'w', encoding='utf-8') as f:
        json.dump(all_sets_processed_data, f, ensure_ascii=False, indent=4)
