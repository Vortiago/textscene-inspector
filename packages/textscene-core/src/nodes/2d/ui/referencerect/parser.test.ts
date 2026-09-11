import { describe, expect, it } from 'vitest';
import { parseReferenceRect } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('parseReferenceRect', () => {
  it('maps border_color/border_width/editor_only together with base Control layout props', () => {
    const p = parseReferenceRect(heading('ReferenceRect', { name: 'R' }), {
      border_color: 'Color(0, 1, 0, 1)',
      border_width: '2',
      editor_only: 'false',
      anchors_preset: '15',
    });
    expect(p.borderColor).toBe('Color(0, 1, 0, 1)');
    expect(p.borderWidth).toBe(2);
    expect(p.editorOnly).toBe(false);
    expect(p.anchorsPreset).toBe(15);
  });

  it('defaults to reference_rect.h when every property is absent', () => {
    const p = parseReferenceRect(heading('ReferenceRect', { name: 'R' }), {});
    expect(p.borderColor).toBe('Color(1, 0, 0, 1)');
    expect(p.borderWidth).toBe(1);
    expect(p.editorOnly).toBe(true);
  });

  it('clamps a negative border_width to 0, matching set_border_width’s own MAX(0, width) floor', () => {
    const p = parseReferenceRect(heading('ReferenceRect', { name: 'R' }), { border_width: '-5' });
    expect(p.borderWidth).toBe(0);
  });
});
