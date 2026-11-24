import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { drawAsLines, installGodotPolygonMode } from './polygonMode.js';

const LINE = 0x1b01;
const FILL = 0x1b02;
const FRONT_AND_BACK = 0x0408;

type DrawArgs = Parameters<THREE.WebGLRenderer['renderBufferDirect']>;

/** A renderer whose draw records the polygon mode it runs under, with or without the extension. */
function recordingRenderer(hasExtension: boolean) {
  const modes: number[] = [];
  let mode = FILL;
  const extension = {
    LINE_WEBGL: LINE,
    FILL_WEBGL: FILL,
    polygonModeWEBGL: (_face: number, next: number) => (mode = next),
  };
  const gl = { FRONT_AND_BACK, getExtension: () => (hasExtension ? extension : null) };
  const renderer = {
    getContext: () => gl,
    renderBufferDirect: () => modes.push(mode),
  } as unknown as THREE.WebGLRenderer;
  installGodotPolygonMode(renderer);
  const draw = (material: THREE.Material) =>
    renderer.renderBufferDirect(...([null, null, null, material, null, null] as unknown as DrawArgs));
  return { modes, draw, mode: () => mode };
}

function lineMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial();
  drawAsLines(material);
  return material;
}

describe('Godot’s polygon mode on a WebGL renderer', () => {
  it('draws a line material under the line mode', () => {
    const renderer = recordingRenderer(true);
    renderer.draw(lineMaterial());
    expect(renderer.modes).toEqual([LINE]);
  });

  it('fills again after a line draw', () => {
    const renderer = recordingRenderer(true);
    renderer.draw(lineMaterial());
    expect(renderer.mode()).toBe(FILL);
  });

  it('draws any other material filled', () => {
    const renderer = recordingRenderer(true);
    renderer.draw(new THREE.MeshBasicMaterial());
    expect(renderer.modes).toEqual([FILL]);
  });

  it('draws three’s wireframe without the extension', () => {
    const material = lineMaterial();
    recordingRenderer(false).draw(material);
    expect(material.wireframe).toBe(true);
  });
});
