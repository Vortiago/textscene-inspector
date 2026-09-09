/**
 * The names a file actually REPORTS, as opposed to the names it merely spells.
 *
 * `emitsScrape.ts` reads every `ruleName` literal in a file, which is what the
 * declared-vs-emitted cross-check needs — but it makes a plain lookup table
 * vouch for a diagnostic no code pushes. Measured: deleting the whole reporting
 * loop in `pointlight2d/linter.ts` left every emits guard green, because both
 * names are still spelled in the DATA table the loop reads.
 *
 * A report site is the argument list of a `push`/`report` call. A name reaches
 * one either as a literal, or through the loop variable of a `for (const x of
 * TABLE)` — the table-driven shape, where the reportable set is the table's own
 * column.
 *
 * This module holds no `ruleName: '…'` literal of its own: it is inside the
 * population its callers scrape.
 */

import { readFileSync } from 'node:fs';
import { stripComments } from '@textscene/dev-kit';
import { balancedGroup } from './emitsReach.js';

const REPORT_CALL = /\b(?:diagnostics\.push|push|report|reportArm|armDiagnostic)\s*\(/g;
const NAME_LITERAL = /ruleName:\s*(?:'([^']+)'|`([^`]+)`)/g;
/** `ruleName: window.ruleName` — the loop variable and the column it reads. */
const NAME_MEMBER = /ruleName:\s*([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g;
/** `for (const window of WINDOWS)` — the binding a member expression resolves through. */
const FOR_OF = /for\s*\(\s*const\s+([A-Za-z_$][\w$]*)\s+of\s+([A-Za-z_$][\w$]*)\s*\)/g;

/** `${…}` stands for any prefix, exactly as the scrape normalises it. */
const normalize = (name: string) => name.replace(/\$\{[^}]+\}/g, '*');

/** The literal values of `column` in the array literal bound to `table`. */
function columnValues(src: string, table: string, column: string): string[] {
  const declaration = new RegExp(
    String.raw`const\s+${table}\s*(?::[^=]*?)?=\s*\[`
  ).exec(src);
  if (!declaration) return [];
  const open = declaration.index + declaration[0].length - 1;
  const body = balancedGroup(src, open);
  const re = new RegExp(String.raw`${column}:\s*(?:'([^']+)'|\`([^\`]+)\`)`, 'g');
  return [...body.matchAll(re)].map((m) => normalize(m[1] ?? m[2]!));
}

/** The object literal `at` sits inside, braces included. */
function enclosingObject(src: string, at: number): string {
  let depth = 0;
  let open = at;
  while (open > 0) {
    const c = src[open];
    if (c === '}') depth++;
    else if (c === '{') {
      if (depth === 0) break;
      depth--;
    }
    open--;
  }
  return balancedGroup(src, open);
}

/**
 * Names spelled in DATA position: a `ruleName` column in a lookup table, rather
 * than a diagnostic literal (which carries `message`) or an arm (which carries
 * `grounding`). Those two shapes are held to their report sites elsewhere — by
 * the declared-vs-emitted pair and by `ruleArms.test.ts` respectively — while a
 * lookup column was held to nothing at all.
 */
export function dataOnlyNames(file: string): Set<string> {
  const src = stripComments(readFileSync(file, 'utf8'));
  const names = new Set<string>();
  for (const m of src.matchAll(NAME_LITERAL)) {
    const body = enclosingObject(src, m.index);
    if (body.includes('message:') || body.includes('grounding')) continue;
    names.add(normalize(m[1] ?? m[2]!));
  }
  return names;
}

const cache = new Map<string, Set<string>>();

/** Every rule name `file` can push, from its report sites alone. */
export function reportedNames(file: string): Set<string> {
  const cached = cache.get(file);
  if (cached) return cached;
  const src = stripComments(readFileSync(file, 'utf8'));

  const loopTables = new Map<string, string>();
  for (const m of src.matchAll(FOR_OF)) loopTables.set(m[1]!, m[2]!);

  const names = new Set<string>();
  for (const call of src.matchAll(REPORT_CALL)) {
    const args = balancedGroup(src, call.index + call[0].length - 1);
    for (const m of args.matchAll(NAME_LITERAL)) names.add(normalize(m[1] ?? m[2]!));
    for (const m of args.matchAll(NAME_MEMBER)) {
      const table = loopTables.get(m[1]!);
      if (table === undefined) continue;
      for (const value of columnValues(src, table, m[2]!)) names.add(value);
    }
  }
  cache.set(file, names);
  return names;
}
