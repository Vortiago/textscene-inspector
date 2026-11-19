import { compareImages, formatDelta } from '../visual/imageDelta.mjs';
import { PNG } from 'pngjs';

/** Godot's window with no project size (`project_settings.cpp:1732`). */
const DEFAULT_WINDOW = { width: 1152, height: 648 };

/** Godot clears the bars opaque black under a transparent background (`rasterizer_gles3.cpp:422`). */
const TRANSPARENT_PIXELS = {
  bar: { x: 10, y: 120, rgba: [0, 0, 0, 255] },
  clear: { x: 170, y: 10, rgba: [0, 0, 0, 0] },
  square: { x: 320, y: 120, rgba: [255, 0, 0, 255] },
};

function rgbaAt(png, { x, y }) {
  const at = (y * png.width + x) * 4;
  return [...png.data.subarray(at, at + 4)];
}

function equalityFailure(name, expected, actual) {
  const [want, got] = [JSON.stringify(expected), JSON.stringify(actual)];
  return want === got ? [] : [`${name}: expected ${want}, got ${got}`];
}

function transparentFailures(base64) {
  const png = PNG.sync.read(Buffer.from(base64, 'base64'));
  return Object.entries(TRANSPARENT_PIXELS).flatMap(([name, pixel]) =>
    equalityFailure(`transparent window ${name} at ${pixel.x}, ${pixel.y}`, pixel.rgba, rgbaAt(png, pixel))
  );
}

function sizeOfPng(base64) {
  const { width, height } = PNG.sync.read(Buffer.from(base64, 'base64'));
  return { width, height };
}

/** The cube covers the 320 x 240 capture's centre, and the ground its bottom left corner. */
const CUBE_PIXEL = { x: 160, y: 120 };
const GROUND_PIXEL = { x: 10, y: 230 };
/** The summed RGB distance of the lit cube from the ground, which the ground has as 0 against itself. */
const CUBE_CONTRAST = 60;

function contrastOf(png) {
  const [cube, ground] = [rgbaAt(png, CUBE_PIXEL), rgbaAt(png, GROUND_PIXEL)];
  return cube.slice(0, 3).reduce((sum, channel, i) => sum + Math.abs(channel - ground[i]), 0);
}

/** A 3D capture as `settled` resolves draws the late file, and equals a later one: the picture is final. */
function settledPictureFailures({ atSettledPng, laterPng }) {
  const atSettled = Buffer.from(atSettledPng, 'base64');
  const contrast = contrastOf(PNG.sync.read(atSettled));
  const drawn =
    contrast > CUBE_CONTRAST
      ? []
      : [
          `captureImage in 3D as settled resolves: expected the late cube at the centre, got a contrast of ${contrast}`,
        ];
  if (atSettledPng === laterPng) return drawn;
  const delta = compareImages(atSettled, Buffer.from(laterPng, 'base64'));
  return [
    ...drawn,
    `captureImage in 3D as settled resolves: expected the later capture, got ${formatDelta(delta)}`,
  ];
}

/** @param {import('./app/mountChecks').MountCheckResults} results */
export function mountFailures(results) {
  return [
    ...(results.earlyCaptureError.startsWith('expected a settled view, got ')
      ? []
      : [
          `captureImage before settled: expected a rejection that names the pending work, got ${results.earlyCaptureError}`,
        ]),
    ...equalityFailure('settled', { scriptedNodeCount: 0, hasCurrentCamera: true }, results.settledValue),
    ...equalityFailure('captureImage size', DEFAULT_WINDOW, sizeOfPng(results.smallElementPng)),
    ...(results.smallElementPng === results.largeElementPng
      ? []
      : ['captureImage: expected the same PNG bytes from a 320 x 240 and a 1920 x 1080 element, got others']),
    ...equalityFailure('captureImage size with no project', DEFAULT_WINDOW, results.noProjectSize),
    ...equalityFailure(
      'settled in 3D',
      { scriptedNodeCount: 0, hasCurrentCamera: true },
      results.editorSettledValue
    ),
    ...equalityFailure('captureImage size in 3D', { width: 320, height: 240 }, results.editorCaptureSize),
    ...settledPictureFailures(results),
    ...equalityFailure('canvases after dispose', 0, results.canvasesAfterDispose),
    ...equalityFailure('context lost after dispose', true, results.isContextLostAfterDispose),
    ...transparentFailures(results.transparentPng),
  ].map((failure) => `mountScene: ${failure}`);
}
