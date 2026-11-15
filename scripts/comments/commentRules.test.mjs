import { describe, expect, it } from 'vitest';
import { commentBlocks } from './commentBlocks.mjs';
import { commentFindings } from './commentRules.mjs';

const PRINT_WIDTH = 40;

/** The rules each comment of `text` breaks, one list per comment. */
function rulesOf(text) {
  return commentBlocks('file.ts', `const first = 1;\n${text}\nconst last = 2;\n`).map((block) =>
    commentFindings(block, PRINT_WIDTH).map((finding) => finding.rule)
  );
}

describe('commentFindings: one line', () => {
  it('passes a one-line comment', () => {
    expect(rulesOf('// Why it is so.')).toEqual([[]]);
  });

  it('passes a one-line doc comment written over three lines', () => {
    expect(rulesOf('/**\n * Why it is so.\n */')).toEqual([[]]);
  });

  it('fails a comment of two prose lines', () => {
    expect(rulesOf('// Why it is so,\n// and more.')).toEqual([['long-comment']]);
  });

  it('fails a one-line comment wider than the print width', () => {
    expect(rulesOf(`// ${'word '.repeat(9)}`)).toEqual([['long-comment']]);
  });

  it('counts the code before a trailing comment in its width', () => {
    expect(rulesOf('const wider = "a longer value"; // Why it is.')).toEqual([['long-comment']]);
  });

  it('passes the tag lines a tool reads below the prose line', () => {
    expect(rulesOf('/**\n * Why.\n *\n * @param x the input\n *   it reads\n */')).toEqual([[]]);
  });

  it('passes a tag line wider than the print width below the prose line', () => {
    expect(rulesOf(`/**\n * Why.\n * @param x ${'word '.repeat(9)}\n */`)).toEqual([[]]);
  });

  it('passes a coverage directive beside the prose line', () => {
    expect(rulesOf('// Why the branch never runs.\n// v8 ignore next')).toEqual([[]]);
  });

  it('passes a directive line beside the prose line', () => {
    expect(rulesOf('// Why the cast holds.\n// eslint-disable-next-line no-x')).toEqual([[]]);
  });

  it('passes a licence header of any length', () => {
    expect(rulesOf('/*\n * Copyright (c) Someone.\n * Licensed under MIT.\n */')).toEqual([[]]);
  });

  it('passes the stamp of a vendored copy', () => {
    expect(rulesOf('// canonical source: a/b.md@abc sha256:0 - vendored copy, do not edit here')).toEqual([
      [],
    ]);
  });
});

describe('commentFindings: what reads as a directive or a tag', () => {
  it('counts a prose line that starts with the word global', () => {
    expect(rulesOf('// Why it is so,\n// global uniforms read it.')).toEqual([['long-comment']]);
  });

  it('passes an eslint globals directive', () => {
    expect(rulesOf('/* global window, document: readonly */')).toEqual([[]]);
  });

  it('counts a prose line that starts with a scoped package name', () => {
    expect(rulesOf('// The previewer reads it from\n// @textscene/core, not the app.')).toEqual([
      ['long-comment'],
    ]);
  });
});

describe('commentFindings: file header', () => {
  it('fails a module header', () => {
    const [block] = commentBlocks('file.ts', '/** What the module is. */\n\nexport const a = 1;\n');
    expect(commentFindings(block, PRINT_WIDTH).map((finding) => finding.rule)).toEqual(['module-header']);
  });

  it('passes a directive at the top of a file', () => {
    const [block] = commentBlocks('file.ts', '// @vitest-environment happy-dom\n\nexport const a = 1;\n');
    expect(commentFindings(block, PRINT_WIDTH)).toEqual([]);
  });
});

describe('commentFindings: tool input above the first import', () => {
  const findingsAbove = (header) =>
    commentBlocks('file.ts', `${header}\nimport x from 'x';\n`).flatMap((block) =>
      commentFindings(block, PRINT_WIDTH)
    );

  it.each([
    ['a shebang', '#!/usr/bin/env node'],
    ['a type-check pragma', '// @ts-check'],
    ['an expected type error with its reason', '// @ts-expect-error the stub has no types'],
    ['an eslint-disable line with its reason', '/* eslint-disable no-console -- a CLI prints */'],
    ['a test environment', '// @vitest-environment happy-dom'],
    ['a triple-slash reference', '/// <reference types="vite/client" />'],
    ['a JSX pragma', '/** @jsxImportSource preact */'],
    ['a licence header', '/*!\n * Copyright (c) Someone.\n * Licensed under MIT.\n */'],
    ['an SPDX line', '// SPDX-License-Identifier: MIT'],
  ])('counts no rule for %s', (_, header) => {
    expect(findingsAbove(header)).toEqual([]);
  });
});

describe('commentFindings: work reference', () => {
  it('fails an issue number', () => {
    expect(rulesOf('// Fixed in #1913.')).toEqual([['work-reference']]);
  });

  it('fails a pull request number', () => {
    expect(rulesOf('// See PR 1921.')).toEqual([['work-reference']]);
  });

  it("passes an upstream project's issue, cited as that project's", () => {
    expect(rulesOf('// The advance bounds it, harfbuzz#1532.')).toEqual([[]]);
  });

  it('passes a hex colour', () => {
    expect(rulesOf('// It clears to #000000.')).toEqual([[]]);
  });

  it('fails an issue number in a tag line', () => {
    expect(rulesOf('/**\n * Why.\n * @see #1234\n */')).toEqual([['work-reference']]);
  });

  it('fails an issue number in a directive reason', () => {
    expect(rulesOf('// eslint-disable-next-line x -- #1234')).toEqual([['work-reference']]);
  });

  it('passes a colour written as code', () => {
    expect(rulesOf('// A grey `#333` background.')).toEqual([[]]);
  });

  it('passes a Godot citation', () => {
    expect(rulesOf('// label.cpp:272')).toEqual([[]]);
  });
});

describe('commentFindings: message', () => {
  it('names the limit and what the comment has', () => {
    const [block] = commentBlocks('file.ts', 'const a = 1;\n// One,\n// two,\n// three.\n');
    expect(commentFindings(block, PRINT_WIDTH)[0].message).toBe(
      `3 prose lines, widest 9 columns: a comment is one line of at most ${PRINT_WIDTH} columns`
    );
  });
});
