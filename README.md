# Sorcerer's Ledger - Monorepo

This is a monorepo for tracking card game prices across multiple games. The codebase is structured to maximize code reuse while allowing each game to have its own configuration, domain, and deployment.

## Structure

```
.
├── core/                          # Shared, reusable code
│   ├── python/
│   │   ├── pricing_pipeline/     # Core pricing data pipeline
│   │   │   ├── tcgplayer_api.py
│   │   │   ├── product_info_core.py
│   │   │   ├── pricing_core.py
│   │   │   └── batch_update_core.py
│   │   └── shared/
│   │       └── shared_logger.py
│   └── frontend/
│       └── components/           # Shared Vue components
│           ├── CardOverview.js
│           ├── CardDisplay.js
│           ├── CardItem.js
│           ├── Navigation.js
│           ├── TermsOfService.js
│           └── PrivacyPolicy.js
│
├── apps/                          # Game-specific applications
│   └── sorcerers-ledger/         # Sorcery: Contested Realm app
│       ├── config/
│       │   ├── game_config.py    # Python config (set IDs, rarities, rules)
│       │   └── frontendConfig.js # JS config (UI, icons, thresholds)
│       ├── scripts/
│       │   └── batch_update.py   # Wrapper script that calls core with config
│       ├── server/
│       │   ├── server.js          # Express server for this app
│       │   └── app.js            # Vue app entry point
│       └── public/                # Public assets and data
│           ├── index.html
│           ├── style.css
│           └── card-data/        # Generated pricing data
│
└── assets/                        # Shared assets (favicons, etc.)
```

## How It Works

### Core Pipeline

The **core** modules are game-agnostic and handle:
- TCGplayer API integration
- Product info fetching
- Price data processing
- Card categorization (foil/non-foil, sealed, preconstructed)
- Data sorting and organization

### Game Configuration

Each game app has two config files:

1. **`game_config.py`** (Python):
   - Set name → TCGplayer group ID mappings
   - Rarity lists and normalization
   - Rules for categorizing products (sealed vs singles)
   - TCGplayer product type ID

2. **`frontendConfig.js`** (JavaScript):
   - Rarity lists and price thresholds
   - Set icons and display order
   - TCGplayer URL slugs
   - Game title and branding

### Adding a New Game

To add a new card game:

1. **Create app directory**: `apps/new-game/`

2. **Create config files**:
   - `apps/new-game/config/game_config.py` - Copy from Sorcery and update:
     - `SET_GROUP_IDS` with your game's TCGplayer group IDs
     - `RARITIES` list
     - `RARITY_NORMALIZER` mapping
     - `TCGPLAYER_PRODUCT_TYPE_ID` (if different)
     - Product categorization functions (if naming differs)
   
   - `apps/new-game/config/frontendConfig.js` - Copy from Sorcery and update:
     - `RARITIES` and `RARITY_PRICE_THRESHOLDS`
     - `SET_ICONS` and `SET_ORDER`
     - `TCGPLAYER_CATEGORY_SLUG` and `SET_SLUG_MAP`
     - `PRECON_SOURCE_SETS` (if applicable)

3. **Create wrapper script**: `apps/new-game/scripts/batch_update.py`
   - Copy from `apps/sorcerers-ledger/scripts/batch_update.py`
   - Update paths to point to your config

4. **Create server files**: 
   - `apps/new-game/server/server.js` - Express server
   - `apps/new-game/server/app.js` - Vue app entry (imports your config)
   - `apps/new-game/public/index.html` - HTML template
   - `apps/new-game/public/style.css` - Styles (can share or customize)

5. **Deploy**:
   - Each app runs on its own server/domain
   - Schedule `batch_update.py` to run daily (cron, Task Scheduler, etc.)
   - Point your domain to the app's `server.js`

## Running the Sorcery App

### Backend (Data Pipeline)

```bash
# From repo root
cd apps/sorcerers-ledger/scripts
python batch_update.py
```

This will:
1. Fetch product info from TCGplayer (if files don't exist)
2. Fetch pricing data
3. Generate `apps/sorcerers-ledger/public/card-data/card_data.json`
4. Archive old data files

### Frontend (Web Server)

```bash
# From repo root
cd apps/sorcerers-ledger/server
node server.js
```

The server will:
- Serve static files from `apps/sorcerers-ledger/public/`
- Handle API routes (`/api/config`, `/list-files`)
- Serve the Vue app with Sorcery-specific config

## Environment Variables

Create a `.env` file in the repo root:

```
TCGPLAYER_API_PUBLIC_KEY=your_public_key
TCGPLAYER_API_PRIVATE_KEY=your_private_key
TCGPLAYER_API_TRACKING_LINK=your_affiliate_link
PORT=3000
ENABLE_BATCH_UPDATE_SCHEDULER=true  # Set to false to disable automatic scheduling
```

## Dependencies

### Python
- `requests`
- `python-dotenv`

### Node.js
- `express`
- `vue` (loaded via CDN)
- `vue-router` (loaded via CDN)
- `dotenv`

## Notes

- **Token Management**: TCGplayer bearer tokens are cached in `tcgplayer_token.json` at the repo root, shared across all apps
- **Data Location**: Each app stores its own `card-data/` directory in its `public/` folder
- **Code Sharing**: All pricing logic lives in `core/`, so bug fixes benefit all games
- **Isolation**: Each game has its own config, so changes to one game don't affect others
