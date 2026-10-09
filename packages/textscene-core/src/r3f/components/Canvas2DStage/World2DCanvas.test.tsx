/**
 * The 2D world canvas must not tone-map: Godot tone-maps only the 3D pass. R3F
 * sets `gl.toneMapping = flat ? NoToneMapping : ACESFilmicToneMapping`, and a
 * happy-dom render cannot observe the flag, so the source is read.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SelectionProvider } from '../../contexts/SelectionContext';
import { CameraControlProvider } from '../../contexts/CameraControlContext';
import { cameraControlProbe } from '../../testing/CameraControlProbe';

// The real ControlCanvasLayer renders null here, so a visible stand-in makes
// its mount observable.
vi.mock('../../controls/index.js', () => ({
  ControlCanvasLayer: () => <mesh name="native-controls-stub" />,
}));

import { World2DContents } from './World2DCanvas';
import { TiledUploadQueue } from '../../tiledUpload/TiledUploadQueue';

const SOURCE = readFileSync(join(import.meta.dirname, 'World2DCanvas.tsx'), 'utf8');

// Both comment forms go: a `<Canvas …>` quoted inside one would otherwise be read as the
// element. `<Canvas\s`, not `<Canvas\b`, so a bare mention of the name does not match.
const CANVAS_TAG =
  /<Canvas\s[\s\S]*?>/.exec(SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))?.[0] ?? '';

describe('World2DCanvas tone mapping', () => {
  it('passes `flat` to <Canvas> so R3F selects NoToneMapping', () => {
    expect(CANVAS_TAG).not.toBe('');
    expect(CANVAS_TAG).toMatch(/^\s*flat\s*$/m);
  });

  it('agrees with the R3F rule it is opting out of', () => {
    // If three renamed the constant, the `flat` test would pass and mean nothing.
    expect(THREE.NoToneMapping).toBeDefined();
    expect(THREE.ACESFilmicToneMapping).not.toBe(THREE.NoToneMapping);
  });
});

describe('World2DCanvas multisampling', () => {
  it("asks for a NON-multisampled drawing buffer, matching Godot's 2D viewport default", () => {
    // scene/main/viewport.h:309: `msaa_2d = MSAA_DISABLED`, the project setting's
    // default (rendering_server.cpp:3773). R3F defaults `antialias: true`, which
    // resolves coverage on top of the authored feather rings.
    expect(CANVAS_TAG).not.toBe('');
    expect(CANVAS_TAG).toMatch(/antialias:\s*false/);
  });
});

const baseProps = {
  nodes: [],
  internalResources: [],
  externalResources: [],
  pan: { x: 0, y: 0 },
  zoom: 1,
};

describe('World2DContents native-controls mount seam', () => {
  it('lazily mounts ControlCanvasLayer (from the controls barrel) as a sibling after NodeDispatcher', async () => {
    const rendered = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <World2DContents {...baseProps} />
      </SelectionProvider>
    );
    expect(rendered.scene.findAllByProps({ name: 'native-controls-stub' })).toHaveLength(1);
  });
});

describe('World2DContents tiled uploads', () => {
  it('drives a tiled upload queue every frame, so large textures upload in bands', async () => {
    const tick = vi.spyOn(TiledUploadQueue.prototype, 'tick');
    const rendered = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <World2DContents {...baseProps} />
      </SelectionProvider>
    );
    tick.mockClear();
    await rendered.advanceFrames(2, 16);

    expect(tick).toHaveBeenCalledTimes(2);
    tick.mockRestore();
  });
});

describe('World2DContents screenshot', () => {
  it('registers the 2D view for the toolbar Screenshot and the host capture', async () => {
    const { Probe, control } = cameraControlProbe();
    await ReactThreeTestRenderer.create(
      <CameraControlProvider>
        <SelectionProvider>
          <Probe />
          <World2DContents {...baseProps} />
        </SelectionProvider>
      </CameraControlProvider>
    );

    expect(control().hasScreenshotHandler()).toBe(true);
  });
});
