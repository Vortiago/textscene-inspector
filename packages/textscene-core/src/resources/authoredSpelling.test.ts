/** The inspector's spelling of a re-homed reference: the id its own file wrote. */
import { describe, expect, it } from 'vitest';
import { authoredSpelling } from './authoredSpelling';
import type { SceneScope } from '../parser/types';

const scope: SceneScope = {
  externalResources: [
    { id: '1', type: 'Texture2D', path: 'res://inner.png' },
    { id: '1 (outer)', type: 'Texture2D', path: 'res://outer.png', authoredId: '1' },
  ],
  internalResources: [{ id: 'a (outer)', type: 'Gradient', data: {}, authoredId: 'a' }],
};

describe('authoredSpelling', () => {
  it('spells a renamed copy with the id its file wrote', () => {
    expect(authoredSpelling('ExtResource("1 (outer)")', scope)).toBe('ExtResource("1")');
  });

  it("keeps a reference to the scope's own resource", () => {
    expect(authoredSpelling('ExtResource("1")', scope)).toBe('ExtResource("1")');
  });

  it('keeps a reference the scope does not hold', () => {
    expect(authoredSpelling('ExtResource("9")', scope)).toBe('ExtResource("9")');
  });

  it('looks a SubResource up among the SubResources', () => {
    expect(authoredSpelling('SubResource("a (outer)")', scope)).toBe('SubResource("a")');
  });
});
