/**
 * The statements of a test block that assert by hand that no diagnostic of one
 * tier and one identity exists, read from its body. A statement runs to its `;`.
 */

import { SEVERITY_ORDER, type Severity } from '../types.js';

/**
 * The tier names, spelled for a regex and read off the shared roster, so a new
 * tier reaches the narrowing below.
 */
const TIER_NAMES = (Object.keys(SEVERITY_ORDER) as Severity[]).join('|');

/**
 * A narrowing to one tier: a predicate, `d.severity === 'error'`, or a
 * `tierLists.ts` helper, `errorsOf(…)`.
 */
const TIER_NARROWING_RE = new RegExp(
  `severity\\s*===\\s*'(?:${TIER_NAMES})'|\\b(?:${TIER_NAMES})sOf\\(`,
  'g'
);

/** A predicate narrowing to one diagnostic: by its message or its rule name. */
const IDENTITY_RE = /\.message\.includes\(|\.ruleName\s*===/;

/** The searches such a predicate sits in. */
const SEARCH_RE = /\.(?:some|filter|find)\(/;

/** An assertion that its subject is empty. */
const EMPTY_RE = /\.(?:toEqual|toStrictEqual)\(\s*\[\s*\]\s*\)|\.toHaveLength\(\s*0\s*\)/;

/** An assertion that a search found nothing: an empty list, `false` or `undefined`. */
const FOUND_NOTHING_RE = new RegExp(
  `${EMPTY_RE.source}|\\.toBe\\(\\s*false\\s*\\)|\\.toBeUndefined\\(\\s*\\)`
);

/** Where the statement holding `index` starts. */
const statementStart = (body: string, index: number): number => body.lastIndexOf(';', index) + 1;

/** The statement holding `index`. */
function statementAt(body: string, index: number): string {
  const end = body.indexOf(';', index);
  return body.slice(statementStart(body, index), end < 0 ? body.length : end);
}

/** The name a value is bound to, when `const <name> =` or `let <name> =` opens its statement. */
function boundNameAt(body: string, index: number): string | null {
  const head = body.slice(statementStart(body, index), index);
  const bindings = [...head.matchAll(/\b(?:const|let)\s+(\w+)\s*=/g)];
  return bindings.at(-1)?.[1] ?? null;
}

/** Whether one statement of `body` matches both `subject` and `matcher`. */
const assertsOn = (body: string, subject: RegExp, matcher: RegExp): boolean =>
  body.split(';').some((statement) => subject.test(statement) && matcher.test(statement));

/** An `expect` whose subject is `name` itself, not a read of it. */
const expectOf = (name: string): RegExp => new RegExp(`\\bexpect\\(\\s*${name}\\s*[,)]`);

/** Whether `body` asserts that the search at `index` in `statement` finds nothing. */
function isFoundNothing(body: string, index: number, statement: string): boolean {
  if (FOUND_NOTHING_RE.test(statement)) return true;
  const name = boundNameAt(body, index);
  return name !== null && assertsOn(body, expectOf(name), FOUND_NOTHING_RE);
}

/**
 * The statements of `body` that assert by hand that no diagnostic of one tier and one
 * identity exists. Each is a `some`, `filter` or `find` narrowed by both and found empty,
 * and it cannot fail once that tier moves.
 */
export function tierNarrowedNegatives(body: string): string[] {
  const offenders = new Set<string>();
  for (const m of body.matchAll(TIER_NARROWING_RE)) {
    const statement = statementAt(body, m.index);
    const isNarrowedSearch = SEARCH_RE.test(statement) && IDENTITY_RE.test(statement);
    if (isNarrowedSearch && isFoundNothing(body, m.index, statement)) offenders.add(statement);
  }
  return [...offenders];
}
