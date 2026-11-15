/**
 * The lines that every base's diff adds, as `[path, lines]` with `lines` a set of line numbers.
 * @param {[string, Set<number>][][]} perBase
 */
export function linesAddedInEvery(perBase) {
  const [first, ...rest] = perBase;
  const others = rest.map((files) => new Map(files));
  return first.flatMap(([path, lines]) => {
    const kept = others.reduce((acc, files) => intersect(acc, files.get(path) ?? new Set()), lines);
    return kept.size > 0 ? [[path, kept]] : [];
  });
}

function intersect(a, b) {
  return new Set([...a].filter((line) => b.has(line)));
}
