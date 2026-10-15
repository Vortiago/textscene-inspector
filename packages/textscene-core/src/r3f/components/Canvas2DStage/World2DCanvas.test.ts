/**
 * The 2D world canvas must not tone-map: Godot tone-maps only the 3D pass. R3F
 * sets `gl.toneMapping = flat ? NoToneMapping : ACESFilmicToneMapping`, and a
 * happy-dom render cannot observe the flag, so the source is read.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
