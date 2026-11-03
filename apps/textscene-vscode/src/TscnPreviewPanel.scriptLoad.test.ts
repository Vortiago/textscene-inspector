/**
 * A webview whose entry script fails to load posts `webviewLoadFailed`, since nothing of the
 * bundle runs. The panel loads its document once more, and a second failure before a
 * `webviewReady` ends every capture with the error instead of the load deadline.
 */
import { describe, expect, it } from 'vitest';
import './test-setup';
import { openPreviewPanel } from './previewPanel.testkit';

const CUT_SCRIPT_ERROR = 'SyntaxError: Unexpected end of input';

const openPanel = () => openPreviewPanel('[gd_scene format=3]');

describe('TscnPreviewPanel script load failure', () => {
  it('loads a new document once the first one reports its script failed', async () => {
    const { webview, triggerMessage } = await openPanel();
    const firstDocument = webview.html;

    triggerMessage({ type: 'webviewLoadFailed', error: CUT_SCRIPT_ERROR });

    expect(webview.html).toContain('<div id="r3f-root">');
    expect(webview.html).not.toBe(firstDocument);
  });

  it('loads no third document when the second one fails too', async () => {
    const { webview, triggerMessage } = await openPanel();
    triggerMessage({ type: 'webviewLoadFailed', error: CUT_SCRIPT_ERROR });
    const secondDocument = webview.html;

    triggerMessage({ type: 'webviewLoadFailed', error: CUT_SCRIPT_ERROR });

    expect(webview.html).toBe(secondDocument);
  });

  it('loads a new document again for a failure after a document that loaded', async () => {
    const { webview, triggerMessage } = await openPanel();
    triggerMessage({ type: 'webviewLoadFailed', error: CUT_SCRIPT_ERROR });
    triggerMessage({ type: 'webviewReady' });
    const loadedDocument = webview.html;

    triggerMessage({ type: 'webviewLoadFailed', error: CUT_SCRIPT_ERROR });

    expect(webview.html).not.toBe(loadedDocument);
  });

  it('answers a capture with the script error once the second document fails', async () => {
    const { panel, triggerMessage } = await openPanel();
    const captured = panel.capture();

    triggerMessage({ type: 'webviewLoadFailed', error: CUT_SCRIPT_ERROR });
    triggerMessage({ type: 'webviewLoadFailed', error: CUT_SCRIPT_ERROR });

    await expect(captured).resolves.toEqual({
      error: `The preview script failed to load: ${CUT_SCRIPT_ERROR}`,
    });
  });
});
