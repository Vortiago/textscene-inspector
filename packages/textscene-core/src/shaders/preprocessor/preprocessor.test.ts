import { describe, expect, it } from 'vitest';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { preprocess, type ShaderInclude } from './preprocessor.js';
import { PreprocessorError } from './preprocessorError.js';

/** A reader of `files`, by `res://` path. */
const reader =
  (files: Record<string, string>) =>
  (path: string): ShaderInclude | undefined =>
    Object.hasOwn(files, path) ? { path, code: files[path]! } : undefined;

const withFiles = (code: string, files: Record<string, string>) =>
  preprocess(code, { file: 'res://s.gdshader', readInclude: reader(files) });

/** The error `run` throws. */
function errorOf(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('expected an error, got none');
}

describe('directives', () => {
  it('keeps one line for each directive line', () => {
    expect(preprocess('#define K 1\na\n#undef K\nb').split('\n')).toHaveLength(4);
  });

  it('writes the taken branch of nested conditions and drops the others', () => {
    const code = '#define A\n#ifdef A\n#ifndef B\nx\n#else\ny\n#endif\n#else\nz\n#endif\n';
    expect(preprocess(code).replace(/\s+/g, ' ').trim()).toBe('x');
  });

  it('sets CURRENT_RENDERER from the rendering method, forward_plus when none is given', () => {
    expect(preprocess('CURRENT_RENDERER').trim()).toBe('2');
    expect(preprocess('CURRENT_RENDERER', { renderingMethod: 'gl_compatibility' }).trim()).toBe('0');
  });

  it("refuses #error with its text as Godot's message", () => {
    expect(errorOf(() => preprocess('a\n#error stop here\n'))).toMatchObject({
      reason: 'stop here',
      line: 1,
    });
  });

  it('copies the text after #pragma disable_preprocessor as it is', () => {
    expect(preprocess('#define K 1\n#pragma disable_preprocessor\n#define L\nK')).toBe('\n\n#define L\nK');
  });

  it('refuses #if as not transpiled yet, with its row', () => {
    const error = errorOf(() => preprocess('#if 1\n#endif'));
    expect(error).toBeInstanceOf(ShadingLanguageError);
    expect((error as ShadingLanguageError).owner).toBe('#1828');
  });
});

describe('includes', () => {
  it('writes an include inside an include between their markers', () => {
    const files = { 'res://a.gdshaderinc': '#include "b.gdshaderinc"\nA', 'res://b.gdshaderinc': 'B' };
    expect(withFiles('#include "a.gdshaderinc"\nC', files)).toBe(
      '@@>res://a.gdshaderinc\n@@>res://b.gdshaderinc\nB\n@@<res://b.gdshaderinc\n\nA\n@@<res://a.gdshaderinc\n\nC'
    );
  });

  it('includes a file once', () => {
    const files = { 'res://a.gdshaderinc': 'A' };
    expect(
      withFiles('#include "a.gdshaderinc"\n#include "./a.gdshaderinc"\n', files).match(/A/g)
    ).toHaveLength(1);
  });

  it("refuses a cycle with Godot's message, in the file that closes it", () => {
    const files = {
      'res://a.gdshaderinc': '#include "b.gdshaderinc"\nA',
      'res://b.gdshaderinc': '#include "a.gdshaderinc"\nB',
    };
    expect(errorOf(() => withFiles('#include "a.gdshaderinc"\n', files))).toMatchObject({
      reason: 'Cyclic include found: res://a.gdshaderinc',
      file: 'res://b.gdshaderinc',
      line: 0,
    });
  });

  it("refuses a missing file with Godot's message", () => {
    expect(errorOf(() => withFiles('\n#include "x.gdshaderinc"\n', {}))).toMatchObject({
      reason: 'Shader include file does not exist: res://x.gdshaderinc',
      line: 1,
    });
  });

  it('reads no file inside a skipped branch', () => {
    expect(withFiles('#ifdef NEVER\n#include "x.gdshaderinc"\n#endif\nA', {})).toBe('\n\n\nA');
  });

  it('refuses two files of the same text as a cycle, as Godot compares the hashes of the texts', () => {
    const files = {
      'res://a.gdshaderinc': '#include "b.gdshaderinc"\n',
      'res://b.gdshaderinc': '#include "a.gdshaderinc"\n',
    };
    expect(errorOf(() => withFiles('#include "a.gdshaderinc"\n', files))).toMatchObject({
      reason: 'Cyclic include found: res://b.gdshaderinc',
      file: 'res://a.gdshaderinc',
    });
  });

  it('refuses a chain of includes deeper than 25', () => {
    const files = Object.fromEntries(
      Array.from({ length: 27 }, (_, depth) => [
        `res://${depth}.gdshaderinc`,
        `#include "${depth + 1}.gdshaderinc"\n// ${depth}`,
      ])
    );
    expect(errorOf(() => withFiles('#include "0.gdshaderinc"\n', files))).toMatchObject({
      reason: 'Shader max include depth exceeded.',
    });
  });

  it('keeps a define an include makes for the text after it', () => {
    expect(
      withFiles('#include "d.gdshaderinc"\nK', { 'res://d.gdshaderinc': '#define K 5\n' })
        .trim()
        .endsWith('5')
    ).toBe(true);
  });
});

describe('a refused text', () => {
  it('throws PreprocessorError, which the front end answers with the text as it is', () => {
    expect(errorOf(() => preprocess('#frob'))).toBeInstanceOf(PreprocessorError);
  });
});
