/**
 * The Simplified Technical English (STE) checks a machine can decide on the prose of a
 * comparison sheet. `findProseViolations` takes the sheet text and returns each violation
 * with its line. It reads no file, so `sheets.test.mjs` and the Claude Code hook share it.
 */

import { isDivider, splitRow } from './markdownTable.mjs';

/** STE caps a sentence of description at 25 words. */
export const MAX_SENTENCE_WORDS = 25;

/** The HTML spec ends a comment at `-->` and also at `--!>` (the "incorrectly closed comment" state). */
const HTML_COMMENT_END = /--!?>/;

/** The `## Known limitations` heading, whose bullets each hold one sentence. */
const LIMITATIONS_HEADING = 'Known limitations';

/**
 * A unit after a number. The STE rules count a number with its unit as one word, and a
 * number with no unit stays a word of its own.
 */
const UNIT = String.raw`(?:px|pixels?|m|cm|mm|ms|s|seconds?|degrees?|°|%|frames?|fps|Hz)`;

/** One check on one line of prose: its rule name, and the pattern that finds a breach. */
const LINE_RULES = [
  // An en dash or a hyphen between two words or numbers joins them, so only a spaced one is a dash.
  { rule: 'dash', pattern: /—|\s[–-]\s/g },
  { rule: 'semicolon', pattern: /;/g },
  {
    rule: 'contraction',
    // A possessive `'s` stays, so `'s` counts only after a pronoun that cannot own.
    pattern:
      /\b(?:\w+n['’]t|(?:it|that|there|here|what|who|where|he|she|let)['’]s|\w+['’](?:re|ve|ll|d|m))\b/gi,
  },
  { rule: 'Latin abbreviation', pattern: /\b(?:e\.g\.|i\.e\.|etc\.|vs\.?|via|cf\.)(?=\W|$)/gi },
  {
    rule: 'praise or filler word',
    pattern:
      /\b(?:simply|easily|seamless(?:ly)?|just|robust(?:ly)?|powerful(?:ly)?|comprehensive(?:ly)?|utili[sz](?:e|es|ed|ing|ation)|leverag(?:e|es|ed|ing)|facilitat(?:e|es|ed|ing))\b/gi,
  },
];

/**
 * A replacer that turns a matched span into `word`. The newlines inside the span come first,
 * so every line keeps its number and a full stop after the span stays on the word.
 */
const spanAs = (word) => (match) => '\n'.repeat(match.split('\n').length - 1) + word;

/**
 * The prose of a block with every span the author does not write as prose replaced: a code
 * span becomes one word, a link keeps its text, and a URL and an HTML comment go.
 */
function maskInline(text) {
  return text
    .replace(new RegExp(`<!--[\\s\\S]*?${HTML_COMMENT_END.source}`, 'g'), spanAs(''))
    .replace(/(`+)[\s\S]*?\1/g, spanAs('CODE'))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<?https?:\/\/[^\s>)]+>?/g, 'URL')
    .replace(/\*\*|__/g, '');
}

/**
 * The hand-written prose of a sheet, as blocks of lines: a paragraph, a list item or a
 * table cell. Front matter, fenced code, the generated `lint:begin` section, HTML comments
 * and headings carry none. Each line keeps its 1-based number in the sheet.
 */

export function proseBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let current = null;
  let section = '';
  let skipUntil = null;
  const close = () => {
    if (current) blocks.push(current);
    current = null;
  };

  let i = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) i = end + 1;
  }
  for (; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const line = i + 1;
    if (skipUntil) {
      if (skipUntil.test(trimmed)) skipUntil = null;
      continue;
    }
    if (/^(```|~~~)/.test(trimmed)) {
      close();
      skipUntil = new RegExp(`^${trimmed.slice(0, 3)}`);
      continue;
    }
    if (/^<!-- lint:begin\b/.test(trimmed)) {
      close();
      skipUntil = /^<!-- lint:end -->/;
      continue;
    }
    if (trimmed.startsWith('<!--')) {
      close();
      if (!HTML_COMMENT_END.test(trimmed)) skipUntil = HTML_COMMENT_END;
      continue;
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(trimmed);
    if (heading) {
      close();
      section = heading[1].trim();
      continue;
    }
    if (trimmed === '') {
      close();
      continue;
    }
    if (trimmed.startsWith('|')) {
      close();
      if (isDivider(trimmed)) continue;
      for (const cell of splitRow(trimmed))
        blocks.push({ kind: 'cell', section, lines: [{ line, text: cell }] });
      continue;
    }
    const item = /^\s*(?:[-*+]|\d+\.)\s+(.*)$/.exec(raw);
    if (item) {
      close();
      // A bold label opens an item, such as a Known limitations tag, and is no word of its sentence.
      current = { kind: 'item', section, lines: [{ line, text: item[1].replace(/^\*\*[^*]+\*\*\s*/, '') }] };
      continue;
    }
    if (!current) current = { kind: 'paragraph', section, lines: [] };
    current.lines.push({ line, text: trimmed });
  }
  close();
  return blocks;
}

/** A block's prose, masked, as one string per line in the block's own line order. */
function maskedLines(block) {
  const masked = maskInline(block.lines.map((l) => l.text).join('\n')).split('\n');
  return block.lines.map((l, k) => ({ line: l.line, text: masked[k] ?? '' }));
}

/**
 * The words of a block, each with its line. A bracketed text, a quote, and a number with
 * its unit each count as one word, as the STE rules count them. A hyphenated word and a
 * code span are already one word once split at white space.
 */
function words(lines) {
  const grouped = lines
    .map((l) => l.text)
    .join('\n')
    // A bracketed sentence ends the sentence it closes.
    .replace(/\(([^()]*)\)/g, (m, inner) => spanAs(/[.!?]\s*$/.test(inner) ? 'BRACKET.' : 'BRACKET')(m))
    .replace(/"[^"]*"|“[^”]*”/g, spanAs('QUOTE'))
    .replace(new RegExp(String.raw`(\d)[ \t]+(${UNIT})(?=[\s.,:!?]|$)`, 'g'), '$1$2');
  const out = [];
  grouped.split('\n').forEach((text, k) => {
    for (const word of text.split(/\s+/)) {
      if (/\w/.test(word)) out.push({ word, line: lines[k].line });
    }
  });
  return out;
}

/** The sentences of a block, each as its words. A word that ends in `.`, `!` or `?` ends one. */
function sentences(block) {
  const all = [];
  let current = [];
  for (const w of words(maskedLines(block))) {
    current.push(w);
    if (/[.!?]["'”’)\]]*$/.test(w.word)) {
      all.push(current);
      current = [];
    }
  }
  if (current.length) all.push(current);
  return all;
}

/** The breaches of the per-line rules in one block. */
function lineViolations(block) {
  return maskedLines(block).flatMap(({ line, text }) =>
    LINE_RULES.flatMap(({ rule, pattern }) =>
      [...text.matchAll(pattern)].map((m) => ({ line, rule, text: m[0].trim() }))
    )
  );
}

/** The source of the line a sentence starts on, short enough to quote in a report. */
function excerpt(block, sentence) {
  const text = block.lines.find((l) => l.line === sentence[0].line).text;
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

/** The sentences over the STE limit in one block. */
function longSentences(block) {
  return sentences(block)
    .filter((s) => s.length > MAX_SENTENCE_WORDS)
    .map((s) => ({ line: s[0].line, rule: `sentence of ${s.length} words`, text: excerpt(block, s) }));
}

/** The second sentence of a Known limitations bullet, which the sheet standard allows one. */
function multiSentenceLimitation(block) {
  if (block.kind !== 'item' || block.section !== LIMITATIONS_HEADING) return [];
  const found = sentences(block);
  if (found.length <= 1) return [];
  const second = found[1];
  return [
    { line: second[0].line, rule: `limitation of ${found.length} sentences`, text: excerpt(block, second) },
  ];
}

/**
 * Every STE violation in a sheet's prose, in line order. Each holds the 1-based `line`, the
 * `rule` it breaks, and the offending `text`. An empty array means the prose passes.
 */
export function findProseViolations(text) {
  return proseBlocks(text)
    .flatMap((block) => [
      ...lineViolations(block),
      ...longSentences(block),
      ...multiSentenceLimitation(block),
    ])
    .sort((a, b) => a.line - b.line);
}

/** One violation as `label:line: rule: text`, the form a report and the hook print. */
export const formatViolation = (label, v) => `${label}:${v.line}: ${v.rule}: ${v.text}`;

/** True for a path the sheet checks apply to: a slice's `comparison.md`, or a showcase sheet. */
export const isSheetPath = (path) =>
  /(^|[\\/])comparison\.md$/.test(path) ||
  /(^|[\\/])docs[\\/]comparison[\\/]sheets[\\/][^\\/]+\.md$/.test(path);
