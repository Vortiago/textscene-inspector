import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';

/**
 * Writes each case file into a new or empty folder, so no file of the caller's is overwritten.
 *
 * @canonical Write the Godot load oracle's case files to a folder
 * @param {string | undefined} out the folder
 * @param {readonly { file: string, text: string }[]} cases each file name with its extension, and its text
 * @returns {number} the number of files written
 */
export function writeCaseFiles(out, cases) {
  if (!out) throw new Error('expected a folder to write the cases to, got no argument');
  if (existsSync(out) && readdirSync(out).length > 0) throw new Error(`expected an empty folder, got ${out}`);
  mkdirSync(out, { recursive: true });
  for (const { file, text } of cases) writeFileSync(`${out}/${file}`, text);
  return cases.length;
}
