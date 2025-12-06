## sorcerers-ledger

This project fetches Sorcery: Contested Realm card data from TCGplayer's API and generates a dynamic HTML page to display card prices with hover-over image functionality. The project uses TCGplayer's pricing and catalog APIs to get up-to-date pricing information and product details.

The application provides multiple views:
- **Non-Foil Overview**: Regular non-foil cards from all sets
- **Foil Overview**: Foil cards from all sets
- **Precon**: Individual cards from preconstructed decks (singles only)
- **Sealed**: Sealed products (booster boxes, cases, packs, displays, and sealed preconstructed deck boxes)

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
│   │   ├── CardItem.js
│   │   ├── CardOverview.js
│   │   ├── Navigation.js
│   │   ├── PrivacyPolicy.js
│   │   └── TermsOfService.js
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
- Gothic: 24471

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

   Open `index.html` in your web browser or serve it with a web server. The application provides multiple pages:
   - **Non-Foil Overview** (`/`): Regular non-foil cards from all sets
   - **Foil Overview** (`/?view=foil`): Foil cards from all sets
   - **Precon** (`/precon`): Individual cards from preconstructed decks
   - **Sealed** (`/sealed`): Sealed products (booster boxes, cases, packs, displays)

   Each page includes:
   - Sorting options (by price or name, ascending/descending)
   - Price type selection (Market, Low, Mid, High)
   - Price change indicators (▲/▼) showing changes from the previous week
   - Hover-over card images (desktop)
   - Mobile-friendly modal views

   The interactive logic is handled by the Vue application initialized in `scripts/app.js` and its components in `scripts/components/`.

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
    "nonFoil": [...],           // Regular non-foil cards (sorted by price, descending)
    "foil": [...],              // Foil cards (sorted by price, descending)
    "sealed": [...],            // Sealed products (sorted by price, descending)
    "preconstructed": [...],    // Preconstructed deck singles (sorted by price, descending)
    "nonFoilByName": [...],     // Non-foil cards sorted alphabetically
    "foilByName": [...],        // Foil cards sorted alphabetically
    "sealedByName": [...],      // Sealed products sorted alphabetically
    "preconstructedByName": [...], // Preconstructed singles sorted alphabetically
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

Each card/product entry includes:
- `name`: Card/product name
- `tcgplayerProductId`: TCGplayer product ID (used for image lookup and TCGplayer links)
- `tcgplayerLowPrice`: Low price from TCGplayer
- `tcgplayerMidPrice`: Mid price from TCGplayer
- `tcgplayerHighPrice`: High price from TCGplayer
- `tcgplayerMarketPrice`: Market price from TCGplayer
- `set_name`: Set name

**Sorting:**
- All `*ByName` arrays are sorted case-insensitively alphabetically
- All price-sorted arrays use `tcgplayerMarketPrice` for sorting (descending by default)

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

Products are automatically categorized based on their type:

- **nonFoil**: Regular non-foil cards (including individual cards from pledge packs like "Occult Ritual (Pledge Pack)")
- **foil**: Foil cards (including foil pledge pack cards like "Death's Door (Foil) (Pledge Pack)")
- **sealed**: Sealed products including:
  - Booster boxes, booster cases, booster packs
  - Pledge packs (sealed, without parentheses in name)
  - Displays and booster displays
  - Sealed preconstructed deck boxes (e.g., "The Four Elementals Preconstructed Deck Box")
  - Sealed preconstructed decks (e.g., "The Four Elementals Preconstructed Deck: Air")
  - Set-specific boxes (e.g., "Dragonlord Box")
- **preconstructed**: Individual cards from preconstructed decks (only items with "(Preconstructed Deck)" in the name, e.g., "Avatar of Air (Preconstructed Deck)")

**Note:** Items with "(Pledge Pack)" in parentheses are individual cards and go to `nonFoil` or `foil`, not `sealed`. Sealed pledge packs (without parentheses) go to `sealed`.

### Frontend Features

The application includes several interactive features:

- **Multiple Pages**: Navigate between Non-Foil, Foil, Precon, and Sealed views
- **Sorting**: Sort cards by price (high to low, low to high) or name (A to Z, Z to A)
- **Price Types**: Choose between Market, Low, Mid, or High prices
- **Group by Rarity**: (Non-Foil/Foil pages only) Group cards by rarity (Unique, Elite, Exceptional, Ordinary)
- **Show Only High Value Cards**: (Non-Foil/Foil pages only) Filter to show only cards above rarity-specific price thresholds
- **Price Changes**: View price change indicators (▲/▼) showing changes from the previous week
  - Unchecked: Shows all price change arrows
  - Checked: Shows only arrows for changes >= $1
- **Pledge Pack Section**: When grouping by rarity, cards with "(Pledge Pack)" in the name appear in a separate "Pledge Pack" section at the bottom
- **Hover Images**: Desktop users can hover over card names to see card images
- **Mobile Support**: Touch-friendly interface with modal image views on mobile devices

### Price Change Tracking

The application compares current prices with archived data from the previous day to show price changes. Archived files are automatically created with timestamps (e.g., `card_data_20251203_210003.json`) and kept for 8 days before being automatically deleted.

### Logging

All log messages from `batch_update.py` include timestamps in the format `[YYYY-MM-DD HH:MM:SS]`, making it easy to track operations when running on a server with log file output.
