/** The pairs of one `{ code, mapped }` table of ucaps.h, in its order. */
function casePairs(source, name) {
  const table = new RegExp(`${name}\\[[^\\]]*\\]\\[2\\]\\s*=\\s*\\{([\\s\\S]*?)\\};`).exec(source);
  if (!table) throw new Error(`expected the ${name} table in ucaps.h, found none`);
  return [...table[1].matchAll(/\{\s*(0x[0-9A-Fa-f]+),\s*(0x[0-9A-Fa-f]+)\s*\}/g)].map(([, code, mapped]) => [
    Number(code),
    Number(mapped),
  ]);
}

/** Pairs as runs `[first, count, step, delta]`: codes `first + k * step` map to themselves plus `delta`. */
export function caseRuns(pairs) {
  const runs = [];
  for (const [code, mapped] of pairs) {
    const run = runs.at(-1);
    const delta = mapped - code;
    const last = run && run[0] + (run[1] - 1) * run[2];
    const fitsStep = run && (run[1] === 1 ? code - last <= 2 : code - last === run[2]);
    if (run && run[3] === delta && fitsStep) {
      if (run[1] === 1) run[2] = code - last;
      run[1]++;
    } else runs.push([code, 1, 1, delta]);
  }
  return runs;
}

/** The upper-case and lower-case runs of ucaps.h (`caps_table`, `reverse_caps_table`). */
export function caseTables(source) {
  return {
    upper: caseRuns(casePairs(source, 'caps_table')),
    lower: caseRuns(casePairs(source, 'reverse_caps_table')),
  };
}

/** The `{ start, end }` ranges of one `CharRange` table of char_range.inc, flat as start, end, start, end. */
function charRanges(source, name) {
  const table = new RegExp(`CharRange ${name}\\[\\]\\s*=\\s*\\{([\\s\\S]*?)\\};`).exec(source);
  if (!table) throw new Error(`expected the ${name} table in char_range.inc, found none`);
  return [...table[1].matchAll(/\{\s*(0x[0-9A-Fa-f]+),\s*(0x[0-9A-Fa-f]+)\s*\}/g)].flatMap(
    ([, start, end]) => [Number(start), Number(end)]
  );
}

/** The five character classes of char_range.inc that char_utils.h searches. */
export function characterClasses(source) {
  return {
    identifierStart: charRanges(source, 'xid_start'),
    identifierContinue: charRanges(source, 'xid_continue'),
    upperCase: charRanges(source, 'uppercase_letter'),
    lowerCase: charRanges(source, 'lowercase_letter'),
  };
}
