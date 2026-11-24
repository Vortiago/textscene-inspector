import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { copyPolygonMode, drawAsLines, installGodotPolygonMode } from './polygonMode.js';

const LINE = 0x1b01;
const FILL = 0x1b02;

type DrawArgs = Parameters<THREE.WebGLRenderer['renderBufferDirect']>;

/** The polygon mode the context holds now, and the extension that sets it. */
function polygonModeContext() {
  const context = { mode: FILL };
  const extension = {
    LINE_WEBGL: LINE,
    FILL_WEBGL: FILL,
    polygonModeWEBGL: (_face: number, mode: number) => (context.mode = mode),
  };
  return { context, extension };
}

/** A renderer whose context has `extension`, and whose draw records the polygon mode it runs under. */
function recordingRenderer(extension: object | null, context = { mode: FILL }) {
  const modes: number[] = [];
  const gl = { FRONT_AND_BACK: 0x0408, getExtension: () => extension };
  const renderer = {
    getContext: () => gl,
    renderBufferDirect: () => modes.push(context.mode),
  } as unknown as THREE.WebGLRenderer;
  installGodotPolygonMode(renderer);
  const draw = (material: THREE.Material) =>
    renderer.renderBufferDirect(...([null, null, null, material, null, null] as unknown as DrawArgs));
  return { modes, draw };
}

function lineMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial();
  drawAsLines(material);
  return material;
}

describe('Godot’s polygon mode on a WebGL renderer', () => {
  it('draws a line material under the line mode', () => {
    const { context, extension } = polygonModeContext();
    const renderer = recordingRenderer(extension, context);
    renderer.draw(lineMaterial());
    expect(renderer.modes).toEqual([LINE]);
  });

  it('fills again after a line draw', () => {
    const { context, extension } = polygonModeContext();
    recordingRenderer(extension, context).draw(lineMaterial());
    expect(context.mode).toBe(FILL);
  });

  it('draws any other material filled', () => {
    const { context, extension } = polygonModeContext();
    const renderer = recordingRenderer(extension, context);
    renderer.draw(new THREE.MeshBasicMaterial());
    expect(renderer.modes).toEqual([FILL]);
  });

  it('draws a material under the line mode when its colour material draws lines', () => {
    const { context, extension } = polygonModeContext();
    const renderer = recordingRenderer(extension, context);
    const depth = new THREE.MeshBasicMaterial();
    copyPolygonMode(lineMaterial(), depth);
    renderer.draw(depth);
    expect(renderer.modes).toEqual([LINE]);
  });

  it('draws three’s wireframe without the extension', () => {
    const material = lineMaterial();
    recordingRenderer(null).draw(material);
    expect(material.wireframe).toBe(true);
  });
});
