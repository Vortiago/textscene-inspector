import { describe, expect, it } from 'vitest';

import {
  MAX_SENTENCE_WORDS,
  findProseViolations,
  formatViolation,
  isSheetPath,
  proseBlocks,
} from './sheetProse.mjs';

/** The rules a text breaks, in line order. */
const rules = (text) => findProseViolations(text).map((v) => v.rule);

/** A sentence of `count` plain words. */
const sentenceOf = (count) => `${Array.from({ length: count - 1 }, () => 'word').join(' ')} end.`;

describe('findProseViolations', () => {
  it('passes plain STE prose', () => {
    expect(findProseViolations('# Node\n\nThe previewer draws the node as a box.\n')).toEqual([]);
  });

  it('reports the line and the offending text', () => {
    const text = '---\ntype: Node\n---\n\n# Node\n\nIt draws; it fades.\n';
    expect(findProseViolations(text)).toEqual([{ line: 7, rule: 'semicolon', text: ';' }]);
  });

  describe('dashes', () => {
    it('flags an em dash', () => {
      expect(rules('A box — and a ball.')).toEqual(['dash']);
    });

    it('flags a spaced en dash or hyphen', () => {
      expect(rules('A box – a ball.\n\nA box - a ball.')).toEqual(['dash', 'dash']);
    });

    it('keeps an en dash in a range and a hyphenated word', () => {
      expect(rules('Pages 3–5 hold a right-to-left label.')).toEqual([]);
    });
  });

  it('flags a contraction', () => {
    expect(rules("It doesn't draw.\n\nIt's absent.")).toEqual(['contraction', 'contraction']);
  });

  it("keeps a possessive 's", () => {
    expect(rules("Godot's light matches the node's own.")).toEqual([]);
  });

  it('flags a Latin abbreviation', () => {
    expect(rules('A light, e.g. a lamp.\n\nA light, i.e. a lamp.\n\nIt reads via the parser.')).toEqual([
      'Latin abbreviation',
      'Latin abbreviation',
      'Latin abbreviation',
    ]);
  });

  it('flags a praise or filler word', () => {
    expect(rules('It simply draws.\n\nIt leverages the cache.')).toEqual([
      'praise or filler word',
      'praise or filler word',
    ]);
  });

  describe('what is not prose', () => {
    it('skips a code span', () => {
      expect(rules('It reads `a; b — e.g.` as written.')).toEqual([]);
    });

    it('skips the front matter', () => {
      expect(rules('---\nrenders_as: a box; a ball\n---\n\nIt draws.')).toEqual([]);
    });

    it('skips fenced code', () => {
      expect(rules('```\nlet a = 1;\n```\n\nIt draws.')).toEqual([]);
    });

    it('skips the generated lint section', () => {
      expect(rules('<!-- lint:begin Node -->\nAn error; a warning.\n<!-- lint:end -->\n\nIt draws.')).toEqual(
        []
      );
    });

    it('skips an HTML comment', () => {
      expect(rules('<!-- compare: image=a; status=done -->\n\nIt draws.')).toEqual([]);
    });

    it('skips a heading', () => {
      expect(rules('## Metallic; roughness\n\nIt draws.')).toEqual([]);
    });

    it('skips the target of a link but checks its text', () => {
      expect(rules('See [the docs](https://example.com/a;b).')).toEqual([]);
      expect(rules('See [the docs; all](https://example.com).')).toEqual(['semicolon']);
    });

    it('checks the prose of a table cell and skips its code', () => {
      const table = '| Key | Means |\n| --- | --- |\n| `a;b` | one; two |';
      expect(findProseViolations(table)).toEqual([{ line: 3, rule: 'semicolon', text: ';' }]);
    });
  });

  describe('sentence length', () => {
    it(`passes a sentence of ${MAX_SENTENCE_WORDS} words`, () => {
      expect(rules(sentenceOf(MAX_SENTENCE_WORDS))).toEqual([]);
    });

    it(`flags a sentence of ${MAX_SENTENCE_WORDS + 1} words`, () => {
      expect(rules(sentenceOf(MAX_SENTENCE_WORDS + 1))).toEqual([
        `sentence of ${MAX_SENTENCE_WORDS + 1} words`,
      ]);
    });

    it('counts a code span, a bracketed text, a quote and a number with its unit as one word each', () => {
      const grouped = '`a b c` (d e f) "g h i" 5 px';
      expect(rules(`${grouped} ${sentenceOf(MAX_SENTENCE_WORDS - 4)}`)).toEqual([]);
      expect(rules(`${grouped} ${sentenceOf(MAX_SENTENCE_WORDS - 3)}`)).toHaveLength(1);
    });

    it('reports a wrapped sentence at the line it starts on', () => {
      const words = sentenceOf(MAX_SENTENCE_WORDS + 1).split(' ');
      const text = `First sentence. ${words.slice(0, 10).join(' ')}\n${words.slice(10).join(' ')}`;
      expect(findProseViolations(`intro\n\n${text}`).map((v) => v.line)).toEqual([3]);
    });

    it('ends a sentence at a full stop after a span that wraps', () => {
      const half = sentenceOf(15).slice(0, -1);
      expect(rules(`${half} (a\nb). ${half}.`)).toEqual([]);
    });
  });

  describe('Known limitations', () => {
    it('flags a bullet of two sentences', () => {
      const text = '## Known limitations\n\n- **Not drawn** Godot draws it.\n  Here it is absent.';
      expect(findProseViolations(text)).toEqual([
        { line: 4, rule: 'limitation of 2 sentences', text: 'Here it is absent.' },
      ]);
    });

    it('passes a bullet of one sentence', () => {
      expect(rules('## Known limitations\n\n- **Not drawn** Godot draws it, but here it is absent.')).toEqual(
        []
      );
    });

    it('allows two sentences in a bullet of another section', () => {
      expect(rules('## Linting\n\n- It warns. It falls back.')).toEqual([]);
    });

    it('does not count the bold tag as a word', () => {
      const bullet = `- **Shader missing** ${sentenceOf(MAX_SENTENCE_WORDS)}`;
      expect(rules(`## Known limitations\n\n${bullet}`)).toEqual([]);
    });
  });
});

describe('proseBlocks', () => {
  it('splits paragraphs, items and cells, each under its section', () => {
    const text = '# A\n\nOne\ntwo.\n\n## B\n\n- Item.\n\n| X |\n| --- |\n| Cell. |';
    expect(proseBlocks(text).map((b) => [b.kind, b.section, b.lines.map((l) => l.line)])).toEqual([
      ['paragraph', 'A', [3, 4]],
      ['item', 'B', [8]],
      ['cell', 'B', [10]],
      ['cell', 'B', [12]],
    ]);
  });
});

describe('formatViolation', () => {
  it('prints the label, the line, the rule and the text', () => {
    expect(formatViolation('a/comparison.md', { line: 3, rule: 'semicolon', text: ';' })).toBe(
      'a/comparison.md:3: semicolon: ;'
    );
  });
});

describe('isSheetPath', () => {
  it('accepts a slice sheet and a showcase sheet', () => {
    expect(isSheetPath('/r/packages/textscene-core/src/nodes/3d/x/comparison.md')).toBe(true);
    expect(isSheetPath('C:\\r\\docs\\comparison\\sheets\\complex-materials.md')).toBe(true);
  });

  it('refuses any other file', () => {
    expect(isSheetPath('/r/docs/comparison/README.md')).toBe(false);
    expect(isSheetPath('/r/packages/textscene-core/src/nodes/3d/x/parser.ts')).toBe(false);
    expect(isSheetPath('/r/notcomparison.md')).toBe(false);
  });
});
