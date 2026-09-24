/**
 * Tests for generateWebviewHtml's `initialConfig`: a JSON global the webview reads
 * once at mount, before `r3f-webview-main.tsx` renders `<TscnPreviewShell>`.
 */

import { describe, it, expect } from 'vitest';
import { generateWebviewHtml } from './webviewHtml';

const BASE_OPTIONS = {
  scriptUri: 'https://example.test/webview.js',
  nonce: 'test-nonce',
  cspSource: 'https://example.test',
};

describe('generateWebviewHtml', () => {
  it('omits the config script entirely when initialConfig is not provided', () => {
    const html = generateWebviewHtml(BASE_OPTIONS);

    expect(html).not.toContain('__TEXTSCENE_CONFIG__');
  });

  it('embeds the initialConfig as a global before the entry script', () => {
    const html = generateWebviewHtml({
      ...BASE_OPTIONS,
      initialConfig: { viewportMode: '2D' },
    });

    expect(html).toContain('window.__TEXTSCENE_CONFIG__ = {"viewportMode":"2D"};');
    const configIndex = html.indexOf('__TEXTSCENE_CONFIG__');
    const entryScriptIndex = html.indexOf(BASE_OPTIONS.scriptUri);
    expect(configIndex).toBeGreaterThan(-1);
    expect(configIndex).toBeLessThan(entryScriptIndex);
  });

  it('carries the nonce on the config script tag (CSP requires it)', () => {
    const html = generateWebviewHtml({
      ...BASE_OPTIONS,
      initialConfig: { viewportMode: 'auto' },
    });

    expect(html).toContain(`<script nonce="${BASE_OPTIONS.nonce}">window.__TEXTSCENE_CONFIG__`);
  });

  it('escapes "<" so an embedded value can never break out of the script tag', () => {
    // viewportMode is a closed enum, and the escaping is defence in depth, pinned
    // against a value that breaks out unescaped.
    const html = generateWebviewHtml({
      ...BASE_OPTIONS,
      initialConfig: { viewportMode: '</script><script>evil()</script>' as never },
    });

    // Escaping only "<" is sufficient: an HTML parser can only end a
    // <script> block on a literal "</script" sequence, so removing every "<"
    // makes that sequence unreachable regardless of ">".
    expect(html).not.toContain('</script><script>evil()</script>');
    expect(html).toContain('\\u003c/script>\\u003cscript>evil()\\u003c/script>');
  });
});
