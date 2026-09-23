/** Which engine headers exist, indexed for lookup: the source of every candidate. */

const TREE_API =
  'https://api.github.com/repos/godotengine/godot/git/trees/master?recursive=1';

/**
 * Only engine code defines nodes and resources. `editor/` is in because a few
 * editor dialogs (ScriptCreateDialog) are ClassDB nodes in the catalog.
 */
const SOURCE_ROOTS = ['scene/', 'modules/', 'servers/', 'editor/'];

/** Every engine header path, indexed by basename. */
export async function fetchSourceIndex() {
  const res = await fetch(TREE_API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'textscene-compare-docs' },
  });
  if (!res.ok) throw new Error(`GitHub tree API ${res.status} ${res.statusText}`);
  const body = await res.json();
  if (body.truncated) throw new Error('GitHub tree response was truncated');

  const byBasename = new Map();
  const byDir = new Map();
  for (const entry of body.tree) {
    if (entry.type !== 'blob' || !entry.path.endsWith('.h')) continue;
    if (!SOURCE_ROOTS.some((r) => entry.path.startsWith(r))) continue;
    const cut = entry.path.lastIndexOf('/') + 1;
    const base = entry.path.slice(cut);
    const dir = entry.path.slice(0, cut);
    if (!byBasename.has(base)) byBasename.set(base, []);
    byBasename.get(base).push(entry.path);
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push(entry.path);
  }
  return { byBasename, byDir };
}
