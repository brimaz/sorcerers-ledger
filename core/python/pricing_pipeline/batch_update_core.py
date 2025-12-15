"""
Core batch update orchestration.
Handles archiving, cleanup, and coordination of product info and pricing generation.
"""

import os
import json
from datetime import datetime, timedelta
from typing import Dict, Callable
import sys

# Add parent directory to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
core_dir = os.path.dirname(os.path.dirname(current_dir))
sys.path.insert(0, core_dir)

from core.python.shared.shared_logger import logger
from core.python.pricing_pipeline.product_info_core import generate_product_info_files
from core.python.pricing_pipeline.pricing_core import generate_card_data_from_tcgplayer


def cleanup_old_archives(card_data_dir: str, days_to_keep: int = 8):
    """
    Delete archived card_data.json files older than the specified number of days.
    Only deletes files matching the pattern card_data_YYYYMMDD_HHMMSS.json
    
    Args:
        card_data_dir: Directory containing card data files
        days_to_keep: Number of days to keep archived files (default: 8)
    """
    if not os.path.exists(card_data_dir):
        return
    
    now = datetime.now()
    cutoff_date = now - timedelta(days=days_to_keep)
    deleted_count = 0
    
    try:
        for filename in os.listdir(card_data_dir):
            # Only process archived files (card_data_YYYYMMDD_HHMMSS.json), not the main card_data.json
            if filename.startswith("card_data_") and filename.endswith(".json") and filename != "card_data.json":
                file_path = os.path.join(card_data_dir, filename)
                
                # Extract date from filename: card_data_YYYYMMDD_HHMMSS.json
                try:
                    # Remove prefix "card_data_" and suffix ".json"
                    date_time_str = filename[10:-5]  # "card_data_" is 10 chars, ".json" is 5 chars
                    # Split by underscore to get date and time parts
                    date_str = date_time_str.split('_')[0]  # "20251118"
                    # Parse the date: YYYYMMDD
                    file_date_from_name = datetime.strptime(date_str, "%Y%m%d")
                    
                    file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path))
                    
                    # Calculate days since file date
                    days_old = (now.date() - file_date_from_name.date()).days
                    
                    # Delete if the date in the filename is older than the cutoff
                    if file_date_from_name.date() < cutoff_date.date():
                        os.remove(file_path)
                        deleted_count += 1
                        logger.info(f"Deleted old archive: {filename} (filename date: {file_date_from_name.date()}, mtime: {file_mtime.date()}, {days_old} days old)")
                except (ValueError, IndexError) as e:
                    # If filename doesn't match expected format, skip it
                    logger.warning(f"Could not parse date from filename '{filename}': {e}")
                    continue
        
        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} archived file(s) older than {days_to_keep} days.")
    except Exception as e:
        logger.error(f"Error cleaning up old archives: {e}")


def run_batch_update(
    set_group_ids: Dict[str, int],
    rarities: list,
    product_type_id: int,
    rarity_normalizer: Dict[str, str],
    output_file_path: str,
    card_data_dir: str,
    product_info_dir: str,
    is_sealed_precon_name_fn: Callable[[str], bool],
    is_precon_single_name_fn: Callable[[str], bool],
    is_sealed_name_fn: Callable[[str, str], bool],
    test_mode: bool = False,
    test_set_name: str = None,
    cache_duration_hours: int = 24,
    days_to_keep_archives: int = 8
):
    """
    Run the complete batch update process for a game.
    
    Args:
        set_group_ids: Dictionary mapping set name -> group ID
        rarities: List of rarity names
        product_type_id: TCGplayer product type ID
        rarity_normalizer: Dictionary mapping lowercase rarity values to normalized rarity names
        output_file_path: Path to output card_data.json file
        card_data_dir: Directory containing card data files
        product_info_dir: Directory containing product info files
        is_sealed_precon_name_fn: Function to check if a product name is a sealed preconstructed product
        is_precon_single_name_fn: Function to check if a product name is a preconstructed single
        is_sealed_name_fn: Function to check if a product name is a sealed product
        test_mode: If True, only process test set
        test_set_name: Set name to test (if test_mode is True)
        cache_duration_hours: How long to consider card_data.json fresh (not used currently, kept for compatibility)
        days_to_keep_archives: Number of days to keep archived files
    """
    logger.info("*" * 60)
    logger.info("Starting batch update process...")
    logger.info("*" * 60)
    
    # Archive existing card_data.json only if it's from a previous day
    if os.path.exists(output_file_path):
        modified_time = datetime.fromtimestamp(os.path.getmtime(output_file_path))
        today = datetime.now().date()
        file_date = modified_time.date()
        
        # Only archive if file is from a previous day
        if file_date < today:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            archive_file = os.path.join(card_data_dir, f"card_data_{timestamp}.json")
            
            # Rename current file to archived name
            os.rename(output_file_path, archive_file)
            logger.info(f"Archived previous day's card_data.json to {archive_file}")
        else:
            logger.info(f"Found existing card_data.json (last updated {modified_time.strftime('%Y-%m-%d %H:%M:%S')}). Will resume from existing data.")
    else:
        logger.info("card_data.json not found. Starting fresh update.")
    
    # Generate product info files from TCGplayer catalog API (only if they don't exist)
    logger.info("=" * 60)
    logger.info("Checking product info files from TCGplayer catalog...")
    logger.info("=" * 60)
    logger.info("(Product info files are only generated if they don't already exist)")
    generate_product_info_files(
        set_group_ids=set_group_ids,
        product_type_id=product_type_id,
        rarity_normalizer=rarity_normalizer,
        output_dir=product_info_dir
    )
    logger.info("Product info files check complete.")
    
    # Generate card data from TCGplayer
    logger.info("=" * 60)
    logger.info("Starting TCGplayer card data parsing...")
    logger.info("=" * 60)
    generate_card_data_from_tcgplayer(
        output_file_path=output_file_path,
        set_group_ids=set_group_ids,
        rarities=rarities,
        product_type_id=product_type_id,
        product_info_dir=product_info_dir,
        is_sealed_precon_name_fn=is_sealed_precon_name_fn,
        is_precon_single_name_fn=is_precon_single_name_fn,
        is_sealed_name_fn=is_sealed_name_fn,
        test_mode=test_mode,
        test_set_name=test_set_name
    )
    logger.info("TCGplayer card data parsing complete.")
    
    # Log successful completion
    if os.path.exists(output_file_path):
        logger.info(f"New card_data.json generated at {output_file_path}")
    
    # Clean up old archived files
    cleanup_old_archives(card_data_dir, days_to_keep=days_to_keep_archives)

