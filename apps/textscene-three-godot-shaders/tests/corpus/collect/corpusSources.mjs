/**
 * The parses that find whole shaders in the corpus sources, apart from the reads: the code
 * blocks of a documentation page, the Shader resources written inside a scene or resource file,
 * and the one change that makes a rejected shader from a valid one.
 */

/** Each `.. code-block:: glsl` of an rST page that is a whole shader, dedented, by its block index. */
export function docsShaders(rst) {
  const blocks = [];
  const lines = rst.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^\s*\.\. code-block:: glsl\s*$/.test(lines[index])) continue;
    const body = [];
    let next = index + 1;
    while (next < lines.length && (lines[next].trim() === '' || /^\s/.test(lines[next]))) {
      body.push(lines[next]);
      next += 1;
    }
    blocks.push(dedent(body));
    index = next - 1;
  }
  return blocks.map((text, index) => ({ index, text })).filter(({ text }) => text.startsWith('shader_type'));
}

/** `lines` with their common indent removed, and no blank lines before or after. */
function dedent(lines) {
  const filled = lines.filter((line) => line.trim() !== '');
  const indent = Math.min(...filled.map((line) => line.match(/^\s*/)[0].length));
  const text = lines.map((line) => line.slice(indent).trimEnd()).join('\n');
  return `${text.trim()}\n`;
}

/** The `code` of each Shader resource in the text of a `.tscn` or `.tres` file, unescaped. */
export function inlineShaders(text) {
  return [...text.matchAll(/^code = "((?:[^"\\]|\\.)*)"/gms)].map((match) => unescapeGodotString(match[1]));
}

/** Godot's string escapes as its resource writer writes them (`variant_parser.cpp`): `\"`, `\\`, `\n`, `\t`. */
function unescapeGodotString(text) {
  return text.replace(/\\(.)/g, (_, letter) => ({ n: '\n', t: '\t' })[letter] ?? letter);
}

/**
 * The rejected shader made from `text` by one change of kind `kind`, taken in turn so the corpus
 * holds each kind: a missing semicolon, a misspelt type, a call of a function nobody defines.
 * A text the change cannot apply to gets the first kind.
 */
export function oneChange(text, kind) {
  if (kind % 3 === 1 && /\bvec[234]\(/.test(text)) {
    return { change: 'misspells the first vector type', text: text.replace(/\bvec([234])\(/, 'vex$1(') };
  }
  const opening = /^(void \w+\(\)\s*\{)\n/m;
  if (kind % 3 === 2 && opening.test(text)) {
    return {
      change: 'calls a function the shader does not define',
      text: text.replace(opening, '$1\n\tnot_defined();\n'),
    };
  }
  const last = text.lastIndexOf(';');
  return { change: 'drops the last semicolon', text: text.slice(0, last) + text.slice(last + 1) };
}
