import { LoadTimeline, eventLine } from './loadTimeline.mjs';
import { installPageRecorder, LOAD_TIMING_PREFIX } from './pageRecorder.mjs';

/** Whether `env` switches load timing on: off by default, as its reads slow each program's first draw. */
export function isLoadTimingOn(env) {
  return env.TEXTSCENE_LOAD_TIMING === '1';
}

/** Prints each event of `context`'s pages with `print`, and a summary line when a load ends. */
export async function recordLoadTiming(context, print = console.log) {
  await context.addInitScript(installPageRecorder, LOAD_TIMING_PREFIX);
  context.on('page', (page) => {
    const timeline = new LoadTimeline();
    const printSummary = (summary) => summary && print(`[load-timing] ${summary}`);
    page.on('console', (message) => {
      const text = message.text();
      if (!text.startsWith(LOAD_TIMING_PREFIX)) return;
      const event = JSON.parse(text.slice(LOAD_TIMING_PREFIX.length));
      printSummary(timeline.add(event));
      print(`[load-timing] ${eventLine(event)}`);
    });
    page.on('close', () => printSummary(timeline.summary()));
  });
}
