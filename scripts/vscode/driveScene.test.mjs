import { describe, expect, it } from 'vitest';
import { isWebviewUrl } from './driveScene.mjs';

describe('isWebviewUrl', () => {
  it('accepts the webview scheme', () => {
    expect(isWebviewUrl('vscode-webview://abc123/index.html')).toBe(true);
  });

  it("accepts a host under VS Code's local resource origin", () => {
    expect(isWebviewUrl('https://file+.vscode-resource.vscode-cdn.net/home/user/scene/icon.png')).toBe(true);
  });

  it('refuses a host that only carries the resource origin in its path', () => {
    expect(isWebviewUrl('https://example.com/.vscode-resource.vscode-cdn.net/icon.png')).toBe(false);
  });

  it('refuses a host that only starts with the resource origin', () => {
    expect(isWebviewUrl('https://a.vscode-resource.vscode-cdn.net.example.com/icon.png')).toBe(false);
  });

  // `undefined` is a console message with no location.
  it.each([undefined, '', 'not a url'])('refuses %j, which is not a URL', (url) => {
    expect(isWebviewUrl(url)).toBe(false);
  });
});
