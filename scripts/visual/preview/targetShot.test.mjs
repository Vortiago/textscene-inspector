/** What one capture target's shot clips, how it fails, and how it waits. */
import { describe, expect, it } from 'vitest';
import { targetShooter } from './targetShot.mjs';

/** A Locator reduced to what `targetShooter` touches, on a page whose CDP session answers `send`. */
function stubTarget({
  box = { x: 0, y: 0, width: 8, height: 8 },
  scroll = { x: 0, y: 0 },
  inTopFrame = true,
  send,
} = {}) {
  const session = {
    calls: [],
    send: async (method, params) => {
      session.calls.push({ method, params });
      return send ? send() : { data: Buffer.from('png').toString('base64') };
    },
  };
  const page = { context: () => ({ newCDPSession: async () => session }) };
  // `evaluate` answers what the in-page measurement reads: the viewport box and the scroll.
  const target = {
    box,
    measures: 0,
    evaluate: async () => {
      target.measures++;
      return { rect: target.box, scroll, inTopFrame };
    },
    page: () => page,
  };
  return { target, session };
}

describe('targetShooter', () => {
  it('answers the PNG bytes the DevTools protocol sends for the target box', async () => {
    const { target, session } = stubTarget();
    const shot = await targetShooter(target).shoot();
    expect(shot.toString()).toBe('png');
    expect(session.calls[0]).toEqual({
      method: 'Page.captureScreenshot',
      params: { format: 'png', clip: { x: 0, y: 0, width: 8, height: 8, scale: 1 } },
    });
  });

  it('captures the whole pixels that enclose the target, as an element screenshot does', async () => {
    const { target, session } = stubTarget({ box: { x: 0.5, y: 10.2, width: 100.4, height: 50 } });
    await targetShooter(target).shoot();
    expect(session.calls[0].params.clip).toEqual({ x: 0, y: 10, width: 101, height: 51, scale: 1 });
  });

  it('clips by document coordinates on a scrolled page', async () => {
    const { target, session } = stubTarget({
      box: { x: 4, y: 6, width: 8, height: 8 },
      scroll: { x: 0, y: 300 },
    });
    await targetShooter(target).shoot();
    expect(session.calls[0].params.clip).toEqual({ x: 4, y: 306, width: 8, height: 8, scale: 1 });
  });

  it('measures the target once for every shot', async () => {
    const { target, session } = stubTarget();
    const { shoot } = targetShooter(target);
    await shoot();
    await shoot();
    await shoot();
    expect(session.calls).toHaveLength(3);
    expect(target.measures).toBe(1);
  });

  it('answers whether the box moved since the last measurement', async () => {
    const { target } = stubTarget();
    const shooter = targetShooter(target);
    await shooter.shoot();
    expect(await shooter.boxChanged()).toBe(false);
    target.box = { x: 0, y: 0, width: 16, height: 8 };
    expect(await shooter.boxChanged()).toBe(true);
    expect(await shooter.boxChanged()).toBe(false);
  });

  it('refuses a target with no box rather than capturing the wrong region', async () => {
    const { target } = stubTarget({ box: { x: 0, y: 0, width: 0, height: 0 } });
    await expect(targetShooter(target).shoot()).rejects.toThrow(/not visible/);
  });

  it('refuses a target inside a frame, whose box is not in the page coordinates the clip takes', async () => {
    const { target } = stubTarget({ inTopFrame: false });
    await expect(targetShooter(target).shoot()).rejects.toThrow(/top frame/);
  });

  it('reports a shot that outlasts its timeout as a TimeoutError', async () => {
    const { target } = stubTarget({ send: () => new Promise(() => {}) });
    await expect(targetShooter(target, { timeout: 5 }).shoot()).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });

  it('waits without limit for a timeout of 0, as Playwright does', async () => {
    const { target } = stubTarget({
      send: () => new Promise((resolve) => setTimeout(() => resolve({ data: '' }), 5)),
    });
    await expect(targetShooter(target, { timeout: 0 }).shoot()).resolves.toBeInstanceOf(Buffer);
  });
});
