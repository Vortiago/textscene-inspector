import { describe, expect, it } from 'vitest';
import { parseTouchScreenButton } from './parser';
import { heading } from '../../../parser/testing/parserKit';

const button = heading('TouchScreenButton', { name: 'Jump' });

describe('parseTouchScreenButton', () => {
  it('reads texture_normal on top of the Node2D transform', () => {
    const props = parseTouchScreenButton(button, {
      position: 'Vector2(10, 20)',
      texture_normal: 'ExtResource("1_tex")',
    });

    expect(props.texture_normal).toBe('ExtResource("1_tex")');
    expect(props.position).toEqual({ x: 10, y: 20 });
  });

  it('leaves an unauthored texture_normal undefined, so the button draws nothing', () => {
    expect(parseTouchScreenButton(button, {}).texture_normal).toBeUndefined();
  });

  it('reads a null texture_normal as no texture, as Godot does', () => {
    expect(parseTouchScreenButton(button, { texture_normal: 'null' }).texture_normal).toBeUndefined();
  });

  it('carries an unreadable texture_normal raw, for the resolver to report as a missing resource', () => {
    expect(parseTouchScreenButton(button, { texture_normal: '5' }).texture_normal).toBe('5');
  });
});
