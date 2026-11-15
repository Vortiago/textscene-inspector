/** The top-level comma-separated parts of a C++ argument list, with `<...>` nesting kept whole. */
export function splitArguments(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '<') depth += 1;
    else if (char === '>') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (text.trim() !== '') parts.push(text.slice(start).trim());
  return parts;
}
