import { Canvas } from '@react-three/fiber';
import { usePreviewFrameloop } from '../contexts/PreviewVisibilityContext.js';
import { CANVAS_RENDERER_GL, CANVAS_RENDERER_PROPS } from '../canvasRenderer/canvasRendererProps.js';
import { CanvasRendererScope } from '../canvasRenderer/CanvasRendererScope.js';
import { rootClassName } from '../stageClassName.js';
import { GameViewContents } from './GameViewContents.js';

export function GameView({ className }: { className?: string }) {
  const frameloop = usePreviewFrameloop();
  return (
    <div className={rootClassName(className)}>
      <Canvas {...CANVAS_RENDERER_PROPS} gl={CANVAS_RENDERER_GL} frameloop={frameloop}>
        <CanvasRendererScope>
          <GameViewContents />
        </CanvasRendererScope>
      </Canvas>
    </div>
  );
}
