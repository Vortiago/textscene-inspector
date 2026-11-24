import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { copyPolygonMode, drawAsLines, installGodotPolygonMode } from './polygonMode.js';

const LINE = 0x1b01;
const FILL = 0x1b02;

type DrawArgs = Parameters<THREE.WebGLRenderer['renderBufferDirect']>;

/** A context whose polygon mode the extension sets, or one with no extension. */
function lineContext(hasExtension: boolean) {
  const state = { mode: FILL, asked: 0 };
  const extension = {
    LINE_WEBGL: LINE,
    FILL_WEBGL: FILL,
    polygonModeWEBGL: (_face: number, mode: number) => (state.mode = mode),
  };
  const getExtension = () => {
    state.asked += 1;
    return hasExtension ? extension : null;
  };
  return { state, gl: { FRONT_AND_BACK: 0x0408, getExtension } };
}

/** A renderer on `gl` whose draw records the polygon mode and the `wireframe` it runs under. */
function recordingRenderer(context: ReturnType<typeof lineContext>, drawn = () => {}) {
  const modes: number[] = [];
  const wireframes: unknown[] = [];
  const canvas = new EventTarget();
  const renderer = {
    domElement: canvas,
    getContext: () => context.gl,
    renderBufferDirect: (...[, , , material]: DrawArgs) => {
      modes.push(context.state.mode);
      wireframes.push((material as THREE.MeshBasicMaterial).wireframe);
      drawn();
    },
  } as unknown as THREE.WebGLRenderer;
  installGodotPolygonMode(renderer);
  const draw = (material: THREE.Material, object: THREE.Object3D = new THREE.Mesh()) =>
    renderer.renderBufferDirect(...([null, null, null, material, object, null] as unknown as DrawArgs));
  return { renderer, canvas, modes, wireframes, draw };
}

function lineMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial();
  drawAsLines(material);
  return material;
}

describe('Godot’s polygon mode on a WebGL renderer', () => {
  it('draws a line material under the line mode', () => {
    const renderer = recordingRenderer(lineContext(true));
    renderer.draw(lineMaterial());
    expect(renderer.modes).toEqual([LINE]);
  });

  it('fills again after a line draw', () => {
    const context = lineContext(true);
    recordingRenderer(context).draw(lineMaterial());
    expect(context.state.mode).toBe(FILL);
  });

  it('fills again after a line draw that throws', () => {
    const context = lineContext(true);
    const renderer = recordingRenderer(context, () => {
      throw new Error('a draw that fails');
    });
    expect(() => renderer.draw(lineMaterial())).toThrow('a draw that fails');
    expect(context.state.mode).toBe(FILL);
  });

  it('draws any other material filled', () => {
    const renderer = recordingRenderer(lineContext(true));
    renderer.draw(new THREE.MeshBasicMaterial());
    expect(renderer.modes).toEqual([FILL]);
  });

  it('draws a line material on a lines primitive as it is', () => {
    const renderer = recordingRenderer(lineContext(false));
    renderer.draw(lineMaterial(), new THREE.LineSegments());
    expect(renderer.wireframes).toEqual([false]);
  });

  it('draws the material its colour material lends the line mode under it', () => {
    const renderer = recordingRenderer(lineContext(true));
    const depth = new THREE.MeshBasicMaterial();
    copyPolygonMode(lineMaterial(), depth);
    renderer.draw(depth);
    expect(renderer.modes).toEqual([LINE]);
  });

  it('wraps a renderer once, however often it is installed', () => {
    const renderer = recordingRenderer(lineContext(true));
    installGodotPolygonMode(renderer.renderer);
    renderer.draw(lineMaterial());
    expect(renderer.modes).toEqual([LINE]);
  });

  it('asks for the extension once while the context lives', () => {
    const context = lineContext(false);
    const renderer = recordingRenderer(context);
    renderer.draw(lineMaterial());
    renderer.draw(lineMaterial());
    expect(context.state.asked).toBe(1);
  });

  it('asks for the extension again after the context is restored', () => {
    const context = lineContext(true);
    const renderer = recordingRenderer(context);
    renderer.draw(lineMaterial());
    renderer.canvas.dispatchEvent(new Event('webglcontextrestored'));
    renderer.draw(lineMaterial());
    expect(context.state.asked).toBe(2);
  });

  it('draws three’s wireframe without the extension', () => {
    const renderer = recordingRenderer(lineContext(false));
    renderer.draw(lineMaterial());
    expect(renderer.wireframes).toEqual([true]);
  });

  it('leaves the material filled after a draw without the extension', () => {
    const material = lineMaterial();
    recordingRenderer(lineContext(false)).draw(material);
    expect(material.wireframe).toBe(false);
  });
});
