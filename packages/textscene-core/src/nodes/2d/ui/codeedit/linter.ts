/**
 * CodeEdit's delimiter-collision rule. `_set_delimiters` (code_edit.cpp:3490-3508) stores string and
 * comment delimiters in one `delimiters` Vector (code_edit.h), and `_add_delimiter`'s "already exists"
 * guard (code_edit.cpp:3436) checks entries of either type, so a start key shared across the two
 * properties collides. linterParser.ts catches a repeat within one property.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { arrayBody, STRING_ARRAY_FORMS } from './arrayForms.js';
import { unquoteString } from '../../../../parser/utils.js';

const QUOTED_ELEMENT_CAPTURE_RE = /"((?:[^"\\]|\\[\s\S])*)"/g;

/**
 * The start key of each non-empty element of a delimiter literal, split as `_set_delimiters` does
 * (code_edit.cpp:3501-3502). An empty set for a value this rule cannot parse: linterParser.ts's
 * validator reports a malformed literal.
 */
function startKeysOf(raw: string | undefined): Set<string> {
  const keys = new Set<string>();
  if (raw === undefined) return keys;
  const body = arrayBody(raw, STRING_ARRAY_FORMS);
  if (body === undefined || body === '') return keys;
  for (const m of body.matchAll(QUOTED_ELEMENT_CAPTURE_RE)) {
    const element = unquoteString(m[1] ?? '');
    if (element === '') continue;
    const firstSpace = element.indexOf(' ');
    const startKey = firstSpace === -1 ? element : element.slice(0, firstSpace);
    if (startKey !== '') keys.add(startKey);
  }
  return keys;
}

function checkCodeEdit(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;
  if (!isValidProperties(node.properties)) return diagnostics;
  const rawProps = node.properties as Record<string, string>;

  const stringKeys = startKeysOf(rawProps.delimiter_strings);
  const commentKeys = startKeysOf(rawProps.delimiter_comments);
  if (stringKeys.size === 0 || commentKeys.size === 0) return diagnostics;

  const shared = [...stringKeys].filter((key) => commentKeys.has(key)).sort();
  if (shared.length === 0) return diagnostics;

  // `_set_delimiters` clears only its own type (code_edit.cpp:3492), so the property applied second
  // silently drops its colliding key (ADR-0032). The order is not observable here, so the message
  // names the risk rather than the winner.
  diagnostics.push({
    severity: 'error',
    message:
      `CodeEdit delimiter_strings and delimiter_comments both declare the start key(s) ${shared.map((k) => `"${k}"`).join(', ')}. ` +
      'CodeEdit::_set_delimiters stores both in one shared delimiters Vector (code_edit.cpp:3490-3508), and ' +
      '_add_delimiter refuses a start key already in that Vector regardless of delimiter type ' +
      '(code_edit.cpp:3436), so whichever of the two properties Godot applies second silently drops its ' +
      'colliding entry on load.',
    nodeName: node.name,
    nodeType: node.type,
    ruleName: 'codeedit-delimiter-start-key-collision',
  });

  return diagnostics;
}

const codeEditDelimiterCollisionRule: LintRule = {
  meta: {
    name: 'valid-codeedit-properties',
    description:
      "Validates CodeEdit's delimiter_strings and delimiter_comments do not share a start key",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'CodeEdit'),
    emits: [
      {
        ruleName: 'codeedit-delimiter-start-key-collision',
        severity: 'error',
        grounding: { kind: 'engine', at: 'code_edit.cpp:3436' },
      },
    ],
  },
  check: checkCodeEdit,
};

ruleRegistry.register(codeEditDelimiterCollisionRule);

export { codeEditDelimiterCollisionRule };
