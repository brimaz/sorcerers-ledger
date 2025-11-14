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
│   ├── app.js
│   ├── batch_update.py
│   ├── components/
│   │   ├── CardDisplay.js
│   │   ├── CardItem.js
│   │   └── ImageModal.js
│   ├── parse_cards.py
├── style.css
├── README.md
├── requirements.txt
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

Before running the scripts, create a `.env` file in the project root with your eBay API credentials:

```env
EBAY_CLIENT_ID=your_client_id_here
EBAY_DEV_ID=your_dev_id_here
EBAY_CERT_ID=your_cert_id_here
EBAY_SANDBOX_ENV=False
```

The `config.py` file will automatically load these values from the `.env` file.

### Usage

1.  **Generate and Manage Card Data:**

    The `batch_update.py` script is responsible for fetching the latest card data from the TCGplayer API, generating a new `card_data.json` file in the `card-data/` directory, archiving the previous day's `card_data.json` with a timestamp, and deleting any archived files older than 8 days.

    **Important:** Make sure your virtual environment is activated before running Python scripts.

    To run the update manually:

    ```bash
    python scripts/batch_update.py
    ```

    For automated daily updates, set up a scheduled task (e.g., using Windows Task Scheduler or cron jobs on Linux) to run `scripts/batch_update.py` daily at 12 AM Eastern Time. Refer to the project documentation for detailed scheduling instructions.

2.  **View the Page:**

    Open `index.html` in your web browser. This single page dynamically displays both non-foil and foil card overviews, with options to sort and filter. The interactive logic is handled by the Vue application initialized in `scripts/app.js` and its components in `scripts/components/`. The CSS for styling is in `style.css`.