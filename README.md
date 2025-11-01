## sorcerers-ledger

This project fetches card data from the TCGplayer API and generates dynamic HTML pages to display the card prices with hover-over image functionality.

### Installation

First, install the required Python libraries:

```bash
pip install -r requirements.txt
```

### Usage

1.  **Generate HTML Pages:**

    Run the `parse_cards.py` script to fetch card data from the TCGplayer API for Alpha, Beta, and Dust Reward Promos sets, and then generate two main HTML overview files:

    ```bash
    python parse_cards.py
    ```

    This will create the following HTML files in the project root:
    *   `index.html` (Non-Foil Cards Overview - three columns for Alpha, Beta, Dust Reward Promos)
    *   `foil_overview.html` (Foil Cards Overview - three columns for Alpha, Beta, Dust Reward Promos)

    The HTML is generated from `template.html` using the Jinja2 templating engine. The `template.html` file also contains the necessary JavaScript to dynamically render the card lists in a three-column layout and handle the hover-over image display directly in the browser.

2.  **View the Pages:**

    Open either `index.html` or `foil_overview.html` in your web browser. You can navigate between the non-foil and foil overview pages using the links provided at the top of each page.