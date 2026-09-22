import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseLinkButton } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseLinkButton', () => {
  it('unquotes text and uri, and reads underline + overrun_behavior', () => {
    const p = parseLinkButton(h({ name: 'Link', type: 'LinkButton' }), {
      text: '"Visit our site"',
      uri: '"https://godotengine.org"',
      underline: '1',
      text_overrun_behavior: '3',
    });
    expect(p.text).toBe('Visit our site');
    expect(p.uri).toBe('https://godotengine.org');
    expect(p.underline).toBe(1);
    expect(p.overrunBehavior).toBe(3);
  });

  it('reads the inherited BaseButton disabled/button_pressed flags', () => {
    const p = parseLinkButton(h({ name: 'Link', type: 'LinkButton' }), {
      disabled: 'true',
      button_pressed: 'true',
    });
    expect(p.disabled).toBe(true);
    expect(p.buttonPressed).toBe(true);
  });

  it('leaves text/uri/underline/overrun_behavior undefined and disabled/button_pressed false when absent', () => {
    const p = parseLinkButton(h({ name: 'Link', type: 'LinkButton' }), {});
    expect(p.text).toBeUndefined();
    expect(p.uri).toBeUndefined();
    expect(p.underline).toBeUndefined();
    expect(p.overrunBehavior).toBeUndefined();
    expect(p.disabled).toBe(false);
    expect(p.buttonPressed).toBe(false);
  });

  it('reads ellipsis_char through the StringName jacket, keeping only its first character (link_button.cpp:93-95)', () => {
    const p = parseLinkButton(h({ name: 'Link', type: 'LinkButton' }), { ellipsis_char: '&"xy"' });
    expect(p.ellipsisChar).toBe('x');
  });

  it('leaves ellipsisChar undefined when absent', () => {
    const p = parseLinkButton(h({ name: 'Link', type: 'LinkButton' }), {});
    expect(p.ellipsisChar).toBeUndefined();
  });
});
