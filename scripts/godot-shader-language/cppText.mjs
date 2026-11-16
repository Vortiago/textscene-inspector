/** `MAX`-named sentinels stay: the caller drops what is not an instruction. */
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

/** The statements of `void Variant::<name>()` in `cpp`, the text of `file`, without blanks and comments. */
export function registerStatements(cpp, name, file) {
  const start = cpp.indexOf(`void Variant::${name}() {`);
  if (start === -1) throw new Error(`expected ${name} in ${file}, found none`);
  const firstLine = lineAt(cpp, start);
  return cpp
    .slice(start, cpp.indexOf('\n}', start))
    .split('\n')
    .slice(1)
    .map((raw, index) => ({ statement: raw.trim(), line: firstLine + 1 + index }))
    .filter(({ statement }) => statement !== '' && !statement.startsWith('//'));
}
