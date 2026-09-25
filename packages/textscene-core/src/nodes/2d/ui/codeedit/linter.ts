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
import { parsePackedStringArray } from './arrayForms.js';
import { passesDelimiterGuards, splitDelimiterEntry } from './delimiterEntry.js';

/**
 * The start key of each element `_add_delimiter` would store, split as `_set_delimiters` does. An
 * empty set for a literal the reader refuses, which the validator reports as malformed, and no key
 * from an element the engine's guards drop: neither reaches the shared `delimiters` Vector.
 */
function startKeysOf(raw: string | undefined): Set<string> {
  const keys = new Set<string>();
  const elements = raw === undefined ? null : parsePackedStringArray(raw);
  for (const element of elements ?? []) {
    // `_set_delimiters` skips an empty element (code_edit.cpp:3497-3499).
    if (element === '') continue;
    const entry = splitDelimiterEntry(element);
    if (passesDelimiterGuards(entry)) keys.add(entry.startKey);
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
