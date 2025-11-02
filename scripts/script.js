let allSetsCardData = {};
let allSetsCardDataByName = {};
let allSetsCardDataByRarityPrice = {};
let allSetsCardDataByRarityName = {};
let isFoilPage = false;
const RARITIES = ["Unique", "Elite", "Exceptional", "Ordinary"];

const SET_ICONS = {
    "Alpha": "α",
    "Beta": "β",
    "Dust Reward Promos": "★",
    "Arthurian Legends Promo": "★",
    "Arthurian Legends": "⚔️", // Sword icon
    "Dragonlord": "🐉", // Dragon icon
};

const RARITY_PRICE_THRESHOLDS = {
    "Unique": 1.5,
    "Elite": 1.5,
    "Exceptional": 0.75,
    "Ordinary": 0.75,
};

const NON_FOIL_CONDITION_ORDER = ["NM", "LP", "MP", "HP", "D"];
const FOIL_CONDITION_ORDER = ["NMF", "LPF", "MPF", "HPF"];

function getSortOption() {
    return document.getElementById('sort-select').value;
}

function getSortedData(setsData, setsDataByName, setsDataByRarityPrice, setsDataByRarityName, sortOption, isGrouped, isFiltered, isFilteredNmCondition) {
    let processedData = {};

    if (isGrouped) {
        if (sortOption === 'name-asc') {
            processedData = setsDataByRarityName;
        } else if (sortOption === 'name-desc') {
            for (const setName in setsDataByRarityName) {
                processedData[setName] = {};
                for (const rarity in setsDataByRarityName[setName]) {
                    processedData[setName][rarity] = [...setsDataByRarityName[setName][rarity]].reverse();
                }
            }
        } else if (sortOption === 'price-asc') {
            for (const setName in setsDataByRarityPrice) {
                processedData[setName] = {};
                for (const rarity in setsDataByRarityPrice[setName]) {
                    processedData[setName][rarity] = [...setsDataByRarityPrice[setName][rarity]].sort((a, b) => parseFloat(a.price.replace(',', '')) - parseFloat(b.price.replace(',', '')));
                }
            }
        } else {
            processedData = setsDataByRarityPrice;
        }

        if (isFiltered) {
            const filteredData = {};
            for (const setName in processedData) {
                filteredData[setName] = {};
                for (const rarity in processedData[setName]) {
                    const threshold = RARITY_PRICE_THRESHOLDS[rarity];
                    filteredData[setName][rarity] = processedData[setName][rarity].filter(card => parseFloat(card.price.replace(',', '')) > threshold);
                }
            }
            processedData = filteredData;
        }

        if (isFilteredNmCondition) {
            const filteredNmData = {};
            const nmCondition = isFoilPage ? "NMF" : "NM";
            for (const setName in processedData) {
                filteredNmData[setName] = {};
                for (const rarity in processedData[setName]) {
                    filteredNmData[setName][rarity] = processedData[setName][rarity].filter(card => card.condition === nmCondition);
                }
            }
            return filteredNmData;
        } else { // Changed from else if (isGrouped)
            const sortedByConditionData = {};
            const currentConditionOrder = isFoilPage ? FOIL_CONDITION_ORDER : NON_FOIL_CONDITION_ORDER;
            for (const setName in processedData) {
                sortedByConditionData[setName] = {};
                for (const rarity in processedData[setName]) {
                    sortedByConditionData[setName][rarity] = [...processedData[setName][rarity]].sort((a, b) => {
                        return currentConditionOrder.indexOf(a.condition) - currentConditionOrder.indexOf(b.condition);
                    });
                }
            }
            return sortedByConditionData;
        }
        return processedData;

    } else {
        if (sortOption === 'name-asc') {
            processedData = setsDataByName;
        } else if (sortOption === 'name-desc') {
            for (const setName in setsDataByName) {
                processedData[setName] = [...setsDataByName[setName]].reverse();
            }
        } else if (sortOption === 'price-asc') {
            for (const setName in setsData) {
                processedData[setName] = [...setsData[setName]].sort((a, b) => parseFloat(a.price.replace(',', '')) - parseFloat(b.price.replace(',', '')));
            }
        } else {
            processedData = setsData;
        }

        if (isFiltered) {
            const filteredData = {};
            for (const setName in processedData) {
                filteredData[setName] = processedData[setName].filter(card => {
                    const threshold = RARITY_PRICE_THRESHOLDS[card.rarity];
                    return parseFloat(card.price.replace(',', '')) > threshold;
                });
            }
            processedData = filteredData;
        }

        if (isFilteredNmCondition) {
            const filteredNmData = {};
            const nmCondition = isFoilPage ? "NMF" : "NM";
            for (const setName in processedData) {
                filteredNmData[setName] = processedData[setName].filter(card => card.condition === nmCondition);
            }
            return filteredNmData;
        } else {
            const sortedByConditionData = {};
            const currentConditionOrder = isFoilPage ? FOIL_CONDITION_ORDER : NON_FOIL_CONDITION_ORDER;
            for (const setName in processedData) {
                sortedByConditionData[setName] = [...processedData[setName]].sort((a, b) => {
                    return currentConditionOrder.indexOf(a.condition) - currentConditionOrder.indexOf(b.condition);
                });
            }
            return sortedByConditionData;
        }
    }
}

function renderCards(sortOption) {
    const cardColumns = document.querySelector('.card-columns');
    cardColumns.innerHTML = '';
    const isGrouped = isGroupedByRarity();
    const isFiltered = isFilteredByValue();
    const isFilteredNmCondition = isFilteredByNmCondition();

    const setsDataToRender = getSortedData(allSetsCardData, allSetsCardDataByName, allSetsCardDataByRarityPrice, allSetsCardDataByRarityName, sortOption, isGrouped, isFiltered, isFilteredNmCondition);
    
    for (const setName in setsDataToRender) {
        const cardColumn = document.createElement('div');
        cardColumn.className = 'card-column';

        const setCardsData = setsDataToRender[setName];
        const setIcon = SET_ICONS[setName] ? `<span class="set-icon">${SET_ICONS[setName]}</span>` : '';

        const cardSection = document.createElement('div');
        cardSection.className = 'card-section';
        cardColumn.appendChild(cardSection);

        if (isGrouped) {
            const sortedRarities = RARITIES.filter(rarity => setCardsData[rarity] && setCardsData[rarity].length > 0);
            cardSection.innerHTML = `<h2>${setIcon} ${setName}</h2><ul></ul>`;
            const ul = cardSection.querySelector('ul');

            if (sortedRarities.length === 0) {
                const noCardsMessage = document.createElement('li');
                noCardsMessage.textContent = 'No cards available for this set.';
                ul.appendChild(noCardsMessage);
            } else {
                sortedRarities.forEach(rarity => {
                    const rarityCards = setCardsData[rarity];
                    const subHeader = document.createElement('h3');
                    subHeader.className = 'rarity-subheader';
                    subHeader.textContent = `${setName} - ${rarity}`;
                    ul.appendChild(subHeader);

                    if (rarityCards.length === 0) {
                        const noRarityCardsMessage = document.createElement('li');
                        noRarityCardsMessage.textContent = 'No cards available for this rarity.';
                        ul.appendChild(noRarityCardsMessage);
                    } else {
                        if (!isFilteredNmCondition) {
                            const groupedByCondition = {};
                            const currentConditionOrder = isFoilPage ? FOIL_CONDITION_ORDER : NON_FOIL_CONDITION_ORDER;
                            currentConditionOrder.forEach(condition => {
                                groupedByCondition[condition] = rarityCards.filter(card => card.condition === condition);
                            });

                            currentConditionOrder.forEach(condition => {
                                const conditionCards = groupedByCondition[condition];
                                if (conditionCards && conditionCards.length > 0) {
                                    const conditionSubheader = document.createElement('div');
                                    conditionSubheader.className = 'condition-subheader';
                                    conditionSubheader.textContent = `Condition: ${condition}`;
                                    ul.appendChild(conditionSubheader);

                                    conditionCards.forEach(card => {
                                        const listItem = document.createElement('li');
                                        let cardHtml = '';
                                        const cardNameContent = `${card['name']} (${card['condition']})`;

                                        if (card['productID']) {
                                            const imageUrl = `https://tcgplayer-cdn.tcgplayer.com/product/${card['productID']}_in_1000x1000.jpg`;
                                            cardHtml = `
                                                <span class="card-name">
                                                    <a href="#" 
                                                       onmouseover="showImage(this, '${imageUrl}', isFoilPage);">
                                                        ${cardNameContent}
                                                    </a>
                                                </span>
                                                <span class="card-price">$${card['price']}</span>
                                            `;
                                        }
                                        else {
                                            cardHtml = `
                                                <span class="card-name">
                                                    <a href="#" 
                                                       onmouseover="showImage(this, '', isFoilPage);">
                                                        ${cardNameContent}
                                                    </a>
                                                </span>
                                                <span class="card-price">$${card['price']}</span>
                                            `;
                                        }
                                        listItem.innerHTML = cardHtml;
                                        const cardLink = listItem.querySelector('.card-name a');
                                        
                                        if (isMobileOrTablet()) {
                                            const imageUrlForClick = card['productID'] ? `https://tcgplayer-cdn.tcgplayer.com/product/${card['productID']}_in_1000x1000.jpg` : '';
                                            cardLink.onclick = (event) => {
                                                event.preventDefault();
                                                const modalOverlay = document.getElementById('mobile-image-modal');
                                            if (modalOverlay.style.display === 'flex') {
                                                hideModalImage();
                                                } else {
                                                showModalImage(imageUrlForClick, isFoilPage);
                                            }
                                        };
                                    }

                                    ul.appendChild(listItem);
                                });
                                }
                            });
                        } else { // if isFilteredNmCondition is true
                            rarityCards.forEach(card => {
                                const listItem = document.createElement('li');
                                let cardHtml = '';
                                const cardNameContent = `${card['name']} (${card['condition']})`;

                                if (card['productID']) {
                                    const imageUrl = `https://tcgplayer-cdn.tcgplayer.com/product/${card['productID']}_in_1000x1000.jpg`;
                                    cardHtml = `
                                        <span class="card-name">
                                            <a href="#" 
                                               onmouseover="showImage(this, '${imageUrl}', isFoilPage);">
                                                ${cardNameContent}
                                            </a>
                                        </span>
                                        <span class="card-price">$${card['price']}</span>
                                    `;
                                }
                                else {
                                    cardHtml = `
                                        <span class="card-name">
                                            <a href="#" 
                                               onmouseover="showImage(this, '', isFoilPage);">
                                                ${cardNameContent}
                                            </a>
                                        </span>
                                        <span class="card-price">$${card['price']}</span>
                                    `;
                                }
                                listItem.innerHTML = cardHtml;
                                const cardLink = listItem.querySelector('.card-name a');
                                
                                if (isMobileOrTablet()) {
                                    const imageUrlForClick = card['productID'] ? `https://tcgplayer-cdn.tcgplayer.com/product/${card['productID']}_in_1000x1000.jpg` : '';
                                    cardLink.onclick = (event) => {
                                        event.preventDefault();
                                        const modalOverlay = document.getElementById('mobile-image-modal');
                                    if (modalOverlay.style.display === 'flex') {
                                        hideModalImage();
                                        } else {
                                        showModalImage(imageUrlForClick, isFoilPage);
                                    }
                                };
                            }
                            ul.appendChild(listItem);
                        });
                        }
                    }
                });
            }
        } else { // Not grouped by rarity
            const sortedCards = setCardsData;
            cardSection.innerHTML = `<h2>${setIcon} ${setName}</h2><ul></ul>`;
            const ul = cardSection.querySelector('ul');
            if (sortedCards.length === 0) {
                const noCardsMessage = document.createElement('li');
                noCardsMessage.textContent = 'No cards available for this set.';
                ul.appendChild(noCardsMessage);
            } else {
                if (!isFilteredNmCondition) { // Only group by condition if NM filter is off
                    const groupedByCondition = {};
                    const currentConditionOrder = isFoilPage ? FOIL_CONDITION_ORDER : NON_FOIL_CONDITION_ORDER;
                    currentConditionOrder.forEach(condition => {
                        groupedByCondition[condition] = sortedCards.filter(card => card.condition === condition);
                    });

                    currentConditionOrder.forEach(condition => {
                        const conditionCards = groupedByCondition[condition];
                        if (conditionCards && conditionCards.length > 0) {
                            const conditionSubheader = document.createElement('div');
                            conditionSubheader.className = 'condition-subheader';
                            conditionSubheader.textContent = `Condition: ${condition}`;
                            ul.appendChild(conditionSubheader);

                            conditionCards.forEach(card => {
                                const listItem = document.createElement('li');
                                let cardHtml = '';
                                const cardNameContent = `${card['name']} (${card['condition']})`;

                                if (card['productID']) {
                                    const imageUrl = `https://tcgplayer-cdn.tcgplayer.com/product/${card['productID']}_in_1000x1000.jpg`;
                                    cardHtml = `
                                        <span class="card-name">
                                            <a href="#" 
                                               onmouseover="showImage(this, '${imageUrl}', isFoilPage);">
                                                ${cardNameContent}
                                            </a>
                                        </span>
                                        <span class="card-price">$${card['price']}</span>
                                    `;
                                } else {
                                    cardHtml = `
                                        <span class="card-name">
                                            <a href="#" 
                                               onmouseover="showImage(this, '', isFoilPage);">
                                                ${cardNameContent}
                                            </a>
                                        </span>
                                        <span class="card-price">$${card['price']}</span>
                                    `;
                                }
                                listItem.innerHTML = cardHtml;
                                const cardLink = listItem.querySelector('.card-name a');
                                
                                if (isMobileOrTablet()) {
                                    const imageUrlForClick = card['productID'] ? `https://tcgplayer-cdn.tcgplayer.com/product/${card['productID']}_in_1000x1000.jpg` : '';
                                    cardLink.onclick = (event) => {
                                        event.preventDefault();
                                        const modalOverlay = document.getElementById('mobile-image-modal');
                                    if (modalOverlay.style.display === 'flex') {
                                        hideModalImage();
                                        } else {
                                        showModalImage(imageUrlForClick, isFoilPage);
                                    }
                                };
                            }

                            ul.appendChild(listItem);
                        });
                        }
                    });
                } else {
                    // If isFilteredNmCondition is true, simply display the filtered cards without condition subheaders
                    sortedCards.forEach(card => {
                        const listItem = document.createElement('li');
                        let cardHtml = '';
                        const cardNameContent = `${card['name']} (${card['condition']})`;

                        if (card['productID']) {
                            const imageUrl = `https://tcgplayer-cdn.tcgplayer.com/product/${card['productID']}_in_1000x1000.jpg`;
                            cardHtml = `
                                <span class="card-name">
                                    <a href="#" 
                                       onmouseover="showImage(this, '${imageUrl}', isFoilPage);">
                                        ${cardNameContent}
                                    </a>
                                </span>
                                <span class="card-price">$${card['price']}</span>
                            `;
                        } else {
                            cardHtml = `
                                <span class="card-name">
                                    <a href="#" 
                                       onmouseover="showImage(this, '', isFoilPage);">
                                        ${cardNameContent}
                                    </a>
                                </span>
                                <span class="card-price">$${card['price']}</span>
                            `;
                        }
                        listItem.innerHTML = cardHtml;
                        const cardLink = listItem.querySelector('.card-name a');
                        
                        if (isMobileOrTablet()) {
                            const imageUrlForClick = card['productID'] ? `https://tcgplayer-cdn.tcgplayer.com/product/${card['productID']}_in_1000x1000.jpg` : '';
                            cardLink.onclick = (event) => {
                                event.preventDefault();
                                const modalOverlay = document.getElementById('mobile-image-modal');
                            if (modalOverlay.style.display === 'flex') {
                                hideModalImage();
                                } else {
                                showModalImage(imageUrlForClick, isFoilPage);
                            }
                        };
                    }
                    ul.appendChild(listItem);
                });
                }
            }
        }
        cardColumns.appendChild(cardColumn);
    }
}

function navigateToSort() {
    const sortOption = getSortOption();
    const url = new URL(window.location);
    url.searchParams.set('sort', sortOption);
    url.searchParams.set('groupRarity', isGroupedByRarity());
    url.searchParams.set('filterValue', isFilteredByValue());
    url.searchParams.set('filterNmCondition', isFilteredByNmCondition());
    window.history.pushState({}, '', url);
    renderCards(sortOption);
}

function isGroupedByRarity() {
    const checkbox = document.getElementById('group-by-rarity');
    return checkbox ? checkbox.checked : false;
}

function handleRarityGroupChange() {
    navigateToSort();
}

function isFilteredByValue() {
    const checkbox = document.getElementById('filter-by-value');
    return checkbox ? checkbox.checked : false;
}

function handleValueFilterChange() {
    navigateToSort();
}

function isFilteredByNmCondition() {
    const checkbox = document.getElementById('filter-by-nm-condition');
    return checkbox ? checkbox.checked : false;
}

function handleNmConditionFilterChange() {
    navigateToSort();
}


document.addEventListener('DOMContentLoaded', () => {
    const modalCloseButton = document.getElementById('modal-close');
    if (modalCloseButton) {
        modalCloseButton.addEventListener('click', hideModalImage);
    }

    document.body.addEventListener('mouseout', (event) => {
        const hoverImageDiv = document.getElementById('hover-image-display');
        if (hoverImageDiv && !hoverImageDiv.contains(event.relatedTarget)) {
            hideImage();
        }
    });
});

async function loadAndRenderCards() {
    try {
        const response = await fetch('card-data/card_data.json');
        const data = await response.json();

        const urlParams = new URLSearchParams(window.location.search);
        const viewParam = urlParams.get('view');
        isFoilPage = viewParam === 'foil';

        const pageTitleElement = document.querySelector('h1');
        if (pageTitleElement) {
            pageTitleElement.textContent = isFoilPage ? "Sorcery Foil Card Prices Overview" : "Sorcery Non-Foil Card Prices Overview";
        }

        document.title = isFoilPage ? "Sorcery Foil Card Prices Overview" : "Sorcery Non-Foil Card Prices Overview";

        const nonFoilLink = document.querySelector('a[href*="view=nonfoil"]');
        const foilLink = document.querySelector('a[href*="view=foil"]');

        if (nonFoilLink) {
            nonFoilLink.classList.toggle('active', isFoilPage);
        }
        if (foilLink) {
            foilLink.classList.toggle('active', !isFoilPage);
        }

        for (const setName in data) {
            allSetsCardData[setName] = isFoilPage ? data[setName].foil : data[setName].nonFoil;
            allSetsCardDataByName[setName] = isFoilPage ? data[setName].foilByName : data[setName].nonFoilByName;
            allSetsCardDataByRarityPrice[setName] = isFoilPage ? data[setName].foilByRarityPrice : data[setName].nonFoilByRarityPrice;
            allSetsCardDataByRarityName[setName] = isFoilPage ? data[setName].foilByRarityName : data[setName].nonFoilByRarityName;
        }

        const sortParam = urlParams.get('sort');
        const groupRarityParam = urlParams.get('groupRarity');
        const filterValueParam = urlParams.get('filterValue');
        const filterNmConditionParam = urlParams.get('filterNmCondition');

        if (groupRarityParam === 'true') {
            document.getElementById('group-by-rarity').checked = true;
        } else if (groupRarityParam === null) {
            document.getElementById('group-by-rarity').checked = true;
        }else {
            document.getElementById('group-by-rarity').checked = false;
        }

        if (filterValueParam === 'true') {
            document.getElementById('filter-by-value').checked = true;
        } else if (filterValueParam === null) {
            document.getElementById('filter-by-value').checked = true;
        } else {
            document.getElementById('filter-by-value').checked = false;
        }

        if (filterNmConditionParam === 'true') {
            document.getElementById('filter-by-nm-condition').checked = true;
        } else if (filterNmConditionParam === null) {
            document.getElementById('filter-by-nm-condition').checked = true;
        } else {
            document.getElementById('filter-by-nm-condition').checked = false;
        }

        if (sortParam) {
            document.getElementById('sort-select').value = sortParam;
            renderCards(sortParam);
        } else {
            renderCards(getSortOption());
        }
    } catch (error) {
        console.error('Error loading card data:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadAndRenderCards);
