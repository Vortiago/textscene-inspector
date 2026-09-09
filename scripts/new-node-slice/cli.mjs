/**
 * The scaffold's command line. Every rule here exists because the mistake it
 * catches is otherwise SILENT: a missing `--intent` leaves the sheet status and
 * the render registration disagreeing, and a type name Godot does not know
 * leaves the type with no base and therefore no inherited validation.
 */

import { BASES, INTENTS } from './bases.mjs';
import { fail } from './paths.mjs';

export function parseArgs(argv) {
  const positional = [];
  const opts = { base: 'node3d', intent: '', linter: false, dryRun: false, tier: false, rule: false };
  // `--base` carries a default, so its presence is tracked rather than read
  // off `opts`: the tier branch below refuses flags that were PASSED.
  let baseGiven = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') { opts.base = argv[++i]; baseGiven = true; }
    else if (a === '--intent') opts.intent = argv[++i];
    else if (a === '--transform-only') {
      // Replaced by `--intent transform-only`, which also settles the render
      // registration and the sheet status. Kept as a hard error rather than an
      // alias so a stale invocation cannot quietly skip that classification.
      fail('--transform-only is gone: pass `--intent transform-only` instead.');
    } else if (a === '--linter') opts.linter = true;
    else if (a === '--tier') opts.tier = true;
    else if (a === '--rule') opts.rule = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a.startsWith('--')) fail(`unknown option: ${a}`);
    else positional.push(a);
  }
  if (positional.length !== 2) {
    fail(
      'usage: pnpm new:node <TypeName> <category-dir> --intent <draws|transform-only|pending> ' +
        '[--base node3d|node2d|node|control] [--linter] [--dry-run]\n' +
        '   or: pnpm new:node <AbstractType> <category-dir> --tier [--rule] [--dry-run]'
    );
  }
  const [typeName, category] = positional;
  if (!/^[A-Z][A-Za-z0-9]*$/.test(typeName)) fail(`TypeName must be PascalCase, got: ${typeName}`);
  if (!/^[a-z0-9/]+$/.test(category)) fail(`category-dir must be lowercase path segments, got: ${category}`);

  if (opts.tier) {
    // A tier is a validator set for an abstract Godot class: no parser, no
    // component, no fixture, no sheet, because the class cannot appear in a
    // .tscn. So --intent and --base are both meaningless here.
    for (const [flag, value] of [
      ['--intent', opts.intent],
      ['--base', baseGiven],
    ]) {
      if (value) fail(`${flag} does not apply to --tier: an abstract class has no slice shape and no leaf chain.`);
    }
    if (opts.linter) fail('--linter does not apply to --tier: a tier is validators by definition.');
    return { typeName, category, ...opts };
  }
  if (opts.rule) fail('--rule only applies with --tier.');

  if (!BASES[opts.base]) fail(`--base must be one of ${Object.keys(BASES).join('|')}, got: ${opts.base}`);
  if (!INTENTS.includes(opts.intent)) {
    fail(`--intent is required and must be one of ${INTENTS.join('|')}, got: ${opts.intent || '(none)'}`);
  }
  if (opts.base === 'control' && opts.intent !== 'pending') {
    fail(
      `--base control supports only --intent pending.\n` +
        `A Control that RENDERS belongs to the 2D DOM overlay (ADR-0003): it registers ` +
        `into controlComponentRegistry, wires r3f/controls/index.ts, and must join ` +
        `TWO_D_UI_TYPES in r3f/controls/has2DUIContent.ts, whose driftguard asserts exact ` +
        `set equality. This scaffold emits none of that — it would register a DOM ` +
        `component into the THREE registry and mount a <div> into the R3F reconciler. ` +
        `Scaffold it as pending, or teach BASES to own its registry and barrel first.`
    );
  }
  return { typeName, category, ...opts };
}
