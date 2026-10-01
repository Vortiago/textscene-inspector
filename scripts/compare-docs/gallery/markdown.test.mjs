import { describe, expect, it } from 'vitest';
import { escapeHtml } from './markdown.mjs';

describe('escapeHtml', () => {
  it('escapes the characters that open markup', () => {
    expect(escapeHtml('<a> & b')).toBe('&lt;a&gt; &amp; b');
  });

  it('escapes a double quote, which would end the attribute a panel writes it into', () => {
    expect(escapeHtml('Node "A"')).toBe('Node &quot;A&quot;');
  });

  it('escapes an ampersand before the entities it writes', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('returns plain text unchanged', () => {
    expect(escapeHtml('Sprite3D')).toBe('Sprite3D');
  });
});
