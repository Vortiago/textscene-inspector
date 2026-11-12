/**
 * A Label3D is a GeometryInstance3D, so `material_override` draws each of its surfaces in place
 * of the glyph material and `material_overlay` draws each again
 * (`render_forward_clustered.cpp:4206`, `:4228-4241`). The outline is surface 0 and the fill
 * surface 1 (`label_3d.cpp:610-615`).
 */
import { describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { albedoOf, instanceAs } from '../testing/reactThreeTestInstance';
import { subResource } from '../../../testing/subResource';
import { TRIANGLE_OUTLINES } from '../../../r3f/controls/native/testing/triangleOutlines';
import LabelGlyphs from './LabelGlyphs';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { withGeometryInstance } from '../../../r3f/visibilityRange/geometryInstance';
import type { TscnInternalResource } from '../../../parser/types';
import type { Label3DProperties } from './types';
import { labelProperties } from './testing/labelProperties';
import { AlphaCutMode } from '../../../godot/rendering/materials/alphaCut';

// One triangle for each glyph of the bundled font, so no test decodes the font.
vi.mock('../../../r3f/controls/native/text/sceneFontOutlines', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  peekOutlines: () => TRIANGLE_OUTLINES,
}));

const INTERNALS: readonly TscnInternalResource[] = [
  subResource('StandardMaterial3D', 'Mat_override', { albedo_color: 'Color(1, 0, 0, 1)' }),
  subResource('StandardMaterial3D', 'Mat_overlay', { albedo_color: 'Color(0, 0, 1, 1)' }),
  subResource('StandardMaterial3D', 'Mat_alpha_overlay', {
    albedo_color: 'Color(0, 0, 1, 0.5)',
    transparency: '1',
  }),
];

const ScopedGlyphs = withGeometryInstance(({ node }: NodeComponentProps) => (
  <LabelGlyphs nodeRef={{ current: null }} properties={node.properties as Label3DProperties} />
));

/** Every mesh an outlined one-line label draws, in scene-graph order. */
async function drawnMeshes(overrides: Partial<Label3DProperties>): Promise<THREE.Mesh[]> {
  const properties = labelProperties({ outline_size: 8, ...overrides });
  const node = { name: 'L', type: 'Label3D', rawProperties: {}, children: [], properties };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={INTERNALS}>
      <ScopedGlyphs node={node} />
    </SceneResourcesProvider>
  );
  return renderer.scene.findAllByType('Mesh').map((mesh) => instanceAs<THREE.Mesh>(mesh));
}

function mapOf(mesh: THREE.Mesh): THREE.Texture | null {
  return (mesh.material as THREE.MeshBasicMaterial).map;
}

describe('<LabelGlyphs> instance materials', () => {
  it('draws the outline and the fill with their glyph rasters when the node sets neither', async () => {
    const drawn = await drawnMeshes({});

    expect(drawn.map((mesh) => mapOf(mesh) !== null)).toEqual([true, true]);
  });

  it('draws material_override on both surfaces in place of the glyph material', async () => {
    const drawn = await drawnMeshes({ materialOverride: 'SubResource("Mat_override")' });

    expect(drawn.map(albedoOf)).toEqual(['ff0000', 'ff0000']);
    expect(drawn.map(mapOf)).toEqual([null, null]);
  });

  it('draws material_overlay as a second draw of each surface', async () => {
    const [outline, outlineOverlay, fill, fillOverlay] = await drawnMeshes({
      materialOverlay: 'SubResource("Mat_overlay")',
    });

    expect([mapOf(outline!) !== null, mapOf(fill!) !== null]).toEqual([true, true]);
    expect([albedoOf(outlineOverlay!), albedoOf(fillOverlay!)]).toEqual(['0000ff', '0000ff']);
    expect(outlineOverlay!.geometry).toBe(outline!.geometry);
    expect(fillOverlay!.geometry).toBe(fill!.geometry);
  });

  it('sorts an alpha-pass overlay as Godot does: the outline, the fill overlay, the fill, the outline overlay', async () => {
    const [outline, outlineOverlay, fill, fillOverlay] = await drawnMeshes({
      materialOverlay: 'SubResource("Mat_alpha_overlay")',
    });
    const inDrawOrder = [outline!, outlineOverlay!, fill!, fillOverlay!].sort(
      (a, b) => a.renderOrder - b.renderOrder
    );

    expect(inDrawOrder).toEqual([outline, fillOverlay, fill, outlineOverlay]);
  });

  it('draws the outline after the fill where the two share a render priority, newest first', async () => {
    const [outline, fill] = await drawnMeshes({ outline_render_priority: 0 });

    expect(outline!.renderOrder).toBeGreaterThan(fill!.renderOrder);
  });

  it('sorts an alpha-pass overlay at one priority: the fill overlay, the fill, the outline overlay, the outline', async () => {
    const [outline, outlineOverlay, fill, fillOverlay] = await drawnMeshes({
      outline_render_priority: 0,
      materialOverlay: 'SubResource("Mat_alpha_overlay")',
    });
    const inDrawOrder = [outline!, outlineOverlay!, fill!, fillOverlay!].sort(
      (a, b) => a.renderOrder - b.renderOrder
    );

    expect(inDrawOrder).toEqual([fillOverlay, fill, outlineOverlay, outline]);
  });

  it('sorts an opaque overlay of a cut label after the surface it covers', async () => {
    const [outline, outlineOverlay, fill, fillOverlay] = await drawnMeshes({
      alpha_cut: AlphaCutMode.DISCARD,
      materialOverlay: 'SubResource("Mat_overlay")',
    });

    expect(outlineOverlay!.renderOrder).toBeGreaterThan(outline!.renderOrder);
    expect(fillOverlay!.renderOrder).toBeGreaterThan(fill!.renderOrder);
  });

  it('drops the render priorities of the glyph material under an override', async () => {
    const drawn = await drawnMeshes({
      materialOverride: 'SubResource("Mat_override")',
      render_priority: 5,
      outline_render_priority: -5,
    });

    expect(drawn.map((mesh) => Math.round(mesh.renderOrder))).toEqual([0, 0]);
  });

  it('casts and receives as the override does, whatever the glyph material would', async () => {
    const own = await drawnMeshes({});
    const overridden = await drawnMeshes({ materialOverride: 'SubResource("Mat_override")' });

    expect(own.map((mesh) => [mesh.castShadow, mesh.receiveShadow])).toEqual([
      [false, false],
      [false, false],
    ]);
    expect(overridden.map((mesh) => [mesh.castShadow, mesh.receiveShadow])).toEqual([
      [true, true],
      [true, true],
    ]);
  });
});
