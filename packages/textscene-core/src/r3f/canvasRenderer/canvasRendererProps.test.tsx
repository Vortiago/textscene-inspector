import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Canvas, useThree } from '@react-three/fiber';
import { World2DCanvas } from '../world2D/World2DCanvas';
import { StageViewStore } from '../world2D/stageView';
import { TscnCanvas } from '../TscnCanvas';
import { CANVAS_RENDERER_GL, CANVAS_RENDERER_PROPS } from './canvasRendererProps';

// happy-dom creates no WebGL context, so each canvas test reads the props its `<Canvas>` receives.
vi.mock('@react-three/fiber', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-three/fiber')>()),
  Canvas: vi.fn(() => null),
}));

const CANVASES: [string, () => ReactElement][] = [
  ['TscnCanvas', () => <TscnCanvas />],
  [
    'World2DCanvas',
    () => (
      <World2DCanvas
        nodes={[]}
        internalResources={[]}
        externalResources={[]}
        view={new StageViewStore({ pan: { x: 0, y: 0 }, zoom: 1 })}
      />
    ),
  ],
];

function canvasPropsOf(canvas: () => ReactElement) {
  vi.mocked(Canvas).mockClear();
  render(canvas());
  return vi.mocked(Canvas).mock.calls.at(-1)![0];
}

describe('CANVAS_RENDERER_PROPS', () => {
  it('asks for the percentage shadow preset', () => {
    expect(CANVAS_RENDERER_PROPS.shadows).toBe('percentage');
  });

  it('asks for no tone curve of its own, as Godot draws a root with no Environment linear', () => {
    // `tone_mapper.h:177` defaults to LINEAR, and R3F applies ACES unless the canvas is `flat`.
    expect(CANVAS_RENDERER_PROPS.flat).toBe(true);
  });
});

describe('CANVAS_RENDERER_GL', () => {
  it("asks for a drawing buffer with no multisampling, as Godot's MSAA defaults to Disabled", () => {
    expect(CANVAS_RENDERER_GL.antialias).toBe(false);
  });

  it('enables local clipping, without which a ScrollContainer clips nothing and nothing reports it', () => {
    // The 3D canvas needs it too: a Control SubViewport a 3D scene samples renders through its renderer.
    expect(CANVAS_RENDERER_GL.localClippingEnabled).toBe(true);
  });
});

describe('each canvas', () => {
  it.each(CANVASES)('%s mounts its <Canvas> with the shared props', (_name, canvas) => {
    expect(canvasPropsOf(canvas)).toMatchObject(CANVAS_RENDERER_PROPS);
  });

  it.each(CANVASES)('%s keeps every shared gl flag', (_name, canvas) => {
    expect(canvasPropsOf(canvas).gl).toMatchObject(CANVAS_RENDERER_GL);
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
