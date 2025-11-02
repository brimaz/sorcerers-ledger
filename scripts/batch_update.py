import os
import datetime
import glob
from parse_cards import generate_card_data_json

CARD_DATA_DIR = "card-data"
CURRENT_CARD_DATA_FILE = os.path.join(CARD_DATA_DIR, "card_data.json")

def run_batch_update():
    # Create card-data directory if it doesn't exist
    os.makedirs(CARD_DATA_DIR, exist_ok=True)

    # Generate new card data into a temporary file
    temp_file_path = os.path.join(CARD_DATA_DIR, "card_data_new.json")
    generate_card_data_json(temp_file_path)

    # Archive existing card_data.json if it exists
    if os.path.exists(CURRENT_CARD_DATA_FILE):
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        archive_path = os.path.join(CARD_DATA_DIR, f"card_data_{timestamp}.json")
        os.rename(CURRENT_CARD_DATA_FILE, archive_path)
        print(f"Archived existing card_data.json to {archive_path}")

    # Rename the new file to card_data.json
    os.rename(temp_file_path, CURRENT_CARD_DATA_FILE)
    print(f"New card_data.json generated at {CURRENT_CARD_DATA_FILE}")

    # Delete files older than 8 days
    eight_days_ago = datetime.datetime.now() - datetime.timedelta(days=8)
    for file_path in glob.glob(os.path.join(CARD_DATA_DIR, "card_data_*.json")):
        file_mod_time = datetime.datetime.fromtimestamp(os.path.getmtime(file_path))
        if file_mod_time < eight_days_ago:
            os.remove(file_path)
            print(f"Deleted old card data file: {file_path}")

if __name__ == "__main__":
    run_batch_update()
