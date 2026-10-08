/**
 * Label3D's `visibility_range_*`, measured to the centre of the box its lines span
 * (`label_3d.cpp:600-606`). The glyphs draw inside the label group as `Component.tsx` nests
 * them, so the distance runs through the group's parent. Driven by one scene render from 11 units.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useRef } from 'react';
import type { CanvasFontMetrics } from '../../../r3f/controls/native/text/runtimeFontMetrics';
import { createOpenSansCanvasFontMetrics } from '../../../r3f/controls/native/text/openSansCanvasFontMetrics';
import LabelGlyphs from './LabelGlyphs';
import type { Label3DProperties } from './types';
import { AlphaCutMode, BillboardMode, HorizontalAlignment, TextureFilter } from './types';
import { GEOMETRY_INSTANCE_DEFAULTS } from '../geometryinstance3d/types';
import { isRendered, manualCameraAt, renderScene } from '../../../r3f/testing/renderScene';
import {
  NO_VISIBILITY_RANGE,
  VisibilityRangeFadeMode,
  type VisibilityRange,
} from '../../../godot/visibilityRange';

const loader = vi.hoisted(() => ({ metrics: undefined as CanvasFontMetrics | undefined }));
vi.mock('../../../r3f/controls/native/text/sceneFontLoader', () => ({
  peekBundledCanvasFontMetrics: () => loader.metrics,
  onSceneFontMetricsSettled: () => () => {},
}));

beforeEach(() => {
  loader.metrics = createOpenSansCanvasFontMetrics('label3d-range-test-family');
});

function props(
  range: Partial<VisibilityRange>,
  overrides: Partial<Label3DProperties> = {}
): Label3DProperties {
  return {
    ...GEOMETRY_INSTANCE_DEFAULTS,
    name: 'L',
    text: 'Hi',
    pixel_size: 0.01,
    billboard: BillboardMode.BILLBOARD_DISABLED,
    modulate: { r: 1, g: 1, b: 1, a: 1 },
    outline_size: 0,
    outline_modulate: { r: 0, g: 0, b: 0, a: 1 },
    double_sided: true,
    font_size: 32,
    line_spacing: 0,
    horizontal_alignment: HorizontalAlignment.CENTER,
    no_depth_test: false,
    render_priority: 0,
    outline_render_priority: -1,
    alpha_cut: AlphaCutMode.DISABLED,
    alpha_scissor_threshold: 0.5,
    fixed_size: false,
    texture_filter: TextureFilter.LINEAR_WITH_MIPMAPS,
    visibilityRange: { ...NO_VISIBILITY_RANGE, ...range },
    ...overrides,
  };
}

function NestedLabel({ properties }: { properties: Label3DProperties }) {
  const nodeRef = useRef<THREE.Group | null>(null);
  return (
    <group ref={nodeRef}>
      <group scale={properties.pixel_size}>
        <LabelGlyphs nodeRef={nodeRef} properties={properties} />
      </group>
    </group>
  );
}

async function renderFrames(properties: Label3DProperties) {
  const camera = manualCameraAt({ x: 0, y: 0, z: 11 });
  const renderer = await ReactThreeTestRenderer.create(<NestedLabel properties={properties} />, { camera });
  await renderScene(renderer, camera);
  return renderer;
}

function textMesh(renderer: Awaited<ReturnType<typeof renderFrames>>): THREE.Mesh {
  return renderer.scene.findByType('Mesh').instance as THREE.Mesh;
}

describe('<LabelGlyphs> visibility range', () => {
  it('draws a label inside its range', async () => {
    expect(isRendered(textMesh(await renderFrames(props({ begin: 5, end: 20 }))))).toBe(true);
  });

  it('draws nothing of a label past its end', async () => {
    expect(isRendered(textMesh(await renderFrames(props({ end: 10 }))))).toBe(false);
  });

  it('blends a SELF label at the eased alpha across its end margin', async () => {
    // smoothstep(1 - (11 - 8) / 4) = 0.15625, and 0.15625 × 255 = 39.84 truncates to 39.
    const selfFade = { end: 10, endMargin: 2, fadeMode: VisibilityRangeFadeMode.SELF };
    const material = textMesh(await renderFrames(props(selfFade))).material as THREE.MeshBasicMaterial;
    expect(material.opacity).toBeCloseTo(39 / 255, 6);
  });

  it('measures to the line box centre, which a large line spacing moves off the origin', async () => {
    // The box centre sits line_spacing / 2 = 300 px below the origin, 3 units at pixel_size 0.01:
    // √(11² + 3²) ≈ 11.40 is past an end of 11.2, which the origin at 11 is short of.
    const spaced = props({ end: 11.2 }, { line_spacing: 600 });
    expect(isRendered(textMesh(await renderFrames(spaced)))).toBe(false);
  });
});
