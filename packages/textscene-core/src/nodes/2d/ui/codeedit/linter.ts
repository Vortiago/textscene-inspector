/**
 * Semantic linter rule for CodeEdit.
 *
 * Format validation is handled by linterParser.ts, which validates
 * `delimiter_strings` and `delimiter_comments` each in isolation, including a
 * start-key repeated WITHIN one of those two properties. What it cannot see is
 * a start key repeated ACROSS the two: `CodeEdit::_set_delimiters`
 * (code_edit.cpp:3490-3508) stores BOTH string and comment delimiters in one
 * shared `delimiters` Vector (`Vector<Delimiter> delimiters;`, code_edit.h),
 * and `_add_delimiter`'s "already exists" guard
 * (`ERR_FAIL_COND_MSG(delimiters[i].start_key == p_start_key, …)`,
 * code_edit.cpp:3436) checks every entry already in that Vector regardless of
 * its `DelimiterType` — so a comment delimiter and a string delimiter sharing
 * a start key collide exactly as two string delimiters would.
 *
 * `_set_delimiters` clears only ITS OWN type before re-adding
 * (`_clear_delimiters(p_type)`, code_edit.cpp:3492), so whichever
 * `delimiter_*` property Godot applies SECOND finds the other type's entries
 * still in the Vector; the colliding start key it tries to add hits the
 * ERR_FAIL_COND_MSG and is silently dropped — the "silently dropped write"
 * case ADR-0032 grounds a diagnostic on. Property application order is not
 * something this linter can observe (it depends on Godot's own iteration of
 * the deserialized property list), so the message names the risk rather than
 * asserting which property wins.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { arrayBody, STRING_ARRAY_FORMS } from './arrayForms.js';
import { unquoteString } from '../../../../parser/utils.js';

const QUOTED_ELEMENT_CAPTURE_RE = /"((?:[^"\\]|\\[\s\S])*)"/g;

/**
 * The start key of each non-empty element of a `delimiter_strings` /
 * `delimiter_comments` literal, mirroring the same split linterParser.ts uses
 * (`CodeEdit::_set_delimiters`, code_edit.cpp:3501-3502). Returns an empty set
 * for a value this rule cannot parse — linterParser.ts's own validator is
 * what reports a malformed literal; this rule only reasons about start keys
 * it could actually extract.
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
