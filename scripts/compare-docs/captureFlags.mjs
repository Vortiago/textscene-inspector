/**
 * The flags `capture.mjs`, `recapture.mjs` and `capture-complex.mjs` share, parsed once so the
 * three read each flag the same way: a side flag selects its own side, and none selects both.
 */

/** The side each flag selects. */
const SIDE_FLAGS = { '--godot': 'godot', '--ours': 'ours' };

/**
 * `argv` as `{ godot, ours, only }`, plus one boolean per name in `switches` (`'force'` reads
 * `--force`). An unknown flag such as `--onl`, or an `--only` with nothing after it, throws: either
 * would leave `only` null and re-render every image, then exit 0.
 */
export function parseCaptureFlags(argv, switches = []) {
  const args = { godot: false, ours: false, only: null };
  for (const name of switches) args[name] = false;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (Object.hasOwn(SIDE_FLAGS, flag)) {
      args[SIDE_FLAGS[flag]] = true;
    } else if (flag === '--only') {
      args.only = argv[++i] ?? null;
      if (!args.only) throw new Error('--only needs a name fragment');
    } else if (flag.startsWith('--') && switches.includes(flag.slice(2))) {
      args[flag.slice(2)] = true;
    } else {
      throw new Error(`Unknown flag ${flag}`);
    }
  }
  if (!args.godot && !args.ours) {
    args.godot = true;
    args.ours = true;
  }
  return args;
}
