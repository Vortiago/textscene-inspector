/**
 * Test-only: the frame steps of a canvas for a light pass or a shadow sampler mounted without the
 * stage. It runs them on every frame and draws nothing, as the stage's frame render would before
 * its draw.
 */
import { useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CanvasFrameStepsProvider,
  createCanvasFrameSteps,
  runCanvasFrame,
} from '../components/Canvas2DStage/canvasFrameSequence';

const DRAWS_NOTHING = () => {};

export function CanvasFrameDriver({ children }: { children: ReactNode }) {
  const [steps] = useState(createCanvasFrameSteps);
  useFrame(({ scene }) => runCanvasFrame(steps, scene, DRAWS_NOTHING));
  return <CanvasFrameStepsProvider steps={steps}>{children}</CanvasFrameStepsProvider>;
}
