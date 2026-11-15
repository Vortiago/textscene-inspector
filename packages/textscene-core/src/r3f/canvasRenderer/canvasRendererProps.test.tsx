/**
 * The `<Canvas>` props every canvas takes. happy-dom lays no element out, so a mounted `<Canvas>`
 * never configures a renderer: the source read pins that each canvas spreads the props, and the
 * probe pins what the shadow ask becomes.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useThree } from '@react-three/fiber';
import { CANVAS_RENDERER_GL, CANVAS_RENDERER_PROPS } from './canvasRendererProps';

const CANVAS_FILES = ['../TscnCanvas.tsx', '../components/Canvas2DStage/World2DCanvas.tsx'];

describe('CANVAS_RENDERER_PROPS', () => {
  it('asks for the percentage shadow preset', () => {
    expect(CANVAS_RENDERER_PROPS.shadows).toBe('percentage');
  });

  it('asks for no tone curve of its own, as Godot draws a root with no Environment linear', () => {
    // tone_mapper.h:177 defaults to LINEAR, and only an Environment changes it
    // (renderer_scene_render_rd.cpp:724-731). R3F applies ACES unless the canvas is `flat`.
    expect(CANVAS_RENDERER_PROPS.flat).toBe(true);
  });
});

describe('CANVAS_RENDERER_GL', () => {
  it("asks for a drawing buffer with no multisampling, as Godot's MSAA defaults to Disabled", () => {
    expect(CANVAS_RENDERER_GL.antialias).toBe(false);
  });
});

describe('each canvas', () => {
  it.each(CANVAS_FILES)('%s spreads the shared props and gl flags', (file) => {
    const source = readFileSync(join(import.meta.dirname, file), 'utf8');

    expect(source).toContain('{...CANVAS_RENDERER_PROPS}');
    expect(source).toMatch(/gl=\{(CANVAS_RENDERER_GL|\{ \.\.\.CANVAS_RENDERER_GL)/);
  });
});

/** Records the shadow map the renderer uses, as `WebGLShadowMap` reads it. */
function ShadowMapProbe({ seen }: { seen: { type: THREE.ShadowMapType; enabled: boolean } }) {
  const shadowMap = useThree((state) => state.gl.shadowMap);
  seen.type = shadowMap.type;
  seen.enabled = shadowMap.enabled;
  return null;
}

describe('the shadow preset', () => {
  it('lands the renderer on THREE.PCFShadowMap, so no shadow pass warns', async () => {
    const seen = { type: THREE.BasicShadowMap as THREE.ShadowMapType, enabled: false };

    await ReactThreeTestRenderer.create(<ShadowMapProbe seen={seen} />, {
      shadows: CANVAS_RENDERER_PROPS.shadows,
    });

    expect([seen.enabled, seen.type]).toEqual([true, THREE.PCFShadowMap]);
  });
});
