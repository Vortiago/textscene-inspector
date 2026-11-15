/**
 * The 2D stage's light pass, and the entry point for the declarations a light, an item and a mesh
 * make to the pass above them. The stage runs its pass as the light step of the canvas frame
 * (`canvasFrameSequence.ts`). `CanvasLightPass.tsx` is the pass itself, which a SubViewport hosts too.
 */

import type { CanvasColorSpace } from '../canvasColorSpace.js';
import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { useCanvasLightPass } from '../components/Canvas2DStage/canvasFrameSequence.js';
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
  /** The space the canvas draws in, which the pass provides to its items. */
  space: CanvasColorSpace;
  children: ReactNode;
}

export function CanvasLighting2DProvider({ canvasModulate, space, children }: CanvasLighting2DProviderProps) {
  const host = useStageLightPassHost();
  const runLightPass = useCallback(() => host.run.current?.(), [host]);
  useCanvasLightPass(runLightPass);
  return (
    <CanvasLightPass host={host} canvasModulate={canvasModulate} space={space}>
      {children}
    </CanvasLightPass>
  );
}
