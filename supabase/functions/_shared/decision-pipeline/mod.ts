/**
 * Decision Pipeline — Module Index
 *
 * Architecture: INPUT → DECISION ENGINE → FINANCIAL FILTER → SAFETY LAYER → OUTPUT
 *
 * Import from here:
 *   import { enrichDecision, runShadowPipeline, ... } from '../_shared/decision-pipeline/mod.ts';
 */

// Types
export type {
  RawDecision,
  FinancialConfig,
  SafetyConfig,
  FinancialResult,
  FinancialVerdict,
  SafetyResult,
  SafetyStatus,
  EnrichedDecision,
  RiskLevel,
  ActionLogEntry,
} from './types.ts';

// Financial filter
export { evaluateFinancial } from './financial-filter.ts';

// Safety layer
export { evaluateSafety, checkPendingRollbacks } from './safety-layer.ts';

// Decision output (orchestrator)
export { enrichDecision, toActionLogEntry } from './decision-output.ts';

// Shadow mode
export {
  runShadowPipeline,
  getEngineVersion,
  loadAccountConfig,
  compareShadowVsProduction,
} from './shadow-mode.ts';
export type { AlertInput, ShadowComparison } from './shadow-mode.ts';
