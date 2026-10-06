/** Tests the scene timing: how a CI log becomes seconds, and how seconds update the table. */
import { describe, expect, it } from 'vitest';
import { mergeSeconds, parseSceneSeconds } from './measure.mjs';

/** One shard's harness lines, as GitHub Actions writes them. */
const SHARD_LOG = [
  '2026-10-04T17:17:23.4854848Z ##[group]Run pnpm test:visual --shard 1/12',
  '2026-10-04T17:17:25.0000000Z [visual] preview at http://localhost:4317',
  '2026-10-04T17:17:30.0000000Z [visual] browser ready',
  '2026-10-04T17:17:41.5000000Z [visual] 1/2 plane-mesh pass',
  '2026-10-04T17:17:42.0000000Z [visual]   sky: no network idle within 5000ms',
  '2026-10-04T17:17:51.0000000Z [visual] 2/2 sky FAIL',
].join('\n');

describe('parseSceneSeconds', () => {
  it('times each scene from the line before it', () => {
    expect(parseSceneSeconds(SHARD_LOG)).toEqual([
      { name: 'plane-mesh', seconds: 11.5 },
      { name: 'sky', seconds: 9.5 },
    ]);
  });

  it('starts the first clock at the preview line when the log has no browser-ready line', () => {
    const log = SHARD_LOG.split('\n')
      .filter((line) => !line.includes('browser ready'))
      .join('\n');
    expect(parseSceneSeconds(log)[0]).toEqual({ name: 'plane-mesh', seconds: 16.5 });
  });

  it('restarts the clock for each shard in a whole-run log from gh run view --log', () => {
    const asJob = (job) =>
      SHARD_LOG.split('\n')
        .map((line) => `${job}\tRun pnpm test:visual\t${line}`)
        .join('\n');
    const log = `${asJob('Visual regression (1/12)')}\n${asJob('Visual regression (2/12)')}`;
    expect(parseSceneSeconds(log).map((s) => s.seconds)).toEqual([11.5, 9.5, 11.5, 9.5]);
  });

  it('returns nothing for a log with no harness lines', () => {
    expect(parseSceneSeconds('2026-10-04T17:17:23.4854848Z Run actions/checkout')).toEqual([]);
  });
});

describe('mergeSeconds', () => {
  it('takes the mean of a scene measured more than once, to one decimal', () => {
    const samples = [
      { name: 'a', seconds: 10 },
      { name: 'a', seconds: 11.25 },
    ];
    expect(mergeSeconds({ a: 3 }, samples, ['a'])).toEqual({ a: 10.6 });
  });

  it('keeps the old value of a scene the logs miss', () => {
    expect(mergeSeconds({ a: 3 }, [], ['a'])).toEqual({ a: 3 });
  });

  it('drops a scene the manifest no longer holds and sorts by name', () => {
    const merged = mergeSeconds({ gone: 3, b: 2 }, [{ name: 'a', seconds: 1 }], ['b', 'a']);
    expect(Object.entries(merged)).toEqual([
      ['a', 1],
      ['b', 2],
    ]);
  });
});
