import { LoadTimeline, eventLine } from './loadTimeline.mjs';
import { installPageRecorder, LOAD_TIMING_PREFIX } from './pageRecorder.mjs';

/** Prints how `context`'s pages load when `TEXTSCENE_LOAD_TIMING=1`. Off by default: it slows first draws. */
export async function recordLoadTimingWhenOn(context, env, print = console.log) {
  if (env.TEXTSCENE_LOAD_TIMING !== '1') return;
  await context.addInitScript(installPageRecorder, LOAD_TIMING_PREFIX);
  const log = (text) => print(`[load-timing] ${text}`);
  context.on('page', (page) => {
    const timeline = new LoadTimeline();
    const logSummary = (summary) => summary && log(summary);
    page.on('console', (message) => {
      const text = message.text();
      if (!text.startsWith(LOAD_TIMING_PREFIX)) return;
      const event = JSON.parse(text.slice(LOAD_TIMING_PREFIX.length));
      logSummary(timeline.add(event));
      log(eventLine(event));
    });
    page.on('close', () => logSummary(timeline.summary()));
  });
}
