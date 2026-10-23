/**
 * Reads whether its canvas's renderer draws in software and publishes it to the top bar. Every
 * canvas in a page shares the browser's renderer, so a probe never clears what another published.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useSoftwareRenderingStore } from './SoftwareRenderingContext.js';
import { rendersInSoftware } from './softwareRenderer.js';

/** Mounted once in each top-level `<Canvas>`. */
export function SoftwareRenderingProbe(): null {
  const gl = useThree((state) => state.gl);
  const store = useSoftwareRenderingStore();

  useEffect(() => {
    const publish = () => {
      if (rendersInSoftware(gl.getContext() as WebGL2RenderingContext)) store.set(true);
    };
    publish();
    // A browser whose GPU process fails restores the context on its software rasteriser.
    gl.domElement.addEventListener('webglcontextrestored', publish);
    return () => gl.domElement.removeEventListener('webglcontextrestored', publish);
  }, [gl, store]);

  return null;
}
