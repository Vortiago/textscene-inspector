/**
 * The CLI surface: what the flags mean and how the ledger is printed.
 */

import { familyRank } from './waveOrder.mjs';

export function parseArgs(argv) {
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

export function report(data, opts) {
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
