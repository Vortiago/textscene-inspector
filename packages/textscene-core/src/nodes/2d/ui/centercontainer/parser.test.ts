import { describe, expect, it } from 'vitest';
import { parseCenterContainer } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('parseCenterContainer', () => {
  it('delegates to the base Control parser', () => {
    const p = parseCenterContainer(heading('CenterContainer', { name: 'Center' }), {
      anchors_preset: '15',
    });
    expect(p.anchorsPreset).toBe(15);
  });

  it('adds no fields beyond Control (size flags still collected)', () => {
    const p = parseCenterContainer(heading('CenterContainer', { name: 'Center' }), {
      size_flags_horizontal: '3',
    });
    expect(p.sizeFlagsHorizontal).toBe(3);
  });
});
