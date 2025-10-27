import re

# The CSV data provided by the user
csv_data = """Name,Type,Condition,Rarity,Price
Philosopher's Stone Normal\tNear Mint\tUnique\t$264.25 
Courtesan Thaïs Normal\tNear Mint\tUnique\t$237.45 
Erik's Curiosa Normal\tNear Mint\tUnique\t$229.30 
Death Dealer Normal\tNear Mint\tUnique\t$220.63 
Avatar of Air (Preconstructed Deck) Normal\tNear Mint\tElite\t$177.83 
Ruler of Thul Normal\tNear Mint\tUnique\t$136.45 
Avatar of Water (Preconstructed Deck) Normal\tNear Mint\tElite\t$135.33 
Avatar of Earth (Preconstructed Deck) Normal\tNear Mint\tElite\t$121.87 
Onyx Core Normal\tNear Mint\tUnique\t$98.26 
Ruby Core Normal\tNear Mint\tUnique\t$96.09 
Aquamarine Core Normal\tNear Mint\tUnique\t$82.41 
Amethyst Core Normal\tNear Mint\tUnique\t$70.62 
Avatar of Fire (Preconstructed Deck) Normal\tNear Mint\tElite\t$64.69 
Occult Ritual (Pledge Pack) Normal\tNear Mint\tUnique\t$39.40 
Mirror Realm Normal\tNear Mint\tUnique\t$37.55 
The Colour Out of Space Normal\tNear Mint\tUnique\t$35.34 
Highland Princess Normal\tNear Mint\tUnique\t$34.62 
Pathfinder Normal\tNear Mint\tUnique\t$29.68 
Sorcerer (Pledge Pack) Normal\tNear Mint\tElite\t$27.74 
Browse Normal\tNear Mint\tUnique\t$26.84 
Pillar of Zeiros Normal\tNear Mint\tUnique\t$26.28 
Grim Reaper Normal\tNear Mint\tUnique\t$22.82 
Atlantean Fate Normal\tNear Mint\tUnique\t$20.75 
Great Old One Normal\tNear Mint\tUnique\t$18.63 
Smokestacks of Gnaak Normal\tNear Mint\tUnique\t$18.41 
Guile Sirens (Pledge Pack) Normal\tNear Mint\tExceptional\t$17.48 
Pact with the Devil Normal\tNear Mint\tUnique\t$17.08 
Plague of Frogs Normal\tNear Mint\tUnique\t$15.22 
Dream-Quest Normal\tNear Mint\tUnique\t$15.00 
Orb of Ba'al Berith Normal\tNear Mint\tUnique\t$14.03 
Pnakotic Manuscript Normal\tNear Mint\tUnique\t$13.92 
Gilded Aegis Normal\tNear Mint\tUnique\t$13.80 
Kythera Mechanism Normal\tNear Mint\tUnique\t$13.72 
River of Flame Normal\tNear Mint\tUnique\t$13.46 
Pristine Paradise Normal\tNear Mint\tUnique\t$12.99 
Ultimate Horror Normal\tNear Mint\tUnique\t$12.44 
Immolation Normal\tNear Mint\tUnique\t$12.24 
River of Flame (Preconstructed Deck) Normal\tNear Mint\tUnique\t$12.00 
The Geistwood Normal\tNear Mint\tUnique\t$11.49 
Roots of Yggdrasil Normal\tNear Mint\tUnique\t$11.37 
Lord of Unland Normal\tNear Mint\tUnique\t$10.75 
Lord of the Void Normal\tNear Mint\tUnique\t$9.16 
Spear of Destiny (Preconstructed Deck) Normal\tNear Mint\tUnique\t$9.15 
Captain Baldassare Normal\tNear Mint\tUnique\t$8.95 
Occult Ritual Normal\tNear Mint\tUnique\t$8.83 
Mix Aer Normal\tNear Mint\tElite\t$8.73 
Twist of Fate Normal\tNear Mint\tUnique\t$8.40 
Gigantism Normal\tNear Mint\tUnique\t$8.28 
Blasted Oak Normal\tNear Mint\tUnique\t$8.11 
Seven-League Boots Normal\tNear Mint\tUnique\t$7.86 
Vaults of Zul Normal\tNear Mint\tUnique\t$7.62 
Crown Prince Normal\tNear Mint\tUnique\t$7.53 
Great Wall Normal\tNear Mint\tUnique\t$7.37 
Dome of Osiros Normal\tNear Mint\tUnique\t$7.22 
Queen of Midland Normal\tNear Mint\tUnique\t$6.99 
Tadpole Pool Normal\tNear Mint\tUnique\t$6.93 
Pendulum of Peril Normal\tNear Mint\tUnique\t$6.73 
Star-seeds of Uhr Normal\tNear Mint\tUnique\t$6.73 
Warp Spasm Normal\tNear Mint\tUnique\t$6.69 
Crown of the Victor Normal\tNear Mint\tUnique\t$6.40 
Spear of Destiny Normal\tNear Mint\tUnique\t$6.26 
Boneyard Normal\tNear Mint\tUnique\t$6.12 
The Immortal Throne Normal\tNear Mint\tUnique\t$5.97 
Tadpole Pool (Preconstructed Deck) Normal\tNear Mint\tUnique\t$5.96 
Queen of Midland (Preconstructed Deck) Normal\tNear Mint\tUnique\t$5.94 
Kingdom of Agartha Normal\tNear Mint\tUnique\t$5.83 
Donnybrook Inn Normal\tNear Mint\tUnique\t$5.49 
Vesuvius Normal\tNear Mint\tUnique\t$5.38 
Mix Aqua Normal\tNear Mint\tElite\t$5.31 
Mix Ignis Normal\tNear Mint\tElite\t$5.28 
Cerberus in Chains Normal\tNear Mint\tUnique\t$5.26 
Mother Nature Normal\tNear Mint\tUnique\t$5.14 
Midland Army Normal\tNear Mint\tUnique\t$5.00 
Infiltrate Normal\tNear Mint\tElite\t$4.97 
Cloud City Normal\tNear Mint\tUnique\t$4.88 
Witherwing Hero Normal\tNear Mint\tUnique\t$4.88 
Earthquake Normal\tNear Mint\tElite\t$4.86 
Grandmaster Wizard Normal\tNear Mint\tElite\t$4.79 
Mix Terra Normal\tNear Mint\tElite\t$4.71 
Windmill Normal\tNear Mint\tExceptional\t$4.65 
King of the Realm Normal\tNear Mint\tUnique\t$4.62 
Royal Bodyguard Normal\tNear Mint\tElite\t$4.55 
Doomsday Device Normal\tNear Mint\tUnique\t$4.20 
Angel's Egg Normal\tNear Mint\tElite\t$3.74 
Rift Valley Normal\tNear Mint\tElite\t$3.72 
Mother Nature (Preconstructed Deck) Normal\tNear Mint\tUnique\t$3.70 
Maelstrom Normal\tNear Mint\tUnique\t$3.69 
Vile Imp Normal\tNear Mint\tOrdinary\t$3.67 
Deathspeaker Normal\tNear Mint\tElite\t$3.59 
King of the Realm (Preconstructed Deck) Normal\tNear Mint\tUnique\t$3.41 
Red Desert (Preconstructed Deck) Normal\tNear Mint\tOrdinary\t$3.36 
Sirian Templar (Box Topper) Normal\tNear Mint\tExceptional\t$3.33 
Sinkhole Normal\tNear Mint\tElite\t$3.30 
Ruins Normal\tNear Mint\tExceptional\t$3.12 
Battlemage Normal\tNear Mint\tElite\t$2.97 
Observatory Normal\tNear Mint\tElite\t$2.95 
Elementalist Normal\tNear Mint\tElite\t$2.90 
Hounds of Ondaros Normal\tNear Mint\tElite\t$2.83 
Doomsday Prophet Normal\tNear Mint\tUnique\t$2.82 
Magellan Globe Normal\tNear Mint\tElite\t$2.72 
Steppe Normal\tNear Mint\tExceptional\t$2.62 
Primordial Spring Normal\tNear Mint\tElite\t$2.61 
Highland Falconer Normal\tNear Mint\tElite\t$2.57 
Aqueduct Normal\tNear Mint\tExceptional\t$2.50 
Crossroads Normal\tNear Mint\tElite\t$2.50 
The Artists (Box Topper) Normal\tNear Mint\tPromo\t$2.49 
Maelstrom (Preconstructed Deck) Normal\tNear Mint\tUnique\t$2.43 
Selfsame Simulacrum Normal\tNear Mint\tElite\t$2.37 
Oasis Normal\tNear Mint\tExceptional\t$2.36 
Enchantress Normal\tNear Mint\tElite\t$2.31 
Pollimorph Normal\tNear Mint\tElite\t$2.29 
Lighthouse Normal\tNear Mint\tExceptional\t$2.21 
Chaos Twister Normal\tNear Mint\tElite\t$2.17 
Ancient Dragon Normal\tNear Mint\tElite\t$2.15 
Seer Normal\tNear Mint\tElite\t$2.15 
Screaming Skull Normal\tNear Mint\tElite\t$2.13 
Disintegrate Normal\tNear Mint\tElite\t$2.02 
Vril Revenant Normal\tNear Mint\tElite\t$2.01 """

# Parse the CSV data
foil_cards = []
non_foil_cards = []

lines = csv_data.strip().split('\n')
for line in lines[1:]:  # Skip the header
    if not line.strip():
        continue
    
    # Extract card name and price using regex
    match = re.match(r'^(.+?)\s+Normal\s+.+?\s+\$(.+?)\s*$', line)
    if match:
        card_name = match.group(1).strip()
        price = match.group(2).strip()
        
        # Determine if it's a foil card based on name containing "(Foil)"
        if "(Foil)" in card_name:
            foil_cards.append({"name": card_name, "price": price})
        else:
            non_foil_cards.append({"name": card_name, "price": price})

# Sort cards by price (descending)
def sort_by_price(cards):
    return sorted(cards, key=lambda x: float(x["price"].replace(',', '')), reverse=True)

foil_cards = sort_by_price(foil_cards)
non_foil_cards = sort_by_price(non_foil_cards)

# Generate HTML
html = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sorcery Alpha - Card Prices</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f4f4f4;
        }
        h1 {
            color: #333;
            text-align: center;
        }
        h2 {
            color: #666;
            border-bottom: 2px solid #ddd;
            padding-bottom: 10px;
        }
        .card-section {
            margin: 30px 0;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        ul {
            list-style: none;
            padding: 0;
        }
        li {
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .card-name {
            font-weight: bold;
            color: #333;
        }
        .card-price {
            color: #666;
            float: right;
        }
        li:last-child {
            border-bottom: none;
        }
    </style>
</head>
<body>
    <h1>Sorcery Alpha - Card Prices</h1>
    
    <div class="card-section">
        <h2>Foil Cards (""" + str(len(foil_cards)) + """ cards)</h2>
        <ul>
"""

for card in foil_cards:
    html += '            <li><span class="card-name">' + card['name'] + '</span> <span class="card-price">$' + card['price'] + '</span></li>\n'

html += """        </ul>
    </div>
    
    <div class="card-section">
        <h2>Non-Foil Cards (""" + str(len(non_foil_cards)) + """ cards)</h2>
        <ul>
"""

for card in non_foil_cards:
    html += '            <li><span class="card-name">' + card['name'] + '</span> <span class="card-price">$' + card['price'] + '</span></li>\n'

html += """        </ul>
    </div>
</body>
</html>"""

# Write to index.html
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Successfully generated index.html with {len(foil_cards)} foil cards and {len(non_foil_cards)} non-foil cards.")
