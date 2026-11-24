/** Each `TTRC("…")` of the table in order, so an entry's index is its `Error` code. */
export function errorNames(source) {
  const table = /error_names\[\]\s*=\s*\{([\s\S]*?)\};/.exec(source);
  if (!table) throw new Error('expected the error_names table in error_list.cpp, found none');
  return [...table[1].matchAll(/TTRC\("((?:[^"\\]|\\.)*)"\)/g)].map((match) => JSON.parse(`"${match[1]}"`));
}
