/**
 * Puts the Animation tab's playhead on a time: the tab mounts while an AnimationPlayer is
 * selected (ADR-0012), and its scrubber seeks only from the paused state.
 */

/* global document, window */ // used only inside the page.evaluate callback, which runs in the browser.

/** Time the pose takes to reach the canvas after the play, pause and seek clicks. */
const SETTLE_MS = 220;

/** Plays and pauses the selected player, since a seek from the stopped state restores the rest pose. */
export async function pausePlayer(page) {
  // The exact-name match skips the clip dropdown, whose label also holds "Play".
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.waitForTimeout(150);
}

/** The length in seconds of the selected clip, read from the scrubber. */
export async function clipDuration(page) {
  const scrubber = page.locator('input[type="range"]').first();
  if ((await scrubber.count()) === 0) throw new Error('expected an animation scrubber, found none');
  const duration = Number(await scrubber.getAttribute('max'));
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error(`expected a scrubber max, got ${duration}`);
  return duration;
}

/** Seeks the paused player to `time` seconds. */
export async function seekPlayer(page, time) {
  // A React-controlled input: set through the native value setter and fire input and change,
  // since .fill() does not drive onChange.
  await page.evaluate((value) => {
    const el = document.querySelector('input[type=range]');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, String(value));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, time);
  await page.waitForTimeout(SETTLE_MS);
}
