/**
 * Records one loop of an AnimationPlayer clip in the preview as a GIF. It pauses the clip and
 * steps the Timeline scrubber one frame at a time, so software GL, which renders far slower than
 * real time, still gives an even frame rate. ffmpeg assembles the frames.
 */
/* global document, requestAnimationFrame, HTMLInputElement */ // Used only inside frame.evaluate() callbacks.

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

import { sleep } from './platform.mjs';
import { OUT, TMP } from './paths.mjs';
import { frameShowing, selectNode } from './workbench.mjs';

const EDITOR_PART = '[id="workbench.parts.editor"]';
const FRAMES_PER_SECOND = 20;
// The README shows the GIF at most this wide, and a wider one only adds bytes.
const GIF_WIDTH = 960;
// A frame waits for the scrubber's React update, then for the render that draws the new pose.
const FRAME_SETTLE_MS = 250;

/**
 * Selects the node named `playerName`, then plays and pauses its `clip` from the Animation tab, so
 * the scrubber drives the pose. It writes `<OUT>/<key>.gif` from one pass over the clip.
 */
export async function recordClipGif(page, { playerName, clip, key }) {
  const frame = await frameShowing(page, playerName);
  await selectNode(frame, await nodePathEndingIn(frame, playerName));
  // Exact text: a loose 'Play' also matches the toolbar's 'Display' button.
  await frame.locator('[role="tab"]:text-is("Animation")').click();
  await frame.locator('label:has(> span:text-is("Animation")) select').selectOption(clip);
  await frame.locator('button:text-is("Play")').click();
  await sleep(500);
  await frame.locator('button:text-is("Pause")').click();

  const duration = Number(await frame.getByLabel('Timeline').getAttribute('max'));
  if (!(duration > 0)) throw new Error(`expected a clip with a duration, got ${duration}`);
  const frameDir = `${TMP}/vsc-gif-frames/${key}`;
  rmSync(frameDir, { recursive: true, force: true });
  mkdirSync(frameDir, { recursive: true });
  const editorArea = await page.locator(EDITOR_PART).first().boundingBox();
  // The last frame stops one step short of the end, which is the first frame of a looping clip.
  const frameCount = Math.round(duration * FRAMES_PER_SECOND);
  for (let i = 0; i < frameCount; i++) {
    await seek(frame, i / FRAMES_PER_SECOND);
    await page.screenshot({ path: `${frameDir}/${String(i).padStart(3, '0')}.png`, clip: editorArea });
  }
  const gif = `${OUT}/${key}.gif`;
  writeGif(frameDir, gif);
  console.log(`[vscode]   ${frameCount} frames → ${gif}`);
}

async function nodePathEndingIn(frame, nodeName) {
  const path = await frame.evaluate(
    (n) => document.querySelector(`[data-node-path$="/${n}"]`)?.getAttribute('data-node-path') ?? null,
    nodeName
  );
  if (!path) throw new Error(`expected a scene-tree row named "${nodeName}", found none`);
  return path;
}

/** Moves the scrubber the way a drag does: React reads the native value setter and an input event. */
async function seek(frame, seconds) {
  await frame.evaluate((value) => {
    const scrubber = document.querySelector('input[aria-label="Timeline"]');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setValue.call(scrubber, String(value));
    scrubber.dispatchEvent(new Event('input', { bubbles: true }));
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, seconds);
  await sleep(FRAME_SETTLE_MS);
}

/** One palette for the whole clip, so the colours hold still from frame to frame. */
function writeGif(frameDir, gif) {
  const filter = `scale=${GIF_WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a`;
  try {
    execFileSync('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(FRAMES_PER_SECOND),
      '-i',
      `${frameDir}/%03d.png`,
      '-vf',
      filter,
      '-loop',
      '0',
      gif,
    ]);
  } catch (e) {
    throw new Error(`ffmpeg could not write ${gif} (is ffmpeg on PATH?): ${e.message}`, { cause: e });
  }
}
