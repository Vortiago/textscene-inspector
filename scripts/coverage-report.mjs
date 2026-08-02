#!/usr/bin/env node
/**
 * Which Godot node types the previewer recognises, and which are still missing.
 *
 *   node scripts/coverage-report.mjs             # full report
 *   node scripts/coverage-report.mjs --next 5    # the next N types to implement
 *   node scripts/coverage-report.mjs --json      # machine-readable
 *
 * State is DERIVED, never written down: the registered set comes from the live
 * registries in the built package and the universe comes from Godot's own
 * ClassDB via `node-catalog.json`. A long node-coverage push can therefore be
 * resumed from a cold start — run this and it tells you exactly where you are —
 * and no hand-maintained checklist can drift out of sync with the code.
 *
 * Needs a current `pnpm --filter @textscene/core build`. The lenient parser and
 * the linter are React/THREE-free (ADR-0001), so both load in plain Node; the
 * r3f component registries are not, and are deliberately out of scope here.
 * "Registered" means the lenient parser recognises the type, which is the same
 * definition `node-catalog.json` uses for `supported`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadCoreLinter, loadCoreParser } from './compare-docs/loadCoreLinter.mjs';

const SCRIPTS_DIR = import.meta.dirname;
const CATALOG = join(SCRIPTS_DIR, 'compare-docs/node-catalog.json');

/**
 * Godot 4.6.3 parses `AreaLight3D` but emits nothing from it, so the node
 * postdates that build and never appears in its ClassDB. It is implemented here
 * regardless; without this note it reads as a phantom registration.
 */
const NOT_IN_CLASSDB = new Set(['AreaLight3D']);

/**
 * Wave order: base classes first, so a leaf slice declares only its own members
 * and inherits the rest through NODE_BASE_TYPES; then families largest-shared-
 * vocabulary first, so duplication surfaces inside one wave instead of five
 * waves apart. Groups are `node-catalog.json`'s own `group` values.
 */
const FAMILY_ORDER = [
  'Physics — queries',
  'Physics — bodies',
  'Physics — vehicles',
  'Physics — joints',
  'Particles',
  'UI — controls',
  'UI — containers',
  'UI — windows',
  'Skeleton, bones & IK',
  'Reflection & global illumination',
  'Meshes & rendering',
  'Navigation',
  'Collision shapes',
  'Visibility',
  '2D rendering',
  'Canvas effects',
  'Canvas layers',
  'Parallax & scrolling',
  'Lighting',
  'Cameras',
  'Viewports',
  'Touch input',
  'Audio',
  'Networking',
  'XR / AR',
];

/**
 * A node is a "base class" here when some other catalogued node lists it as an
 * ancestor. Godot's own hierarchy already says so — every catalog entry carries
 * its `chain` — so this is derived rather than listed: a hand-written list had
 * already gone stale after one wave, and a base nobody remembered to add would
 * sort as an ordinary leaf and turn the wave that reaches its subclass red for
 * a reason that reads as unrelated.
 */
const baseClassesOf = (nodes) => new Set(nodes.flatMap((n) => n.chain));

function parseArgs(argv) {
  const opts = { next: 0, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--next') {
      // Bare `--next` means "the default handful". A value must be a positive
      // integer: `Number(x) || 5` turned both `--next 0` and `--next later`
      // into 5, so a typo silently printed a different report than was asked
      // for while swallowing the next argument.
      const raw = argv[++i];
      const n = raw === undefined ? 5 : Number(raw);
      if (!Number.isInteger(n) || n < 1) {
        console.error(`[coverage-report] --next needs a positive integer, got: ${raw}`);
        process.exit(1);
      }
      opts.next = n;
    } else if (argv[i] === '--json') opts.json = true;
    else if (argv[i] === '--help' || argv[i] === '-h') opts.help = true;
    else {
      console.error(`[coverage-report] unknown option: ${argv[i]}`);
      process.exit(1);
    }
  }
  return opts;
}

/** Family position; anything ungrouped sorts after every named family. */
function familyRank(group) {
  const i = FAMILY_ORDER.indexOf(group);
  return i === -1 ? FAMILY_ORDER.length : i;
}

/**
 * Base classes first — shallowest chain first, so a base lands before any base
 * derived from it (`Container` before `BoxContainer`) — then family, then name.
 * `isBase` is stamped on each node by `collectCoverage`.
 */
const byWave = (a, b) =>
  Number(!a.isBase) - Number(!b.isBase) ||
  (a.isBase ? a.chain.length - b.chain.length : familyRank(a.group) - familyRank(b.group)) ||
  a.name.localeCompare(b.name);

export async function collectCoverage() {
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
  const { nodeRegistry } = await loadCoreParser();
  const { validatorRegistry } = await loadCoreLinter();

  const registered = new Set(nodeRegistry.getAllTypeNames());
  // A registration entry is not coverage: a slice may call registerAll with an
  // empty map, which is correct for a type Godot gives no own members but
  // indistinguishable from a slice nobody finished. Count declared keys.
  const validated = new Set(
    validatorRegistry
      .getRegisteredNodeTypes()
      .filter((t) => validatorRegistry.getOwnKeys(t).length > 0)
  );

  // Registered by the parser, declaring nothing of its own. These read as
  // covered in the `registered` count while StrictTscnParser accepts every
  // value on them, so they are listed rather than left to be inferred.
  const undeclared = [...registered].filter((t) => !validated.has(t)).sort();

  const bases = baseClassesOf(catalog.nodes);
  const catalogued = new Set(catalog.nodes.map((n) => n.name));

  const missing = catalog.nodes
    .filter((n) => !registered.has(n.name))
    .map((n) => ({ ...n, isBase: bases.has(n.name) }))
    .sort(byWave);

  // A registration for a type Godot's ClassDB never listed is either a node
  // newer than the catalog's engine build or a typo; either way, say so.
  const phantom = [...registered].filter((t) => !catalogued.has(t) && !NOT_IN_CLASSDB.has(t));

  return {
    godotVersion: catalog.godotVersion,
    total: catalog.nodes.length,
    registered: [...registered].sort(),
    validated: [...validated].sort(),
    undeclared,
    missing,
    phantom,
  };
}

function report(data, opts) {
  if (opts.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (opts.next) {
    const next = data.missing.slice(0, opts.next);
    if (!next.length) {
      console.log('Nothing left — every catalogued node type is registered.');
      return;
    }
    for (const n of next) {
      const base = n.isBase ? '  [BASE CLASS — do these first]' : '';
      console.log(`${n.name.padEnd(32)} ${n.category.padEnd(3)} ${n.group}${base}`);
      console.log(`${' '.repeat(32)} chain: ${n.chain.join(' < ')}`);
    }
    return;
  }

  const done = data.total - data.missing.length;
  const pct = ((done / data.total) * 100).toFixed(1);
  console.log(`Godot ${data.godotVersion}`);
  console.log(`Node types: ${done}/${data.total} registered (${pct}%), ${data.missing.length} missing`);
  console.log(`Types with their own validators: ${data.validated.length}`);
  if (data.undeclared.length) {
    console.log(
      `Registered but declaring none: ${data.undeclared.length} ` +
        `(see linter/ownValidatorCoverage.test.ts for which are correct)`
    );
  }
  console.log('');

  if (data.phantom.length) {
    console.log(`Registered but absent from ClassDB: ${data.phantom.join(', ')}\n`);
  }

  const groups = new Map();
  for (const n of data.missing) {
    if (!groups.has(n.group)) groups.set(n.group, []);
    groups.get(n.group).push(n.name);
  }
  const ordered = [...groups.entries()].sort(
    (a, b) => familyRank(a[0]) - familyRank(b[0]) || a[0].localeCompare(b[0])
  );

  const bases = data.missing.filter((n) => n.isBase).map((n) => n.name);
  if (bases.length) {
    console.log(`Base classes still missing (${bases.length}) — implement before their leaves:`);
    console.log(`  ${bases.join(', ')}\n`);
  }

  console.log('Missing by family, in wave order:');
  for (const [group, names] of ordered) {
    console.log(`  ${String(names.length).padStart(3)}  ${group}`);
  }
}

// Only report when run as a CLI — `coverage-report.test.mjs` imports
// `collectCoverage` and must not have a report printed into its output.
// `pathToFileURL` because argv[1] is a path and import.meta.url is a URL.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('usage: node scripts/coverage-report.mjs [--next <n>] [--json]');
  } else {
    report(await collectCoverage(), opts);
  }
}
