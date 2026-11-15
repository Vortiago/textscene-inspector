import { describe, expect, it } from 'vitest';
import { commentBlocks } from './commentBlocks.mjs';

function blocksOf(text, path = 'file.ts') {
  return commentBlocks(path, text).map(({ startLine, endLine, lines }) => ({ startLine, endLine, lines }));
}

describe('commentBlocks', () => {
  it('joins line comments on consecutive lines into one block', () => {
    const text = 'const a = 1;\n// One.\n// Two.\nconst b = 2;\n';
    expect(blocksOf(text)).toEqual([{ startLine: 2, endLine: 3, lines: ['// One.', '// Two.'] }]);
  });

  it('splits line comments that a blank line separates', () => {
    const text = 'const a = 1;\n// One.\n\n// Two.\nconst b = 2;\n';
    expect(blocksOf(text).map((block) => block.startLine)).toEqual([2, 4]);
  });

  it('keeps a trailing comment apart from an own-line comment below it', () => {
    const text = 'const a = 1; // Trailing.\n// Own line.\nconst b = 2;\n';
    expect(blocksOf(text).map((block) => block.lines)).toEqual([['// Trailing.'], ['// Own line.']]);
  });

  it('reads a block comment as one block with each of its lines', () => {
    const text = 'const a = 1;\n/**\n * One.\n */\nfunction f() {}\n';
    expect(blocksOf(text)).toEqual([{ startLine: 2, endLine: 4, lines: ['/**', ' * One.', ' */'] }]);
  });

  it('never reads comment syntax inside a string, a template or a regex', () => {
    const text = "const s = '// no';\nconst t = `/* no */`;\nconst r = /\\/\\/ no/;\n";
    expect(blocksOf(text)).toEqual([]);
  });

  it('never reads comment syntax inside JSX text', () => {
    expect(blocksOf('const el = <p>// no</p>;\n', 'file.tsx')).toEqual([]);
  });

  it('reads a comment inside a JSX expression', () => {
    expect(blocksOf('const el = <p>{/* Yes. */}</p>;\n', 'file.tsx')).toEqual([
      { startLine: 1, endLine: 1, lines: ['/* Yes. */'] },
    ]);
  });

  it('reads a comment after the last statement', () => {
    expect(blocksOf('const a = 1;\n// End.\n')).toEqual([{ startLine: 2, endLine: 2, lines: ['// End.'] }]);
  });

  it('counts the code before a trailing comment in its widest column', () => {
    const [block] = commentBlocks('file.ts', 'const a = 1; // Trailing.\n');
    expect(block.widestColumn).toBe('const a = 1; // Trailing.'.length);
  });

  it('marks a comment before the first code and above a blank line as the file header', () => {
    const [block] = commentBlocks('file.ts', '/** A module. */\n\nimport x from "x";\n');
    expect(block.isFileHeader).toBe(true);
  });

  it('marks a comment that sits on the first statement as no file header', () => {
    const [block] = commentBlocks('file.ts', '// Registers the parsers.\nimport "./register";\n');
    expect(block.isFileHeader).toBe(false);
  });

  it('marks a comment after the first code as no file header', () => {
    const [, block] = commentBlocks('file.ts', '// A.\nconst a = 1;\n// B.\n\nconst b = 2;\n');
    expect(block.isFileHeader).toBe(false);
  });

  it('marks a comment in a file with no code as the file header', () => {
    const [block] = commentBlocks('file.ts', '// Only a comment.\n');
    expect(block.isFileHeader).toBe(true);
  });
});
