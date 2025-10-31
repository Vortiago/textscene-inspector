/**
 * ESLint-style linter types for TSCN validation
 */

import type { TscnScene, TscnNode } from '../parser/types';

/**
 * Diagnostic severity levels
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * A diagnostic message reporting an issue
 */
export interface Diagnostic {
  /** Severity level of the diagnostic */
  severity: Severity;
  /** Human-readable diagnostic message */
  message: string;
  /** Name of the node where the issue was found */
  nodeName: string;
  /** Type of the node where the issue was found */
  nodeType: string;
  /** Name of the rule that generated this diagnostic */
  ruleName: string;
  /** Optional source location information */
  location?: {
    /** Line number in source file (if available) */
    line?: number;
    /** Column number in source file (if available) */
    column?: number;
  };
}

/**
 * Parse error from strict parser (syntax/format issues)
 */
export interface ParseError {
  /** Severity level (always 'error' for parse errors) */
  severity: 'error';
  /** Human-readable error message */
  message: string;
  /** Line number where error occurred */
  line: number;
  /** Column number where error occurred */
  column: number;
  /** Machine-readable error code */
  code: string;
}

/**
 * Result from strict parser
 */
export interface StrictParseResult {
  /** Parse errors found during strict parsing */
  errors: ParseError[];
  /** Parsed scene (only present if no errors) */
  scene?: TscnScene;
}

/**
 * Context provided to lint rules during execution
 */
export interface RuleContext {
  /** The complete parsed scene */
  scene: TscnScene;
  /** The current node being validated */
  node: TscnNode;
  /** Convenience access to node properties (typed as unknown for flexibility) */
  properties: unknown;
}

/**
 * Rule metadata
 */
export interface RuleMeta {
  /** Unique rule name (e.g., "no-missing-resource", "valid-property-values") */
  name: string;
  /** Human-readable description of what the rule checks */
  description: string;
  /** Rule category for organization */
  category: 'validation' | 'performance' | 'best-practice';
  /** Node types this rule applies to (empty = all nodes) */
  applicableNodeTypes?: string[];
}

/**
 * A lint rule that validates TSCN nodes
 */
export interface LintRule {
  /** Rule metadata */
  meta: RuleMeta;
  /**
   * Check function that validates a node and returns diagnostics
   * @param context - The rule execution context
   * @returns Array of diagnostics (empty if no issues found)
   */
  check: (context: RuleContext) => Diagnostic[];
}
