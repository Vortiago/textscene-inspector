/**
 * Which diagnostic tiers a test block asserts, and which negatives it narrows to
 * a tier by hand, read from its body. A claim runs from an anchor to the end of
 * its statement, and the scan skips an ambiguous claim rather than guess.
 */

import { SEVERITY_ORDER, type Severity } from '../types.js';
import { afterBalanced } from './testBlocks.js';

/**
 * The tier names, spelled for a regex and read off the shared roster, so a new
 * tier reaches every matcher below and not only the table tsc checks.
 */
const SEVERITIES = Object.keys(SEVERITY_ORDER) as Severity[];
const TIER_NAMES = SEVERITIES.join('|');
const TIER_NAMES_CAPITALISED = SEVERITIES.map((t) => t[0]!.toUpperCase() + t.slice(1)).join('|');

/**
 * Where a tier claim starts: `severity`, `severities` (unbounded, for `severitiesOf(…)`),
 * `expectSeverity`, `expectRejected` and a `.tiers` read. The two helpers need their own
 * alternative, since `\b` fails before an inner capital, and `tiers` needs the dot, since
 * titles use the word too.
 */
const TIER_ANCHOR_RE = /\b(?:severit(?:y|ies)|expect(?:Severity|Rejected))|(?<=\.)tiers\b/g;

/**
 * A tier claimed by the assertion helper's own name, such as `expectError(…)` in
 * `testing/validatorCheck.ts`, which the anchor above cannot reach. Total over
 * `Severity`, so a new helper lands inside the sweep.
 */
const TIER_HELPER_RE = new RegExp(`\\bexpect(${TIER_NAMES_CAPITALISED})\\s*\\(`, 'g');

/**
 * A `tierLists.ts` helper, which carries its tier in its name (`errorsOf(…)`,
 * `warningsOf(…)`) or as its last argument (`reportsOf(…, 'warning')`). Neither
 * anchor above reaches one.
 */
const TIER_LIST_RE = new RegExp(`\\b(?:(${TIER_NAMES})sOf|reportsOf)\\s*\\(`, 'g');
const LAST_ARGUMENT_TIER_RE = new RegExp(`'(${TIER_NAMES})'\\s*\\)$`);

/** The tier literal ending the call that opens at `callOpen`, or null when it ends in none. */
function lastArgumentTier(body: string, callOpen: number): string | null {
  const close = afterBalanced(body, callOpen);
  if (close < 0) return null;
  return LAST_ARGUMENT_TIER_RE.exec(body.slice(callOpen, close))?.[1] ?? null;
}

/**
 * An assertion that a list is non-empty, which a list helper needs to count as a claim.
 * `const errors = errorsOf(x);` alone claims nothing, and `toHaveLength(0)` asserts the
 * tier is absent.
 */
const NON_EMPTY_RE = /toHaveLength\(\s*[1-9]|toBeGreaterThan\(\s*0|length\)\.toBe\(\s*[1-9]|\[0\]/;

/** A tier named as a literal. */
const TIER_LITERAL_RE = new RegExp(`'(${TIER_NAMES})'`, 'g');

/**
 * How far one claim reaches: its own statement, and never past this. A claim
 * with no `;` in reach is read to the cap rather than to the file's end.
 */
const CLAIM_REACH = 240;

/**
 * A tier named to be excluded is not a tier asserted: `filter(d => d.severity !== 'error')`
 * and `.not.toBe('info')` both spell one. The scan skips a claim this matches, except where
 * `emptiedExclusion` reads it, rather than fabricate a tier.
 */
const EXCLUDES_RE = /(?:!==?|\.not\b)/;

/**
 * The anchored value itself compared unequal to a tier: `severity !== 'error'`,
 * `tiers![end] !== 'error'`. A `!==` elsewhere in the claim excludes something else.
 */
const EXCLUSION_RE = new RegExp(`^\\w+(?:[!?]?(?:\\.\\w+|\\[\\w+\\]))*\\s*!==?\\s*'(${TIER_NAMES})'`);

/** An assertion that its subject is empty. */
const EMPTY_RE = /\.(?:toEqual|toStrictEqual)\(\s*\[\s*\]\s*\)|\.toHaveLength\(\s*0\s*\)/;

/** An `if` on the exclusion whose body pushes the survivors: `) { wrong.push(`. */
const PUSHED_TO_RE = /^[^{]*\)\s*\{\s*(\w+)\.push\(/;

/** Where the statement holding `index` starts. It cuts statements at `;`, as a claim does. */
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

/** The distinct tiers a statement names as literals. */
const tiersNamedIn = (statement: string): Set<string> =>
  new Set([...statement.matchAll(TIER_LITERAL_RE)].map((m) => m[1]!));

/** Whether one statement of `body` matches both `subject` and `matcher`. */
const assertsOn = (body: string, subject: RegExp, matcher: RegExp): boolean =>
  body.split(';').some((statement) => subject.test(statement) && matcher.test(statement));

/** An `expect` whose subject is `name` itself, not a read of it. */
const expectOf = (name: string): RegExp => new RegExp(`\\bexpect\\(\\s*${name}\\s*[,)]`);

/** An `expect` whose subject is `name` or a read of it, such as `name[0]` or `name.length`. */
const expectOfReadOf = (name: string): RegExp => new RegExp(`\\bexpect\\(\\s*${name}\\b`);

/** Whether `body` asserts that the list bound to `name` is empty. */
const isAssertedEmpty = (body: string, name: string): boolean =>
  assertsOn(body, expectOf(name), EMPTY_RE);

/** Whether `body` asserts that the list bound to `name`, or a read of it, is non-empty. */
const isAssertedNonEmpty = (body: string, name: string): boolean =>
  assertsOn(body, expectOfReadOf(name), NON_EMPTY_RE);

/** Whether `body` asserts that the list a helper call at `index` returns is non-empty. */
function isListAssertedNonEmpty(body: string, index: number, claim: string): boolean {
  if (NON_EMPTY_RE.test(claim)) return true;
  const name = boundNameAt(body, index);
  return name !== null && isAssertedNonEmpty(body, name);
}

/**
 * The tier an exclusion claims when a test asserts its survivors empty: no diagnostic but
 * `error` survives, so every one is `error`. A statement that names a second tier anywhere
 * is ambiguous and claims nothing.
 */
function emptiedExclusion(body: string, index: number, claim: string): string | null {
  const tier = EXCLUSION_RE.exec(claim)?.[1];
  if (!tier || tiersNamedIn(statementAt(body, index)).size !== 1) return null;
  if (EMPTY_RE.test(claim)) return tier;
  const survivors = PUSHED_TO_RE.exec(claim)?.[1] ?? boundNameAt(body, index);
  return survivors !== null && isAssertedEmpty(body, survivors) ? tier : null;
}

/** An inline `LintRule`, whose `severity:` is the fixture rather than a claim. */
const RULE_FIXTURE_RE = /\bmeta:\s*\{/;

/** The tiers a block asserts, deduplicated. */
export const assertedTiers = (body: string): string[] => {
  if (RULE_FIXTURE_RE.test(body)) return [];
  const tiers = new Set<string>();
  const claimAt = (index: number): string =>
    body.slice(index, index + CLAIM_REACH).split(';')[0]!;
  for (const m of body.matchAll(TIER_HELPER_RE)) tiers.add(m[1]!.toLowerCase());
  for (const m of body.matchAll(TIER_LIST_RE)) {
    const tier = m[1] ?? lastArgumentTier(body, m.index + m[0].length - 1);
    if (tier !== null && isListAssertedNonEmpty(body, m.index, claimAt(m.index))) tiers.add(tier);
  }
  for (const anchor of body.matchAll(TIER_ANCHOR_RE)) {
    const claim = claimAt(anchor.index);
    if (!EXCLUDES_RE.test(claim)) {
      for (const m of claim.matchAll(TIER_LITERAL_RE)) tiers.add(m[1]!);
      continue;
    }
    const excluded = emptiedExclusion(body, anchor.index, claim);
    if (excluded !== null) tiers.add(excluded);
  }
  return [...tiers];
};

/** A predicate narrowing to one tier: `d.severity === 'error'`. */
const TIER_PREDICATE_RE = new RegExp(`severity\\s*===\\s*'(${TIER_NAMES})'`, 'g');

/** A predicate narrowing to one diagnostic: by its message or its rule name. */
const IDENTITY_RE = /\.message\.includes\(|\.ruleName\s*===/;

/** The searches such a predicate sits in. */
const SEARCH_RE = /\.(?:some|filter|find)\(/;

/** An assertion that a search found nothing: an empty list, `false` or `undefined`. */
const FOUND_NOTHING_RE = new RegExp(
  `${EMPTY_RE.source}|\\.toBe\\(\\s*false\\s*\\)|\\.toBeUndefined\\(\\s*\\)`
);

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
  for (const m of body.matchAll(TIER_PREDICATE_RE)) {
    const statement = statementAt(body, m.index);
    const isNarrowedSearch = SEARCH_RE.test(statement) && IDENTITY_RE.test(statement);
    if (isNarrowedSearch && isFoundNothing(body, m.index, statement)) offenders.add(statement);
  }
  return [...offenders];
}
