/**
 * `WebGPURenderer` through fiber's asynchronous `gl` factory: does `<Canvas>` mount, what does
 * `state.gl` hold, and does a frame draw? `?backend=webgl2` forces the WebGL 2 backend.
 */

/* global window, document */ // The page runs in the browser.

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MeshBasicNodeMaterial, WebGPURenderer } from 'three/webgpu';

function Probe({ report }) {
  const gl = useThree((state) => state.gl);
  const frames = { drawn: 0 };
  useFrame(() => {
    frames.drawn++;
    if (frames.drawn === 3) {
      report({
        rendererClass: gl.constructor.name,
        backend: gl.backend?.isWebGPUBackend ? 'webgpu' : 'webgl2',
        hasClassicInternals: {
          properties: 'properties' in gl,
          state: 'state' in gl,
          extensions: 'extensions' in gl,
          capabilities: 'capabilities' in gl,
          shadowMapRender: typeof gl.shadowMap?.render === 'function',
          getContext: typeof gl.getContext === 'function',
          xr: 'xr' in gl,
        },
      });
    }
  });
  useEffect(() => undefined, []);
  return createElement(
    'mesh',
    null,
    createElement('boxGeometry'),
    createElement('primitive', {
      object: new MeshBasicNodeMaterial({ color: 0xff8000 }),
      attach: 'material',
    })
  );
}

export function run(canvas) {
  const forceWebGL = new URLSearchParams(window.location.search).get('backend') === 'webgl2';
  const host = document.createElement('div');
  host.style.cssText = 'width:256px;height:256px';
  canvas.replaceWith(host);
  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    const gl = async (defaults) => {
      const renderer = new WebGPURenderer({ canvas: defaults.canvas, forceWebGL });
      await renderer.init();
      return renderer;
    };
    const report = (found) => resolve({ ...found, msToThirdFrame: performance.now() - startedAt });
    window.addEventListener('error', (event) => reject(event.error));
    createRoot(host).render(
      createElement(Canvas, { gl, flat: true, shadows: 'percentage' }, createElement(Probe, { report }))
    );
  });
}
