/** Parts of a patched GLSL source that a shader patch's test reads. */

/** The body of the first GLSL function whose declaration ends in `name`, between its braces. */
export function functionBody(source: string, name: string): string {
  const declaration = source.indexOf(`${name}(`);
  if (declaration < 0) throw new Error(`expected a function ${name}, found none`);
  const open = source.indexOf('{', declaration) + 1;
  let depth = 1;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(open, i);
  }
  throw new Error(`expected a closed body for ${name}, found an open one`);
}

/** The text of `source` from the line `opening` to the next `#elif`, `#else` or `#endif`. */
export function preprocessorBranch(source: string, opening: string): string {
  const start = source.indexOf(opening);
  if (start < 0) throw new Error(`expected the line ${opening}, found none`);
  return source.slice(start + opening.length).split(/#el|#endif/)[0]!;
}
