import { Canvas } from '@react-three/fiber';
import { usePreviewFrameloop } from '../contexts/PreviewVisibilityContext.js';
import { CANVAS_RENDERER_GL, CANVAS_RENDERER_PROPS } from '../canvasRenderer/canvasRendererProps.js';
import { CanvasRendererScope } from '../canvasRenderer/CanvasRendererScope.js';
import { StageRoot } from '../StageRoot.js';
import { GameViewContents } from './GameViewContents.js';

export function GameView({ className }: { className?: string }) {
  const frameloop = usePreviewFrameloop();
  return (
    <StageRoot className={className}>
      <Canvas {...CANVAS_RENDERER_PROPS} gl={CANVAS_RENDERER_GL} frameloop={frameloop}>
        <CanvasRendererScope>
          <GameViewContents />
        </CanvasRendererScope>
      </Canvas>
    </StageRoot>
  );
}
