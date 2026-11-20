import { variant, type Scene } from '@textscene/renderer';

/** What the browser console and a capture script reach: the open scene and the Variant reader. */
export interface SceneConsole {
  readonly scene: Scene;
  readonly variant: typeof variant;
}

declare global {
  interface Window {
    /** Written only by {@link exposeScene}: the scene the previewer shows now. */
    textscene?: SceneConsole;
  }
}

/** Puts the open scene on `window.textscene`, so a person or a capture script writes its nodes. */
export function exposeScene(scene: Scene): void {
  window.textscene = { scene, variant };
}
