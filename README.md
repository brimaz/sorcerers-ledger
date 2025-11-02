## sorcerers-ledger

This project fetches Sorcery: Contested Realm card data from the TCGplayer API and generates a dynamic HTML page to display card prices with hover-over image functionality. The project follows a more organized structure with separate files for CSS and JavaScript, and dedicated directories for data and scripts.

### Project Structure

```
.
├── assets/
│   └── sl-modal-close.png
├── card-data/
│   └── card_data.json
├── index.html
├── scripts/
│   ├── hover.js
│   ├── parse_cards.py
│   └── script.js
├── style.css
├── README.md
├── requirements.txt
```

### Installation

First, install the required Python libraries:

```bash
pip install -r requirements.txt
```

### Usage

1.  **Generate Card Data:**

    Run the `parse_cards.py` script to fetch card data from the TCGplayer API for Sorcery: Contested Realm sets. This script will populate the `card_data.json` file located in the `card-data/` directory.

    ```bash
    python scripts/parse_cards.py
    ```

2.  **View the Page:**

    Open `index.html` in your web browser. This single page dynamically displays both non-foil and foil card overviews, with options to sort and filter. The CSS for styling is in `style.css`, and the interactive logic is in `scripts/script.js` and `scripts/hover.js`.