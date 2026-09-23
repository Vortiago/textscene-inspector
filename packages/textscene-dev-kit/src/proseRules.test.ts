import { describe, expect, it } from 'vitest';
import {
  commentBlocks,
  commentViolations,
  markdownViolations,
  proseLineCount,
  surfaceViolations,
  tscnCommentBlocks,
} from './proseRules';

const rules = (text: string): string[] => surfaceViolations(text).map((v) => v.rule);

describe('surfaceViolations', () => {
  it('passes plain STE prose', () => {
    expect(rules('The parser reads the file. It does not write it.')).toEqual([]);
  });

  it('finds each surface rule', () => {
    expect(rules('It is fast — see e.g. the cache')).toEqual(['em dash', 'Latin abbreviation']);
    expect(rules("It doesn't read it")).toEqual(['contraction']);
    expect(rules('It’s read via the loader')).toEqual(['contraction', 'via']);
    expect(rules('a spaced – en dash, and vs. the other')).toEqual(['em dash', 'Latin abbreviation']);
  });

  it('keeps a possessive and an unspaced range', () => {
    expect(rules("the user's call covers pages 1–3")).toEqual([]);
  });

  it('ignores a markdown link target', () => {
    expect(rules('See [ADR-0011](docs/adr/0011-audio-via-mixer.md).')).toEqual([]);
  });

  it('ignores code spans and URLs', () => {
    expect(rules('Reads `a — b` and `e.g.` from https://example.com/via/it')).toEqual([]);
  });

  it('reads a word that only contains a rule as prose', () => {
    expect(rules('viable trivia, versus')).toEqual([]);
  });

  it('keeps the product name VS Code', () => {
    expect(rules('Open it in VS Code.')).toEqual([]);
  });
});

describe('proseLineCount', () => {
  it('counts the prose lines of a block comment', () => {
    expect(proseLineCount('/**\n * One.\n *\n * Two.\n */')).toBe(2);
  });

  it('stops at the first tag', () => {
    expect(proseLineCount('/**\n * One.\n * @param a the first\n *   and more\n */')).toBe(1);
  });

  it('skips tool directives and verbatim headers', () => {
    expect(proseLineCount('// eslint-disable-next-line no-console')).toBe(0);
    expect(proseLineCount('/*\n * Copyright 2024 A\n * a\n * b\n * c\n * d\n */')).toBe(0);
  });

  it('counts the lines of a .tscn comment', () => {
    expect(proseLineCount('; One.\n;\n; Two.')).toBe(2);
  });
});

describe('commentBlocks', () => {
  it('merges line comments on consecutive lines', () => {
    const source = 'const a = 1;\n// one\n  // two\nconst b = 2;\n// three\n';
    expect(commentBlocks(source).map((b) => b.text)).toEqual(['// one\n  // two', '// three']);
  });

  it('keeps a block comment apart from a line comment beside it', () => {
    const source = '/* a */\n// b\n';
    expect(commentBlocks(source).map((b) => b.text)).toEqual(['/* a */', '// b']);
  });

  it('keeps line comments apart across a blank line', () => {
    expect(commentBlocks('// a\n\n// b\n')).toHaveLength(2);
  });
});

describe('tscnCommentBlocks', () => {
  it('finds each run of comment lines', () => {
    const source = '; a\n; b\n[gd_scene format=3]\n; c\n';
    expect(tscnCommentBlocks(source).map((b) => b.text)).toEqual(['; a\n; b', '; c']);
  });

  it('finds nothing in a scene without comments', () => {
    expect(tscnCommentBlocks('[gd_scene format=3]\n')).toEqual([]);
  });
});

describe('commentViolations', () => {
  it('flags a comment over four prose lines', () => {
    const comment = '// a\n// b\n// c\n// d\n// e';
    expect(commentViolations(comment)).toEqual([{ rule: 'comment over four lines', found: '5 lines' }]);
  });

  it('passes a four-line comment', () => {
    expect(commentViolations('// a\n// b\n// c\n// d')).toEqual([]);
  });

  it('reads an auto-generated remark as prose', () => {
    expect(commentViolations('// The list is auto-generated — a\n// b\n// c\n// d\n// e')).toHaveLength(2);
  });

  it('exempts a licence header whole', () => {
    expect(commentViolations('/* Copyright — a\n b\n c\n d\n e */')).toEqual([]);
  });
});

describe('markdownViolations', () => {
  it('reports the line of each violation', () => {
    const found = markdownViolations('# Title\n\nIt is fast — mostly.\n');
    expect(found).toEqual([{ line: 3, violation: { rule: 'em dash', found: '—' } }]);
  });

  it('ignores fenced code, HTML comments and frontmatter', () => {
    const markdown = '---\ndescription: a — b\n---\n```\nx — y\n```\n<!-- e.g. -->\nPlain.\n';
    expect(markdownViolations(markdown)).toEqual([]);
  });

  it('ignores a generated lint section', () => {
    const markdown = '<!-- lint:begin Area2D -->\n| `a` | any Variant — typed later |\n<!-- lint:end -->\nPlain.\n';
    expect(markdownViolations(markdown)).toEqual([]);
  });

  it('keeps line numbers after a removed block', () => {
    const found = markdownViolations('```\na\nb\n```\nvia here\n');
    expect(found.map((f) => f.line)).toEqual([5]);
  });
});
