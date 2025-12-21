/**
 * Sorcery: Contested Realm Trade Calculator
 * 
 * Game-specific wrapper that extends TradeCalculatorCore with
 * Sorcery TCG configuration.
 */
import { TradeCalculatorCore } from '/core/frontend/components/TradeCalculatorCore.js';

export const TradeCalculator = {
  components: {
    TradeCalculatorCore
  },
  props: {
    gameConfig: {
      type: Object,
      default: () => ({})
    }
  },
  template: `
    <TradeCalculatorCore 
      :gameConfig="gameConfig"
    />
  `
}

