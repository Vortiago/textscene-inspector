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
      try {
        const event = JSON.parse(text.slice(LOAD_TIMING_PREFIX.length));
        const line = eventLine(event);
        logSummary(timeline.add(event));
        log(line);
      } catch (error) {
        // A diagnostic never fails the harness it runs in: an unread line is printed with its reason.
        log(`unread line ${JSON.stringify(text)}: ${error.message}`);
      }
    });
    page.on('close', () => logSummary(timeline.summary()));
  });
}
