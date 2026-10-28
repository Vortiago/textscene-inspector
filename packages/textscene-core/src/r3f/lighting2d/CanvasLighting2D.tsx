/**
 * The 2D stage's light pass, and the entry point for the declarations a light, an item and a mesh
 * make to the pass above them. The stage hosts its pass in R3F's frame loop; `CanvasLightPass.tsx`
 * is the pass itself, which a SubViewport hosts in its own ordered pass.
 */

import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasLightPass } from './CanvasLightPass.js';
import type { CanvasClip, LightPassHost } from './lightPassHost.js';
import type { Rgba } from '../../godot/math/math.js';
import { useViewportSize } from '../contexts/ViewportSizeContext.js';

export { useCanvasLighting2D, type CanvasLighting2D } from './lightPassContext.js';
export {
  useCapItemLights,
  usePassMeshRef,
  useRegisterCanvasLight2D,
  useRegisterLitItem,
} from './lightPassDeclarations.js';

/**
 * Ahead of R3F's own render, which a negative priority leaves in place, and after the occluder and
 * light snapshots (`SHADOW_SNAPSHOT_PRIORITY`) the pass reads.
 */
const LIGHT_PASS_PRIORITY = -1;

/**
 * The stage as a pass host: the R3F scene and camera, buffers the size of the drawing buffer, and
 * a clip at the canvas origin. The camera is the stage's pan and zoom camera, not Godot's, and the
 * game viewport stays where the project puts it.
 */
function useStageLightPassHost(): LightPassHost {
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  // Read through a ref, so a project viewport size change keeps the host and the context it feeds.
  const size = useViewportSize();
  const viewportSize = useRef(size);
  viewportSize.current = size;
  return useMemo<LightPassHost>(() => {
    let clip: CanvasClip | null = null;
    return {
      canvasPath: null,
      scene,
      camera,
      run: { current: null },
      readBufferSize: (out) => gl.getDrawingBufferSize(out),
      readClip: () => {
        const { x: width, y: height } = viewportSize.current;
        if (clip?.rect.w !== width || clip.rect.h !== height) {
          clip = { rect: { x: 0, y: -height, w: width, h: height }, scale: { x: 1, y: 1 } };
        }
        return clip;
      },
    };
  }, [scene, camera, gl]);
}

interface CanvasLighting2DProviderProps {
  /** The canvas tint, where `S` starts for an ordinary item: `CanvasLightPass` says why. */
  canvasModulate: Rgba;
  children: ReactNode;
}

export function CanvasLighting2DProvider({ canvasModulate, children }: CanvasLighting2DProviderProps) {
  const host = useStageLightPassHost();
  useFrame(() => host.run.current?.(), LIGHT_PASS_PRIORITY);
  return (
    <CanvasLightPass host={host} canvasModulate={canvasModulate}>
      {children}
    </CanvasLightPass>
  );
}
