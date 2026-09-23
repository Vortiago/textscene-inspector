/**
 * The mechanical subset of the repo's prose rules (Simplified Technical English
 * and the Clean Code comment limit), for code comments and markdown alike.
 */

import { commentSpans } from './commentSpans';

/** One rule a stretch of prose breaks, with the text that breaks it. */
export interface ProseViolation {
  rule: string;
  found: string;
}

const CONTRACTION =
  /\b(?:(?:do|does|did|is|are|was|were|has|have|had|ca|wo|should|would|could|must|need)n['’]t|(?:it|that|there|what|here|let|he|she|who)['’]s|(?:we|they|you)['’](?:re|ve|ll|d)|I['’](?:m|ve|ll|d))\b/i;

/** Each surface rule, as the pattern that finds a break of it. */
const SURFACE_RULES: readonly { rule: string; pattern: RegExp }[] = [
  { rule: 'em dash', pattern: /—|\s–\s/ },
  { rule: 'contraction', pattern: CONTRACTION },
  // Case-sensitive, so the product name `VS Code` stays prose.
  { rule: 'Latin abbreviation', pattern: /\b(?:[eE]\.g\.|[iI]\.e\.|etc\.|vs\.?(?=\s))/ },
  { rule: 'via', pattern: /\bvia\b/i },
];

/** Code spans and URLs hold names and addresses, never prose. */
function proseOnly(text: string): string {
  return text.replace(/`[^`\n]*`/g, ' ').replace(/https?:\/\/\S+/g, ' ');
}

/** Every surface rule the text breaks, once per rule. */
export function surfaceViolations(text: string): ProseViolation[] {
  const prose = proseOnly(text);
  const violations: ProseViolation[] = [];
  for (const { rule, pattern } of SURFACE_RULES) {
    const hit = prose.match(pattern);
    if (hit) violations.push({ rule, found: hit[0] });
  }
  return violations;
}

/** A comment of more than this many prose lines breaks the Clean Code limit. */
export const MAX_COMMENT_LINES = 4;

/** A directive or tag line is input for a tool, not prose. */
const TOOL_LINE = /^(?:@|eslint-|prettier-|istanbul |c8 |#region|#endregion|<reference )/;

/** A licence or generator header keeps every line its owner wrote. */
const VERBATIM_BLOCK = /copyright|SPDX-License|GENERATED/i;

/** The text of each comment line, with its markers removed. */
function contentLines(comment: string): string[] {
  return comment
    .replace(/^\/\*+!?/, '')
    .replace(/\*+\/$/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\/\/+|\*+(?!\/)|;+)?\s?/, '').trimEnd());
}

/**
 * Prose lines of one comment: the non-empty lines before its first tag.
 * A `@param` description belongs to its tag, so everything after the first tag is skipped.
 */
export function proseLineCount(comment: string): number {
  if (VERBATIM_BLOCK.test(comment)) return 0;
  let count = 0;
  for (const line of contentLines(comment)) {
    const text = line.trim();
    if (text.startsWith('@')) break;
    if (text !== '' && !TOOL_LINE.test(text)) count++;
  }
  return count;
}

/** A comment as a reader sees it: adjacent line comments read as one block. */
export interface CommentBlock {
  index: number;
  text: string;
}

/** Comment blocks of a source file. Line comments on consecutive lines merge. */
export function commentBlocks(source: string, opts: { blockOnly?: boolean } = {}): CommentBlock[] {
  const blocks: CommentBlock[] = [];
  for (const span of commentSpans(source, opts)) {
    const last = blocks.at(-1);
    const gap = last ? source.slice(last.index + last.text.length, span.index) : '';
    const adjacentLineComment =
      last !== undefined && span.text.startsWith('//') && last.text.startsWith('//') && /^\n[ \t]*$/.test(gap);
    if (adjacentLineComment) last.text += gap + span.text;
    else blocks.push({ index: span.index, text: span.text });
  }
  return blocks;
}

/** Comment blocks of a `.tscn` file: runs of `;` lines. */
export function tscnCommentBlocks(source: string): CommentBlock[] {
  const blocks: CommentBlock[] = [];
  const run = /(?:^;[^\n]*(?:\n|$))+/gm;
  for (const match of source.matchAll(run)) {
    blocks.push({ index: match.index, text: match[0].replace(/\n$/, '') });
  }
  return blocks;
}

/** Every rule one comment block breaks: the surface rules and the line limit. */
export function commentViolations(comment: string): ProseViolation[] {
  if (VERBATIM_BLOCK.test(comment)) return [];
  const violations = surfaceViolations(comment);
  const lines = proseLineCount(comment);
  if (lines > MAX_COMMENT_LINES) {
    violations.push({ rule: 'comment over four lines', found: `${lines} lines` });
  }
  return violations;
}

/** Markdown prose: fenced blocks, HTML comments and frontmatter removed, lines kept. */
export function markdownProse(markdown: string): string {
  const blank = (block: string): string => block.replace(/[^\n]/g, ' ');
  return markdown
    .replace(/^---\n[\s\S]*?\n---\n/, blank)
    .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, blank)
    .replace(/<!--[\s\S]*?-->/g, blank);
}

/** Surface violations of a markdown file, one entry per offending line. */
export function markdownViolations(markdown: string): { line: number; violation: ProseViolation }[] {
  const found: { line: number; violation: ProseViolation }[] = [];
  markdownProse(markdown)
    .split('\n')
    .forEach((text, i) => {
      for (const violation of surfaceViolations(text)) found.push({ line: i + 1, violation });
    });
  return found;
}
