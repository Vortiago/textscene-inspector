/**
 * The two mechanical edits a scaffold makes outside its own directory: naming a
 * fixture, and inserting an aggregation import in the right group.
 */

import { readFileSync } from 'node:fs';
import { fail } from './paths.mjs';

/** Marker3D → marker-3d, AudioStreamPlayer2D → audio-stream-player-2d */
export function kebab(typeName) {
  const tokens = typeName.match(/[A-Z]+(?![a-z])|[A-Z][a-z]+|\d+[A-Za-z]?/g) ?? [typeName];
  return tokens.join('-').toLowerCase();
}

/**
 * Insert an import line after the last import sharing the category prefix
 * (preserves the category grouping in the aggregation files); falls back
 * to after the last import line.
 */
export function wireImport(filePath, importLine, categoryNeedle) {
  const src = readFileSync(filePath, 'utf8');
  if (src.includes(importLine)) return { filePath, action: 'already wired' };
  const lines = src.split('\n');
  let insertAt = -1;
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s+'/.test(lines[i])) {
      lastImport = i;
      if (lines[i].includes(categoryNeedle)) insertAt = i;
    }
  }
  const at = (insertAt >= 0 ? insertAt : lastImport) + 1;
  if (at === 0) fail(`no import lines found in ${filePath}`);
  lines.splice(at, 0, importLine);
  return { filePath, action: `insert at line ${at + 1}`, content: lines.join('\n') };
}
