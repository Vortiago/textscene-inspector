/**
 * Tests for the pure "resolve initial viewport mode" logic
 * `r3f-webview-main.tsx` uses to turn the host-embedded
 * `window.__TEXTSCENE_CONFIG__` (see `webviewHtml.ts`) into the
 * `initialViewportMode` prop `<TscnPreviewShell>` expects — split out so it's
 * testable without mounting React in this package's node-environment vitest
 * config (the webview itself only ever runs inside a real VS Code webview).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readInitialConfig, resolveInitialViewportMode } from './initialConfig';

describe('resolveInitialViewportMode', () => {
  it('returns undefined for "auto" (Godot-parity auto-select stays in control)', () => {
    expect(resolveInitialViewportMode({ viewportMode: 'auto' })).toBeUndefined();
  });

  it('returns undefined when the config has no viewportMode', () => {
    expect(resolveInitialViewportMode({})).toBeUndefined();
  });

  it('passes through an explicit "2D" override', () => {
    expect(resolveInitialViewportMode({ viewportMode: '2D' })).toBe('2D');
  });

  it('passes through an explicit "3D" override', () => {
    expect(resolveInitialViewportMode({ viewportMode: '3D' })).toBe('3D');
  });
});

describe('readInitialConfig', () => {
  afterEach(() => {
    delete (globalThis as { __TEXTSCENE_CONFIG__?: unknown }).__TEXTSCENE_CONFIG__;
  });

  it('returns an empty object when the host never embedded a config', () => {
    expect(readInitialConfig()).toEqual({});
  });

  it('reads back a config the host embedded on globalThis', () => {
    (globalThis as { __TEXTSCENE_CONFIG__?: unknown }).__TEXTSCENE_CONFIG__ = {
      viewportMode: '2D',
    };

    expect(readInitialConfig()).toEqual({ viewportMode: '2D' });
  });
});
