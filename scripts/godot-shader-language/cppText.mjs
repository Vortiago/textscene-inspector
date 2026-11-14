/** Reading helpers for the C++ text of a vendored Godot source file. */

/**
 * The enumerators of `enum <name> { ... }` in `text`, in order, each with its 1-based line.
 * `MAX`-named sentinels stay: the caller drops what is not an instruction.
 */
export function enumMembers(text, name) {
  const start = text.search(new RegExp(`enum ${name} \\{`));
  if (start === -1) throw new Error(`expected enum ${name} in the source, found none`);
  const end = text.indexOf('}', start);
  const firstLine = lineAt(text, start);
  return text
    .slice(start, end)
    .split('\n')
    .slice(1)
    .map((line, index) => ({
      name: line
        .replace(/\/\/.*/, '')
        .trim()
        .replace(/,$/, ''),
      line: firstLine + 1 + index,
    }))
    .filter(({ name: member }) => /^\w+$/.test(member));
}

/** The 1-based line of character `index` of `text`. */
export function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}
