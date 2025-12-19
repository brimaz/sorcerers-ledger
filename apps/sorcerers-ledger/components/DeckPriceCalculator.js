/**
 * Sorcery: Contested Realm Deck Price Calculator
 * 
 * Game-specific wrapper that extends DeckPriceCalculatorCore with
 * Sorcery TCG Format 1 configuration (section headers: Avatar, Aura, etc.)
 */
import { DeckPriceCalculatorCore } from '/core/frontend/components/DeckPriceCalculatorCore.js';
import * as gameConfigModule from '/apps/sorcerers-ledger/config/frontendConfig.js';

export const DeckPriceCalculator = {
  components: {
    DeckPriceCalculatorCore
  },
  props: {
    gameConfig: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    format1Config() {
      // Return Sorcery-specific Format 1 configuration
      return gameConfigModule.DECK_FORMAT1_CONFIG || null;
    }
  },
  template: `
    <DeckPriceCalculatorCore 
      :gameConfig="gameConfig"
      :format1Config="format1Config"
    />
  `
}

