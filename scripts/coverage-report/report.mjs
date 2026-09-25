/** The CLI surface: what the flags mean and how the ledger is printed. */

export function parseArgs(argv) {
  const opts = { json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') opts.json = true;
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
  if (data.missing.length) console.log(`Missing: ${data.missing.map((n) => n.name).join(', ')}`);
}
