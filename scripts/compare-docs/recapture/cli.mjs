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
      // An unknown flag such as `--onl` would leave `only` null and re-render
      // every committed image.
      default:
        throw new Error(`Unknown flag ${argv[i]}`);
    }
  }
  // Each flag turns the other side off, so both together select neither.
  if (!a.godot && !a.ours) throw new Error('--godot and --ours are mutually exclusive');
  return a;
}
