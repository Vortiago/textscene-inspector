/** Which diagnostic names no registered rule declares, for a test that sorts diagnostics by owner. */

import { FILE_DIAGNOSTICS, STRICT_PARSER_RULE_NAME, formatRuleName } from '../fileDiagnostics.js';

/** The prefix every `format:<key>` name starts with. */
const FORMAT_RULE_PREFIX = formatRuleName('');

/** True for a name a format check reports: `strict-parser`, or a validator's `format:<key>`. */
export function isFormatCheckName(ruleName: string): boolean {
  return ruleName === STRICT_PARSER_RULE_NAME || ruleName.startsWith(FORMAT_RULE_PREFIX);
}

const FILE_DIAGNOSTIC_NAMES: ReadonlySet<string> = new Set(
  Object.values(FILE_DIAGNOSTICS).map((d) => d.ruleName)
);

/** True for a `ruleName` `Linter` stamps that no registered rule declares. */
export function isUndeclaredRuleName(ruleName: string): boolean {
  return FILE_DIAGNOSTIC_NAMES.has(ruleName) || isFormatCheckName(ruleName);
}
