/** Reads a WebGL or WebGPU canvas through a 2D copy, rows from the top, in the task that drew it. */

/* global document, ImageData */ // The page runs in the browser.

export function copyPixels(canvas) {
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  const context = copy.getContext('2d', { willReadFrequently: true });
  context.drawImage(canvas, 0, 0);
  return context.getImageData(0, 0, copy.width, copy.height);
}

export function pixelAt(image, x, y) {
  const offset = (Math.round(y) * image.width + Math.round(x)) * 4;
  return [...image.data.slice(offset, offset + 3)];
}

/** How two images of one size differ, counted as the golden gate counts. */
export function imageDelta(expected, actual) {
  let changedPixels = 0;
  let maxChannelDelta = 0;
  for (let i = 0; i < expected.data.length; i += 4) {
    let pixelDelta = 0;
    for (let channel = 0; channel < 3; channel++) {
      pixelDelta = Math.max(pixelDelta, Math.abs(expected.data[i + channel] - actual.data[i + channel]));
    }
    if (pixelDelta > 0) changedPixels++;
    maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
  }
  return { changedPixels, maxChannelDelta };
}

export function flippedRows(image) {
  const flipped = new ImageData(image.width, image.height);
  const rowBytes = image.width * 4;
  for (let row = 0; row < image.height; row++) {
    const source = image.data.subarray(row * rowBytes, (row + 1) * rowBytes);
    flipped.data.set(source, (image.height - 1 - row) * rowBytes);
  }
  return flipped;
}
