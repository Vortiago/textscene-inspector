import { mountScene, type openScene } from '@textscene/renderer';

export function elementOf(width: number, height: number): HTMLElement {
  const element = document.createElement('div');
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  document.body.append(element);
  return element;
}

export async function base64Of(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** The README recipe: open, mount, wait for `settled`, capture, dispose. */
export async function capturePng(
  scene: ReturnType<typeof openScene>,
  width: number,
  height: number
): Promise<Blob> {
  const view = mountScene(elementOf(width, height), scene);
  await view.settled;
  const png = await view.captureImage();
  view.dispose();
  return png;
}
