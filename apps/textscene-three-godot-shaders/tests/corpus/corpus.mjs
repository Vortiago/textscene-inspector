/**
 * The corpus of real shaders as the tests read it: each entry of `corpus.json` with its text.
 * `pnpm shaders:corpus` writes both, and `pnpm godot:probes` records Godot's verdict on each.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const entries = JSON.parse(readFileSync(join(import.meta.dirname, 'corpus.json'), 'utf8'));

export const CORPUS = entries.map((entry) => ({
  ...entry,
  text: readFileSync(join(import.meta.dirname, 'shaders', entry.file), 'utf8'),
}));
