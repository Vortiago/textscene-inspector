/** The `[path, lines]` of each base, where `lines` is a set of line numbers or `'all'` for a whole file. */
export function linesAddedInEvery(perBase) {
  const [first, ...rest] = perBase;
  const others = rest.map((files) => new Map(files));
  return first.flatMap(([path, lines]) => {
    let kept = lines;
    for (const files of others) {
      const added = files.get(path);
      if (added === undefined) return [];
      kept = intersect(kept, added);
    }
    return kept === 'all' || kept.size > 0 ? [[path, kept]] : [];
  });
}

function intersect(a, b) {
  if (a === 'all') return b;
  if (b === 'all') return a;
  return new Set([...a].filter((line) => b.has(line)));
}
