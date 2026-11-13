/**
 * A stand-in for `<BundledCanvasRun>` in a painter test: a mesh that carries the props the painter
 * hands a run of the bundled face. The test reads the layout, the tint and the place of the run,
 * and decodes no font. A test file mocks `text/BundledCanvasRun` with `{ default: BundledRunStub }`.
 */
import type * as THREE from 'three';
import type ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TextRunProps } from '../text/TextRunMesh';

type Scene = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>['scene'];

export function BundledRunStub(props: TextRunProps) {
  return <mesh renderOrder={props.renderOrder} userData={{ bundledRun: props }} />;
}

/** The props of the run `mesh` stands for, or undefined for a mesh that stands for none. */
export function bundledRunOf(mesh: THREE.Object3D): TextRunProps | undefined {
  return mesh.userData.bundledRun as TextRunProps | undefined;
}

/** The stub mesh of each run of the bundled face under `scene`, in draw order. */
export function bundledRunMeshes(scene: Scene): THREE.Mesh[] {
  return scene
    .findAllByType('Mesh')
    .map((found) => found.instance as THREE.Mesh)
    .filter((mesh) => bundledRunOf(mesh) !== undefined);
}

/** The runs of the bundled face under `scene`, in draw order. */
export function bundledRuns(scene: Scene): TextRunProps[] {
  return bundledRunMeshes(scene).map((mesh) => bundledRunOf(mesh)!);
}

/** The one run of the bundled face under `scene`. Throws for none and for more than one. */
export function onlyBundledRun(scene: Scene): TextRunProps {
  const runs = bundledRuns(scene);
  if (runs.length !== 1) throw new Error(`expected one run of the bundled face, got ${runs.length}`);
  return runs[0]!;
}

/** The glyphs of `run` in draw order, every line. */
export function runGlyphs(run: TextRunProps) {
  return run.layout.lines.flatMap((line) => line.glyphs);
}

/** Whitespace, and the U+200B a Label ends each paragraph with (`label.cpp:164`). */
const INKLESS = /^[\s\u200B]*$/;

/** How many glyphs of `run` draw ink. */
export function inkedGlyphCount(run: TextRunProps): number {
  return runGlyphs(run).filter((glyph) => !INKLESS.test(glyph.char)).length;
}

/** How many glyphs of each run of the bundled face under `scene` draw ink, in draw order. */
export function inkedGlyphCounts(scene: Scene): number[] {
  return bundledRuns(scene).map(inkedGlyphCount);
}

/** How far the pens of `run` reach, px: from its first glyph to the end of the advance of its last. */
export function runPenExtentPx(run: TextRunProps): number {
  const glyphs = runGlyphs(run);
  const first = glyphs[0];
  const last = glyphs.at(-1);
  return first && last ? last.x + last.advance - first.x : 0;
}
