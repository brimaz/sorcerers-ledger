"""
Sorcery: Contested Realm batch update script.
Wrapper that calls core batch update with Sorcery-specific configuration.
"""

import os
import sys
import importlib.util

# Add paths for imports
script_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(script_dir)
repo_root = os.path.dirname(os.path.dirname(app_dir))

sys.path.insert(0, repo_root)
sys.path.insert(0, os.path.join(repo_root, 'core', 'python'))

from core.python.pricing_pipeline.batch_update_core import run_batch_update

# Import game config using importlib (handles hyphens in directory names)
config_path = os.path.join(app_dir, 'config', 'game_config.py')
spec = importlib.util.spec_from_file_location("game_config", config_path)
game_config = importlib.util.module_from_spec(spec)
spec.loader.exec_module(game_config)

SET_GROUP_IDS = game_config.SET_GROUP_IDS
RARITIES = game_config.RARITIES
RARITY_NORMALIZER = game_config.RARITY_NORMALIZER
TCGPLAYER_PRODUCT_TYPE_ID = game_config.TCGPLAYER_PRODUCT_TYPE_ID
is_sealed_preconstructed_product_name = game_config.is_sealed_preconstructed_product_name
is_preconstructed_single_name = game_config.is_preconstructed_single_name
is_sealed_product_name = game_config.is_sealed_product_name

# Configuration
CARD_DATA_DIR = os.path.join(app_dir, "public", "card-data")
OUTPUT_FILE = os.path.join(CARD_DATA_DIR, "card_data.json")
PRODUCT_INFO_DIR = os.path.join(CARD_DATA_DIR, "product-info")

TEST_MODE = False
TEST_SET_NAME = "Alpha"
CACHE_DURATION_HOURS = 24
DAYS_TO_KEEP_ARCHIVES = 8


def main():
    run_batch_update(
        set_group_ids=SET_GROUP_IDS,
        rarities=RARITIES,
        product_type_id=TCGPLAYER_PRODUCT_TYPE_ID,
        rarity_normalizer=RARITY_NORMALIZER,
        output_file_path=OUTPUT_FILE,
        card_data_dir=CARD_DATA_DIR,
        product_info_dir=PRODUCT_INFO_DIR,
        is_sealed_precon_name_fn=is_sealed_preconstructed_product_name,
        is_precon_single_name_fn=is_preconstructed_single_name,
        is_sealed_name_fn=is_sealed_product_name,
        test_mode=TEST_MODE,
        test_set_name=TEST_SET_NAME,
        cache_duration_hours=CACHE_DURATION_HOURS,
        days_to_keep_archives=DAYS_TO_KEEP_ARCHIVES
    )


if __name__ == "__main__":
    main()

