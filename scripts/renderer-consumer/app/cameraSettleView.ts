import { createElement, createRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { mountScene, TscnCanvas, type Scene, type View, type ViewOptions } from '@textscene/renderer';
import { base64Of } from './capture';

type CanvasAnswers = Pick<View, 'settled' | 'captureImage'>;

/** A capture taken as `settled` resolves, and the milliseconds from the mount to that. */
export interface SettledCapture {
  png: string;
  settleMs: number;
}

export interface CameraSettleResults {
  /** A fresh `mountScene` view and a `TscnCanvas` ref, each through `Rig/Front`. */
  mounted: SettledCapture;
  canvas: SettledCapture;
  /** `camera: null`: the milliseconds to settle, or the message `settled` rejected with. */
  editorSettleMs: number | string;
  /** The message a ref's `settled` rejects with through a path to no node, then with the prop left out. */
  missing: string | null;
  keptMissing: string | null;
}

declare global {
  interface Window {
    cameraSettleChecks?: (missingPath: string) => Promise<CameraSettleResults>;
  }
}

async function rejectionOf(settled: Promise<unknown>): Promise<string | null> {
  try {
    await settled;
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

async function captureAtSettle(answers: CanvasAnswers, startedAt: number): Promise<SettledCapture> {
  await answers.settled;
  const settleMs = Math.round(performance.now() - startedAt);
  return { png: await base64Of(await answers.captureImage()), settleMs };
}

async function mountedSettle(element: HTMLElement, scene: Scene, options: ViewOptions) {
  const startedAt = performance.now();
  const view = mountScene(element, scene, options);
  try {
    return await captureAtSettle(view, startedAt);
  } finally {
    view.dispose();
  }
}

async function editorSettleMs(element: HTMLElement, scene: Scene): Promise<number | string> {
  try {
    return (await mountedSettle(element, scene, { mode: '3D', camera: null })).settleMs;
  } catch (error) {
    return (error as Error).message;
  }
}

async function canvasSettle(element: HTMLElement, scene: Scene, missingPath: string) {
  const view = createRef<CanvasAnswers>();
  const root = createRoot(element);
  const draw = (camera?: string) =>
    flushSync(() => root.render(createElement(TscnCanvas, { scene, mode: '3D', camera, ref: view })));
  try {
    const startedAt = performance.now();
    draw('Rig/Front');
    const canvas = await captureAtSettle(view.current!, startedAt);
    draw(missingPath);
    const missing = await rejectionOf(view.current!.settled);
    draw(undefined);
    const keptMissing = await rejectionOf(view.current!.settled);
    return { canvas, missing, keptMissing };
  } finally {
    root.unmount();
  }
}

/** Gives the runner fresh views through a camera, each captured as it settles, in `element`. */
export function exposeCameraSettleChecks(element: HTMLElement, openCameraScene: () => Scene): void {
  window.cameraSettleChecks = async (missingPath) => {
    const mounted = await mountedSettle(element, openCameraScene(), { mode: '3D', camera: 'Rig/Front' });
    const editor = await editorSettleMs(element, openCameraScene());
    return {
      mounted,
      editorSettleMs: editor,
      ...(await canvasSettle(element, openCameraScene(), missingPath)),
    };
  };
}
