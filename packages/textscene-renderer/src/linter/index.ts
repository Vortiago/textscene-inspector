/**
 * Linter entry point - imports all lint rules and validators to trigger registration
 */

// Import all linter parsers to trigger validator registration
import '../nodes/meshinstance3d/linterParser.js';

// Import all linter rules to trigger self-registration
import '../nodes/meshinstance3d/linter.js';

// Re-export core linter classes
export { Linter } from './Linter.js';
export { StrictTscnParser } from './StrictTscnParser.js';
export { validatorRegistry } from './ValidatorRegistry.js';
export { ruleRegistry } from './RuleRegistry.js';

// Re-export types
export type {
  Diagnostic,
  Severity,
  LintRule,
  RuleContext,
  RuleMeta,
  ParseError,
  StrictParseResult,
} from './types.js';
export type { PropertyValidator } from './ValidatorRegistry.js';
