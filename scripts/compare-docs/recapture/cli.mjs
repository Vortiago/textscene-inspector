/** The argument contract: which sides to render, and which images. */

export function parseArgs(argv) {
  const a = { godot: true, ours: true, only: null };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--ours':
        a.godot = false;
        break;
      case '--godot':
        a.ours = false;
        break;
      case '--only':
        a.only = argv[++i];
        if (!a.only) throw new Error('--only needs an image-name fragment');
        break;
      // A dropped flag is not a narrower run, it is the whole gallery: `--onl
      // unit-decal` left `only` null and re-rendered every committed image from
      // the working tree.
      default:
        throw new Error(`Unknown flag ${argv[i]}`);
    }
  }
  // Each flag turns the OTHER side off, so passing both selects neither: the run
  // printed "Re-rendering N image(s)…" and exited 0 having rendered nothing.
  if (!a.godot && !a.ours) throw new Error('--godot and --ours are mutually exclusive');
  return a;
}
