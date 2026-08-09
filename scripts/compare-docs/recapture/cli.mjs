/** The argument contract: which sides to render, and which images. */

export function parseArgs(argv) {
  const a = { godot: true, ours: true, only: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ours') a.godot = false;
    else if (argv[i] === '--godot') a.ours = false;
    else if (argv[i] === '--only') a.only = argv[++i];
  }
  return a;
}
