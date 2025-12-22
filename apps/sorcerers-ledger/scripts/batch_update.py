"""
Sorcery: Contested Realm batch update script.
Wrapper that calls core batch update with Sorcery-specific configuration.
"""

import os
import sys
import importlib.util
from datetime import datetime

# Add paths for imports
script_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(script_dir)
repo_root = os.path.dirname(os.path.dirname(app_dir))

sys.path.insert(0, repo_root)
sys.path.insert(0, os.path.join(repo_root, 'core', 'python'))

# Set up logger with file output BEFORE importing other modules
logs_dir = os.path.join(app_dir, 'logs')
os.makedirs(logs_dir, exist_ok=True)
log_file = os.path.join(logs_dir, f'batch_update_{datetime.now().strftime("%Y%m%d")}.log')

# Import and reconfigure the default logger to write to file
# This must be done before importing modules that use the logger
from core.python.shared.shared_logger import logger, setup_logger

# Reconfigure the existing logger to also write to file
# Clear existing handlers and re-setup with file path
logger.handlers.clear()
setup_logger("card_game_pricing", log_file_path=log_file)

# Now import modules that use the logger (they'll use the file-configured logger)
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
    logger.info("=" * 60)
    logger.info("Starting Sorcery batch update script")
    logger.info(f"Log file: {log_file}")
    logger.info("=" * 60)
    
    try:
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
        logger.info("=" * 60)
        logger.info("Batch update completed successfully")
        logger.info("=" * 60)
    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"Batch update failed with error: {e}")
        logger.error("=" * 60)
        raise


if __name__ == "__main__":
    main()

