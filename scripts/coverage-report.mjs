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

const REPO_ROOT = import.meta.dirname;
const CATALOG = join(REPO_ROOT, 'compare-docs/node-catalog.json');

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
 * Godot's intermediate classes are `can_instantiate`, so they are ordinary
 * catalog entries and get ordinary slices — but every leaf below them inherits
 * their validators, so implementing one first is what stops a property being
 * declared five times. Ordered before everything else regardless of family.
 */
const BASE_CLASSES = new Set([
  'Range',
  'BaseButton',
  'Container',
  'BoxContainer',
  'FlowContainer',
  'SplitContainer',
  'TextEdit',
  'Window',
  'Popup',
  'AcceptDialog',
  'ConfirmationDialog',
  'GraphElement',
  'VisualInstance3D',
  'GeometryInstance3D',
  'SkeletonModifier3D',
  'SpringBoneCollision3D',
  'BoneConstraint3D',
  'XRNode3D',
  'VisibleOnScreenNotifier2D',
  'VisibleOnScreenNotifier3D',
]);

function parseArgs(argv) {
  const opts = { next: 0, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--next') opts.next = Number(argv[++i]) || 5;
    else if (argv[i] === '--json') opts.json = true;
    else if (argv[i] === '--help' || argv[i] === '-h') opts.help = true;
    else {
      console.error(`[coverage-report] unknown option: ${argv[i]}`);
      process.exit(1);
    }
  }
  return opts;
}

/**
 * Sort key: base classes first — shallowest chain first, so a base lands before
 * any base derived from it (`Container` before `BoxContainer`) — then family
 * order, then name.
 */
function waveKey(node) {
  const isBase = BASE_CLASSES.has(node.name);
  const family = FAMILY_ORDER.indexOf(node.group);
  return [
    isBase ? 0 : 1,
    isBase ? node.chain.length : family === -1 ? FAMILY_ORDER.length : family,
    node.name,
  ];
}

const byWave = (a, b) => {
  const ka = waveKey(a);
  const kb = waveKey(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
};

export async function collectCoverage() {
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
  const { nodeRegistry } = await loadCoreParser();
  const { validatorRegistry } = await loadCoreLinter();

  const registered = new Set(nodeRegistry.getAllTypeNames());
  const validated = new Set(validatorRegistry.getRegisteredNodeTypes());

  const missing = catalog.nodes.filter((n) => !registered.has(n.name)).sort(byWave);

  // A registration for a type Godot's ClassDB never listed is either a node
  // newer than the catalog's engine build or a typo; either way, say so.
  const phantom = [...registered].filter(
    (t) => !catalog.nodes.some((n) => n.name === t) && !NOT_IN_CLASSDB.has(t)
  );

  return {
    godotVersion: catalog.godotVersion,
    total: catalog.nodes.length,
    registered: [...registered].sort(),
    validated: [...validated].sort(),
    missing,
    phantom,
    /** Registered but with no validators of its own — inherits everything. */
    registeredWithoutOwnValidators: [...registered].filter((t) => !validated.has(t)).sort(),
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
      const base = BASE_CLASSES.has(n.name) ? '  [BASE CLASS — do these first]' : '';
      console.log(`${n.name.padEnd(32)} ${n.category.padEnd(3)} ${n.group}${base}`);
      console.log(`${' '.repeat(32)} chain: ${n.chain.join(' < ')}`);
    }
    return;
  }

  const done = data.total - data.missing.length;
  const pct = ((done / data.total) * 100).toFixed(1);
  console.log(`Godot ${data.godotVersion}`);
  console.log(`Node types: ${done}/${data.total} registered (${pct}%), ${data.missing.length} missing`);
  console.log(`Types with their own validators: ${data.validated.length}\n`);

  if (data.phantom.length) {
    console.log(`Registered but absent from ClassDB: ${data.phantom.join(', ')}\n`);
  }

  const groups = new Map();
  for (const n of data.missing) {
    if (!groups.has(n.group)) groups.set(n.group, []);
    groups.get(n.group).push(n.name);
  }
  // Family position only — the base-class tier is reported separately above, so
  // letting it rank a group here would show a family out of its own order.
  const familyRank = (g) => {
    const i = FAMILY_ORDER.indexOf(g);
    return i === -1 ? FAMILY_ORDER.length : i;
  };
  const ordered = [...groups.entries()].sort(
    (a, b) => familyRank(a[0]) - familyRank(b[0]) || a[0].localeCompare(b[0])
  );

  const bases = data.missing.filter((n) => BASE_CLASSES.has(n.name)).map((n) => n.name);
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
