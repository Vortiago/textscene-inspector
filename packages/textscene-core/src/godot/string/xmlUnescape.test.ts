import { describe, expect, it } from 'vitest';
import { xmlUnescape } from './xmlUnescape';

describe('xmlUnescape', () => {
  it('replaces the five named entities', () => {
    expect(xmlUnescape('&lt;a&gt; &amp; &quot;b&quot; &apos;c&apos;')).toBe(`<a> & "b" 'c'`);
  });

  it('replaces a decimal and a hex character reference', () => {
    expect(xmlUnescape('&#65;&#x42;&#X;&#x1F600;')).toBe('AB&#X;\u{1F600}');
  });

  it('leaves a reference with no closing semicolon as it is', () => {
    expect(xmlUnescape('&#65 &#x41z; &')).toBe('&#65 &#x41z; &');
  });

  it('leaves a reference to code point zero as it is', () => {
    expect(xmlUnescape('&#0; &#x0;')).toBe('&#0; &#x0;');
  });

  it('leaves an unknown named entity as it is', () => {
    expect(xmlUnescape('&nbsp;')).toBe('&nbsp;');
  });
});
