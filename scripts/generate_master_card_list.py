import json
import requests

def fetch_sorcery_cards():
    url = "https://api.sorcerytcg.com/api/cards"
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an exception for HTTP errors
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching Sorcery TCG cards: {e}")
        return None

def generate_master_card_list(output_file_path="card-data/sorcery_card_list.json"):
    all_cards_data = fetch_sorcery_cards()
    if all_cards_data is None:
        return

    master_card_list = {}
    for card in all_cards_data:
        card_name = card.get("name")
        if not card_name:
            continue

        master_card_list[card_name] = {
            "sets": []
        }

        for card_set in card.get("sets", []):
            set_name = card_set.get("name")
            rarity = card_set.get("metadata", {}).get("rarity")
            # We are interested in both foil and non-foil variants
            # For now, we will add a generic entry for each set/rarity combo
            master_card_list[card_name]["sets"].append({
                "set_name": set_name,
                "rarity": rarity,
            })
            
    with open(output_file_path, 'w', encoding='utf-8') as f:
        json.dump(master_card_list, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    generate_master_card_list()
