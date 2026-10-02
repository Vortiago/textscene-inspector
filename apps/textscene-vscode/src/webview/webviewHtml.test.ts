/**
 * Tests for generateWebviewHtml: its Content-Security-Policy, and `initialConfig`,
 * a JSON global the webview reads once at mount, before `r3f-webview-main.tsx`
 * renders `<TscnPreviewShell>`.
 */

import { webcrypto } from 'node:crypto';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { generateNonce, generateWebviewHtml } from './webviewHtml';

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

describe('generateWebviewHtml CSP', () => {
  function csp(): string {
    const match = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(
      generateWebviewHtml(BASE_OPTIONS)
    );
    if (!match?.[1]) throw new Error('expected a Content-Security-Policy meta tag, found none');
    return match[1];
  }

  it('denies everything it does not name', () => {
    expect(csp().startsWith("default-src 'none';")).toBe(true);
  });

  it('lets a blob-URL worker start, where procedural textures build (ADR-0042)', () => {
    expect(csp()).toContain('worker-src blob:;');
  });

  it('opens no fetch, font or frame source, so a worker still loads nothing remote', () => {
    const policy = csp();
    expect(policy).not.toContain('connect-src');
    expect(policy).not.toContain('font-src');
    expect(policy).not.toContain('child-src');
  });
});

describe('generateNonce', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gives 32 lowercase hex digits, 128 random bits', () => {
    expect(generateNonce()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('draws on crypto.getRandomValues, never Math.random', () => {
    const mathRandom = vi.spyOn(Math, 'random');
    const getRandomValues = vi.spyOn(webcrypto, 'getRandomValues');

    generateNonce();

    expect(getRandomValues).toHaveBeenCalled();
    expect(mathRandom).not.toHaveBeenCalled();
  });

  it('gives a different nonce on each call', () => {
    const nonces = new Set(Array.from({ length: 100 }, () => generateNonce()));

    expect(nonces.size).toBe(100);
  });
});
