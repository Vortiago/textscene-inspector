import { commentBlocks } from './commentBlocks.mjs';
import { commentFindings } from './commentRules.mjs';

const SOURCE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const NOT_OURS = /\.generated\.|(?:^|\/)vendor\//;
/** A generator writes every comment of its file, and its stamp in the first 300 characters. */
const GENERATED_STAMP = /GENERATED/;
const STAMP_SEARCH_CHARS = 300;

export function isCheckedSource(path) {
  return SOURCE.test(path) && !NOT_OURS.test(path);
}

/** The findings in each comment that holds a 1-based line of `added`, or in every comment for `'all'`. */
export function touchedFindings(text, path, added, printWidth) {
  if (GENERATED_STAMP.test(text.slice(0, STAMP_SEARCH_CHARS))) return [];
  const isTouched = (block) => {
    if (added === 'all') return true;
    for (let line = block.startLine; line <= block.endLine; line++) if (added.has(line)) return true;
    return false;
  };
  return commentBlocks(path, text)
    .filter(isTouched)
    .flatMap((block) =>
      commentFindings(block, printWidth).map((finding) => ({ path, line: block.startLine, ...finding }))
    );
}
