## sorcerers-ledger

This project fetches Sorcery: Contested Realm card data from the TCGplayer API and generates a dynamic HTML page to display card prices with hover-over image functionality. The project follows a more organized structure with separate files for CSS and JavaScript, and dedicated directories for data and scripts.

### Project Structure

```
.
├── assets/
│   └── sl-modal-close.png
├── card-data/
│   └── {card data json files}
├── index.html
├── scripts/
│   ├── batch_update.py
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

1.  **Generate and Manage Card Data:**

    The `batch_update.py` script is responsible for fetching the latest card data from the TCGplayer API, generating a new `card_data.json` file in the `card-data/` directory, archiving the previous day's `card_data.json` with a timestamp, and deleting any archived files older than 8 days.

    To run the update manually:

    ```bash
    python scripts/batch_update.py
    ```

    For automated daily updates, set up a scheduled task (e.g., using Windows Task Scheduler or cron jobs on Linux) to run `scripts/batch_update.py` daily at 12 AM Eastern Time. Refer to the project documentation for detailed scheduling instructions.

2.  **View the Page:**

    Open `index.html` in your web browser. This single page dynamically displays both non-foil and foil card overviews, with options to sort and filter. The CSS for styling is in `style.css`, and the interactive logic is in `scripts/script.js` and `scripts/hover.js`.