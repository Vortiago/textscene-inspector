/** Reads whether its canvas's renderer draws in software and reports it to the view's status. */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useViewStatusStore } from '../viewStatus/ViewStatusContext.js';
import { rendersInSoftware } from './softwareRenderer.js';

/** Mounted once in each top-level `<Canvas>`. */
export function SoftwareRenderingProbe(): null {
  const gl = useThree((state) => state.gl);
  const store = useViewStatusStore();

  useEffect(() => {
    if (!store) return undefined;
    const publish = () => {
      if (rendersInSoftware(gl.getContext() as WebGL2RenderingContext)) store.softwareRenderingFound();
    };
    publish();
    // A browser whose GPU process fails restores the context on its software rasteriser.
    gl.domElement.addEventListener('webglcontextrestored', publish);
    return () => gl.domElement.removeEventListener('webglcontextrestored', publish);
  }, [gl, store]);

  return null;
}
