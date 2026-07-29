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
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(import.meta.dirname, 'World2DCanvas.tsx'), 'utf8');

describe('World2DCanvas tone mapping', () => {
  it('passes `flat` to <Canvas> so R3F selects NoToneMapping', () => {
    // `<Canvas\s`, not `<Canvas\b` — the file's own docstring mentions
    // "`<Canvas>` host", which would otherwise match first and never carry the prop.
    const canvasTag = /<Canvas\s[\s\S]*?>/.exec(SOURCE)?.[0] ?? '';
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
