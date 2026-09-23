// Prints the verifier reports of one wave run from its Workflow journal, one block per batch.
// Usage: node .sweep/summary.mjs <journal.jsonl>
import console from 'node:console';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const results = readFileSync(process.argv[2], 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '')
  .map((line) => JSON.parse(line))
  .filter((entry) => entry.type === 'result' && entry.result && typeof entry.result === 'object');

/** The last report per batch is the verifier's, because it runs after the editor. */
const byBatch = new Map();
for (const { result } of results) byBatch.set(result.batch, result);

const list = (title, entries) => {
  if (!entries || entries.length === 0) return;
  console.log(`  ${title}:`);
  for (const { file, detail } of entries) console.log(`    ${file}: ${detail}`);
};

for (const report of byBatch.values()) {
  console.log(
    `${report.batch}: changed ${report.changed}, check ${report.checkFindings}, ` +
      `lost ${report.keepListLost}, code-changed ${report.codeChangedFiles?.length ?? 0}`
  );
  list('dead code', report.deadCode);
  list('candidates', report.candidates);
  list('unplaced', report.unplaced);
}
