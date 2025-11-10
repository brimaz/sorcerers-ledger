import { CardItem } from './CardItem.js';

export const CardDisplay = {
  props: [
    'setsDataToRender',
    'RARITIES',
    'SET_ICONS',
    'isFoilPage',
    'isFilteredNmCondition',
    'filterPriceChangeStatus',
    'NON_FOIL_CONDITION_ORDER',
    'FOIL_CONDITION_ORDER',
    'allOldSetsCardData',
    'isGrouped',
    'showHoverImage',
    'hideHoverImage',
    'showMobileModal',
  ],
  template: `
    <div class="card-columns">
      <div v-for="(setCardsData, setName) in setsDataToRender" :key="setName" class="card-column">
        <div class="card-section">
          <h2>
            <span v-if="SET_ICONS[setName]" class="set-icon">{{ SET_ICONS[setName] }}</span>
            {{ setName }}
          </h2>
          <ul v-if="setCardsData">
            <template v-if="isGrouped">
              <template v-for="rarity in sortedRarities(setCardsData)">
                <h3 class="rarity-subheader">{{ setName }} - {{ rarity }}</h3>
                <template v-if="setCardsData[rarity] && setCardsData[rarity].length > 0">
                  <template v-if="!isFilteredNmCondition">
                    <template v-for="condition in currentConditionOrder">
                      <template v-if="groupedCardsByCondition(setCardsData[rarity], condition).length > 0">
                        <div class="condition-subheader">Condition: {{ condition }}</div>
                        <CardItem
                          v-for="card in groupedCardsByCondition(setCardsData[rarity], condition)"
                          :key="card.name + card.condition"
                          :card="card"
                          :setName="setName"
                          :isFoilPage="isFoilPage"
                          :filterPriceChangeStatus="filterPriceChangeStatus"
                          :allOldSetsCardData="allOldSetsCardData"
                          :isGrouped="isGrouped"
                          :showHoverImage="showHoverImage"
                          :hideHoverImage="hideHoverImage"
                          :showMobileModal="showMobileModal"
                        />
                      </template>
                    </template>
                  </template>
                  <template v-else>
                    <CardItem
                      v-for="card in setCardsData[rarity]"
                      :key="card.name + card.condition"
                      :card="card"
                      :setName="setName"
                      :isFoilPage="isFoilPage"
                      :filterPriceChangeStatus="filterPriceChangeStatus"
                      :allOldSetsCardData="allOldSetsCardData"
                      :isGrouped="isGrouped"
                      :showHoverImage="showHoverImage"
                      :hideHoverImage="hideHoverImage"
                      :showMobileModal="showMobileModal"
                    />
                  </template>
                </template>
                <li v-else>No cards available for this rarity.</li>
              </template>
            </template>
            <template v-else>
              <template v-if="!isFilteredNmCondition">
                <template v-for="condition in currentConditionOrder">
                  <template v-if="groupedCardsByCondition(setCardsData, condition).length > 0">
                    <div class="condition-subheader">Condition: {{ condition }}</div>
                    <CardItem
                      v-for="card in groupedCardsByCondition(setCardsData, condition)"
                      :key="card.name + card.condition"
                      :card="card"
                      :setName="setName"
                      :isFoilPage="isFoilPage"
                      :filterPriceChangeStatus="filterPriceChangeStatus"
                      :allOldSetsCardData="allOldSetsCardData"
                      :isGrouped="isGrouped"
                      :showHoverImage="showHoverImage"
                      :hideHoverImage="hideHoverImage"
                      :showMobileModal="showMobileModal"
                    />
                  </template>
                </template>
              </template>
              <template v-else>
                <CardItem
                  v-for="card in setCardsData"
                  :key="card.name + card.condition"
                  :card="card"
                  :setName="setName"
                  :isFoilPage="isFoilPage"
                  :filterPriceChangeStatus="filterPriceChangeStatus"
                  :allOldSetsCardData="allOldSetsCardData"
                  :isGrouped="isGrouped"
                  :showHoverImage="showHoverImage"
                  :hideHoverImage="hideHoverImage"
                  :showMobileModal="showMobileModal"
                />
              </template>
            </template>
          </ul>
          <ul v-else>
            <li>No cards available for this set.</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  components: {
    CardItem,
  },
  computed: {
    currentConditionOrder() {
      return this.isFoilPage ? this.FOIL_CONDITION_ORDER : this.NON_FOIL_CONDITION_ORDER;
    },
  },
  methods: {
    sortedRarities(setCardsData) {
      return this.RARITIES.filter(rarity => setCardsData[rarity] && setCardsData[rarity].length > 0);
    },
    groupedCardsByCondition(cards, condition) {
      return cards.filter(card => card.condition === condition);
    },
  },
};
