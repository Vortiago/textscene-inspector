// Gate: no engine cite, tool-read tag, directive or test title is lost from a changed file.
// Usage: node .sweep/keepList.mjs [paths…]   Exit 1 when any kept token is lost.
import console from 'node:console';
import process from 'node:process';
import { after, before, changedFiles } from './changed.mjs';

/** Each kind of text a tool or a reader relies on, as the pattern that finds it. */
const KEPT = {
  'engine cite': /\b[\w./-]+\.(?:cpp|h|hpp|inc|xml|glsl|gdshader)(?::\d+(?:-\d+)?)?/g,
  'doc tag': /@(?:param|returns?|type|typedef|template|see|deprecated|link|example|internal)\b/g,
  directive: /\b(?:eslint-[\w-]+(?: [\w@/,-]+)?|@ts-(?:expect-error|ignore|nocheck|check)|prettier-ignore|istanbul ignore \w+|c8 ignore \w+)/g,
  'test title': /\b(?:it|test|describe)(?:\.\w+)?\(\s*(['"`])(?:(?!\1)[^\\]|\\.)*\1/g,
  'keep marker': /[Kk]eep in sync with[^\n.]*|\bGENERATED\b[^\n]*|@generated\b|canonical source:[^\n]*|shellcheck [^\n]*/g,
};

function counts(text, pattern) {
  const found = new Map();
  for (const match of text.matchAll(pattern)) found.set(match[0], (found.get(match[0]) ?? 0) + 1);
  return found;
}

let lost = 0;
for (const path of changedFiles()) {
  const old = before(path);
  const now = after(path);
  const losses = [];
  for (const [kind, pattern] of Object.entries(KEPT)) {
    const kept = counts(now, pattern);
    for (const [token, n] of counts(old, pattern)) {
      const missing = n - (kept.get(token) ?? 0);
      if (missing > 0) losses.push(`${kind} ×${missing}: ${token}`);
    }
  }
  if (losses.length === 0) continue;
  lost += losses.length;
  console.log(`\n${path}`);
  for (const loss of losses) console.log(`  - ${loss}`);
}
console.log(`\n${lost} kept token(s) lost`);
process.exitCode = lost > 0 ? 1 : 0;
