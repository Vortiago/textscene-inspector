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

/**
 * The text of `source` from the line `opening` to its own `#elif`, `#else` or `#endif`, past any
 * block nested inside it.
 */
export function preprocessorBranch(source: string, opening: string): string {
  const start = source.indexOf(opening);
  if (start < 0) throw new Error(`expected the line ${opening}, found none`);
  const lines = source.slice(start + opening.length).split('\n');
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const directive = lines[i]!.trim();
    if (directive.startsWith('#if')) depth++;
    else if (directive.startsWith('#endif') && depth > 0) depth--;
    else if (depth === 0 && (directive.startsWith('#el') || directive.startsWith('#endif')))
      return lines.slice(0, i).join('\n');
  }
  return lines.join('\n');
}

/**
 * `source` without each block that opens with the line `opening`, through its matching `#endif`, as
 * the preprocessor compiles it while the block's condition fails. A block with an `#else` keeps none
 * of it, so it suits a block without one.
 */
export function withoutBlock(source: string, opening: string): string {
  const kept: string[] = [];
  let depth = 0;
  for (const line of source.split('\n')) {
    const directive = line.trim();
    if (depth === 0 && directive === opening) depth = 1;
    else if (depth > 0 && directive.startsWith('#if')) depth++;
    else if (depth > 0 && directive.startsWith('#endif')) depth--;
    else if (depth === 0) kept.push(line);
  }
  if (depth !== 0) throw new Error(`expected a closed block for ${opening}, found an open one`);
  return kept.join('\n');
}
