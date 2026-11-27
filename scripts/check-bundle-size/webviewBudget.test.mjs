import { describe, expect, it } from 'vitest';
import { findExtraScripts, webviewCeiling, WEBVIEW_HEADROOM_GZ } from './webviewBudget.mjs';

describe('webviewCeiling', () => {
  it('fails 200 KB above the last measured size, not at it', () => {
    const ceiling = webviewCeiling();
    expect(ceiling.budget - ceiling.measured).toBe(WEBVIEW_HEADROOM_GZ);
    expect(WEBVIEW_HEADROOM_GZ).toBe(200 * 1024);
  });
});

describe('findExtraScripts', () => {
  it('passes a build of the entry, its stylesheet and their source maps', () => {
    expect(findExtraScripts(['webview.js', 'webview.css', 'webview.js.map', 'webview.css.map'])).toEqual([]);
  });

  it('names each chunk a split build writes', () => {
    expect(findExtraScripts(['webview.js', 'chunks', 'chunks/chunk-A.js', 'chunks/panel-B.js'])).toEqual([
      'chunks/chunk-A.js',
      'chunks/panel-B.js',
    ]);
  });

  it('names a script written beside the entry', () => {
    expect(findExtraScripts(['webview.js', 'worker.js'])).toEqual(['worker.js']);
  });
});
