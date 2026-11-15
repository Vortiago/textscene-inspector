import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const entries = JSON.parse(readFileSync(join(import.meta.dirname, 'corpus.json'), 'utf8'));

export const CORPUS = entries.map((entry) => ({
  ...entry,
  text: readFileSync(join(import.meta.dirname, 'shaders', entry.file), 'utf8'),
}));
