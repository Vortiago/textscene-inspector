/** A vendored icon at the theme scale (`default_theme.cpp:82-84`, `image_loader_svg.cpp:92-93`). */
import { describe, expect, it } from 'vitest';
import { scaledIconSize, scaledSvgDataUrl } from './scaledSvgIcon';
import { svgDataUrl } from './themeIcons';

const ICON = svgDataUrl(
  btoa('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M0 0"/></svg>')
);
const decode = (url: string) => atob(url.slice('data:image/svg+xml;base64,'.length));

describe('scaledIconSize', () => {
  it('rounds the scaled size, as the SVG loader sizes its canvas', () => {
    expect(scaledIconSize(16, 1.5)).toBe(24);
    expect(scaledIconSize(16, 1.25)).toBe(20);
    expect(scaledIconSize(16, 0.75)).toBe(12);
  });
});

describe('scaledSvgDataUrl', () => {
  it('leaves the icon alone at scale 1', () => {
    expect(scaledSvgDataUrl(ICON, 1)).toBe(ICON);
  });

  it('scales the root size and keeps the drawing in the authored coordinates', () => {
    expect(decode(scaledSvgDataUrl(ICON, 2))).toBe(
      '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="M0 0"/></svg>'
    );
  });

  it('keeps a viewBox the icon already has', () => {
    const boxed = svgDataUrl(btoa('<svg viewBox="0 0 8 8" width="16" height="16"/>'));
    expect(decode(scaledSvgDataUrl(boxed, 1.5))).toBe('<svg viewBox="0 0 8 8" width="24" height="24"/>');
  });
});
