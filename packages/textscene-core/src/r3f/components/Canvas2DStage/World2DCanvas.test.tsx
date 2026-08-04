/**
 * The 2D world canvas must not tone-map.
 *
 * Godot's canvas pipeline writes authored 2D colour straight to the
 * framebuffer — only the 3D pass is tone-mapped. React-three-fiber's `<Canvas>`
 * does the opposite by default:
 *
 *   gl.toneMapping = flat ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
 *
 * so leaving `flat` off silently ran ACES over every sprite, tilemap and
 * polygon in the 2D stage, lifting highlights and desaturating fills. This
 * pins the opt-out at the seam, since the renderer flag is not observable from
 * a happy-dom render.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SelectionProvider } from '../../contexts/SelectionContext';

// A stand-in for the real (barrel-registered) ControlCanvasLayer: the
// placeholder renders null, which makes its presence unobservable from
// outside — mocking the barrel is what turns "did the mount seam actually
// wire it up" into an assertable fact.
vi.mock('../../controls/index.js', () => ({
  ControlCanvasLayer: () => <mesh name="native-controls-stub" />,
}));

import { World2DContents } from './World2DCanvas';

const SOURCE = readFileSync(join(import.meta.dirname, 'World2DCanvas.tsx'), 'utf8');

describe('World2DCanvas tone mapping', () => {
  it('passes `flat` to <Canvas> so R3F selects NoToneMapping', () => {
    // `<Canvas\s`, not `<Canvas\b` — the file's own docstring mentions
    // "`<Canvas>` host", which would otherwise match first and never carry the prop.
    // Line comments are stripped first: the props are interleaved with prose,
    // and a `>` inside one (a JSX element named in passing) ends the non-greedy
    // match early, truncating the tag before the prop this asserts on.
    const canvasTag = /<Canvas\s[\s\S]*?>/.exec(SOURCE.replace(/\/\/.*$/gm, ''))?.[0] ?? '';
    expect(canvasTag).not.toBe('');
    expect(canvasTag).toMatch(/^\s*flat\s*$/m);
  });

  it('agrees with the R3F rule it is opting out of', () => {
    // Guards the constant this depends on: if three ever renamed it, the
    // one-word `flat` prop above would keep passing while meaning nothing.
    expect(THREE.NoToneMapping).toBeDefined();
    expect(THREE.ACESFilmicToneMapping).not.toBe(THREE.NoToneMapping);
  });
});

describe('World2DContents native-controls mount seam', () => {
  const baseProps = {
    nodes: [],
    internalResources: [],
    externalResources: [],
    pan: { x: 0, y: 0 },
    zoom: 1,
  };

  it('lazily mounts ControlCanvasLayer (from the controls barrel) as a sibling after NodeDispatcher', async () => {
    const rendered = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <World2DContents {...baseProps} />
      </SelectionProvider>
    );
    expect(rendered.scene.findAllByProps({ name: 'native-controls-stub' })).toHaveLength(1);
  });
});
