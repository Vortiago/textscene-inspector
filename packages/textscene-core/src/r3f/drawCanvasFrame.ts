import type { RootState } from '@react-three/fiber';

/** The loop's frame, not `gl.render`, so a pass that owns the render draws. A stopped loop passes no time. */
export function drawCanvasFrame({
  advance,
  frameloop,
  clock,
}: Pick<RootState, 'advance' | 'frameloop' | 'clock'>): void {
  advance(frameloop === 'never' ? clock.elapsedTime : performance.now());
}
