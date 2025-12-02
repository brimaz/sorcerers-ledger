## sorcerers-ledger

This project fetches Sorcery: Contested Realm card data from TCGplayer's API and generates a dynamic HTML page to display card prices with hover-over image functionality. The project uses TCGplayer's pricing and catalog APIs to get up-to-date pricing information and product details.

### Project Structure

```
.
├── assets/
│   └── sl-modal-close.png
├── card-data/
│   ├── product-info/
│   │   └── product_info_{SetName}.json
│   ├── card_data.json
│   └── card_data_{timestamp}.json (archived files)
├── index.html
├── scripts/
│   ├── app.js
│   ├── batch_update.py
│   ├── components/
│   │   ├── CardDisplay.js
│   │   └── CardItem.js
│   ├── tcgplayer_api.py
│   ├── tcgplayer_pricing.py
│   └── tcgplayer_product_info.py
├── style.css
├── README.md
├── requirements.txt
└── .env
```

### Installation

1. **Set up a Python virtual environment (recommended):**

   Create and activate a virtual environment:

   ```bash
   # Create virtual environment
   python -m venv venv

   # Activate it (Windows PowerShell)
   .\venv\Scripts\Activate.ps1

   # Or activate it (Windows Command Prompt)
   venv\Scripts\activate.bat
   ```

2. **Install the required Python libraries:**

   ```bash
   pip install -r requirements.txt
   ```

   **Note:** If you prefer not to use a virtual environment, you can install globally, but this may cause dependency conflicts with other Python projects.

### Configuration

Before running the scripts, create a `.env` file in the project root with your TCGplayer API credentials and tracking link:

```env
TCGPLAYER_API_PUBLIC_KEY=your_public_key_here
TCGPLAYER_API_PRIVATE_KEY=your_private_key_here
TCGPLAYER_API_TRACKING_LINK=your_tcgplayer_tracking_link_here
```

The TCGplayer API uses OAuth 2.0 bearer tokens which are automatically managed by `tcgplayer_api.py`. Tokens are cached in `tcgplayer_token.json` and refreshed automatically when needed.

### Set Configuration

The system uses TCGplayer Group IDs to identify sets. Set mappings are defined in `scripts/tcgplayer_product_info.py`:

- Alpha: 23335
- Beta: 23336
- Dust Reward Promos: 23514
- Arthurian Legends Promo: 23778
- Arthurian Legends: 23588
- Dragonlord: 24378
- Gothic: 24471 (commented out - no pricing data yet)

### Usage

1. **Generate and Manage Card Data:**

   The `batch_update.py` script is responsible for:
   - Fetching product information from TCGplayer Catalog API (only if product info files don't exist)
   - Fetching pricing data from TCGplayer Pricing API for all configured sets
   - Generating a new `card_data.json` file in the `card-data/` directory
   - Archiving the previous day's `card_data.json` with a timestamp
   - Deleting any archived files older than 8 days
   - All log messages include timestamps in `[YYYY-MM-DD HH:MM:SS]` format

   **Important:** Make sure your virtual environment is activated before running Python scripts.

   To run the update manually:

   ```bash
   python scripts/batch_update.py
   ```

   For automated daily updates, set up a scheduled task (e.g., using Windows Task Scheduler or cron jobs on Linux) to run `scripts/batch_update.py` daily. The script will:
   - Only regenerate product info files if they don't exist (product info doesn't change frequently)
   - Update pricing data for all sets
   - Archive previous day's data automatically
   - Log all operations with timestamps

2. **View the Page:**

   Open `index.html` in your web browser or serve it with a web server. The page dynamically displays both non-foil and foil card overviews, with options to sort and filter. The interactive logic is handled by the Vue application initialized in `scripts/app.js` and its components in `scripts/components/`.

   **Note:** The application requires a web server to load JSON files due to CORS restrictions. Use a simple HTTP server:

   ```bash
   # Python 3
   python -m http.server 3000

   # Or use the included server.js (Node.js)
   node server.js
   ```

### Data Structure

The `card_data.json` file is organized by set, with the following structure:

```json
{
  "SetName": {
    "nonFoil": [...],
    "foil": [...],
    "sealed": [...],
    "preconstructed": [...],
    "nonFoilByName": [...],
    "foilByName": [...],
    "sealedByName": [...],
    "preconstructedByName": [...],
    "nonFoilByRarityPrice": {
      "Unique": [...],
      "Elite": [...],
      "Exceptional": [...],
      "Ordinary": [...]
    },
    "foilByRarityPrice": {...},
    "nonFoilByRarityName": {...},
    "foilByRarityName": {...}
  }
}
```

Each card entry includes:
- `name`: Card name
- `tcgplayerProductId`: TCGplayer product ID (used for image lookup)
- `tcgplayerLowPrice`: Low price from TCGplayer
- `tcgplayerMidPrice`: Mid price from TCGplayer
- `tcgplayerHighPrice`: High price from TCGplayer
- `tcgplayerMarketPrice`: Market price from TCGplayer
- `set_name`: Set name

### Product Info Files

Product info files are stored in `card-data/product-info/` and contain:
- `productId`: TCGplayer product ID
- `name`: Product name
- `cleanName`: Cleaned product name
- `imageUrl`: Product image URL from TCGplayer CDN
- `url`: Direct TCGplayer product URL
- `rarity`: Card rarity (Unique, Elite, Exceptional, Ordinary)

These files are only regenerated if they don't exist, as product information doesn't change frequently.

### Categories

Cards are automatically categorized:
- **nonFoil**: Regular non-foil cards
- **foil**: Foil cards
- **sealed**: Sealed products (booster boxes, cases, packs, etc.)
- **preconstructed**: Cards from preconstructed decks (both sealed deck boxes and individual cards)

### Logging

All log messages from `batch_update.py` include timestamps in the format `[YYYY-MM-DD HH:MM:SS]`, making it easy to track operations when running on a server with log file output.
