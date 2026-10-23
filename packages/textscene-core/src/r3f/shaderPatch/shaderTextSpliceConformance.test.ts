/**
 * A program's own text is spliced through `chunkPatch.ts` or not at all. A raw `.replace` on shader
 * text, or a write of a whole chunk, does nothing when three moves the anchor, so the material
 * draws wrong with no error.
 * Test files are out of scope: they build shader text to drive an assertion.
 */
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { repoRoot } from '../../parser/testing/parserKit';
import {
  isProductionSource,
  offendingLines,
  RENDERER_ROOT,
  reportOffenders,
  repoPath,
  walkSources,
} from '../testing/sourceScan';

const SCANNED_ROOTS = ['apps', 'packages', 'scripts'];
const SOURCES = walkSources(
  SCANNED_ROOTS.map((dir) => resolve(repoRoot(), dir)),
  isProductionSource
);

/** The one module that may call `.replace` on shader text: it applies every edit through `applyEdit`. */
const SPLICE_MODULE = 'packages/textscene-core/src/r3f/shaderPatch/chunkPatch.ts';

/** A file names shader text when it reads or writes three's shader chunks, programs or a program's source. */
const SHADER_TEXT = /ShaderChunk|ShaderLib|onBeforeCompile|vertexShader|fragmentShader/;

/** The renderer's files, and any other file that names shader text. */
const SHADER_SOURCES = SOURCES.filter(
  ({ file, source }) =>
    repoPath(file) !== SPLICE_MODULE && (repoPath(file).startsWith(RENDERER_ROOT) || SHADER_TEXT.test(source))
);

const STRING_REPLACE = /\.(replace|replaceAll)\(/;

/** An assignment to a named chunk, as `ShaderChunk[name] = text` or `ShaderChunk.name = text`. */
const CHUNK_ASSIGNMENT = /ShaderChunk(\[[^\]]*\]|\.\w+)\s*=[^=]/;

describe('shader text splices', () => {
  it('scans the renderer’s shader patches', () => {
    const scanned = SHADER_SOURCES.map(({ file }) => repoPath(file));
    expect(scanned).toContain(`${RENDERER_ROOT}materials/godotAlphaHash.ts`);
  });

  it('calls no `.replace` or `.replaceAll` outside chunkPatch.ts', () => {
    expect(reportOffenders(SHADER_SOURCES, (source) => offendingLines(source, STRING_REPLACE))).toEqual([]);
  });

  it('assigns no chunk of three outside chunkPatch.ts', () => {
    expect(reportOffenders(SHADER_SOURCES, (source) => offendingLines(source, CHUNK_ASSIGNMENT))).toEqual([]);
  });
});
