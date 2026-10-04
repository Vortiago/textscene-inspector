import { describe, expect, it } from 'vitest';
import { codeActions } from './codeActions';
import { LanguageDocument } from './document';
import { SCENE } from './fixtures.testkit';

function titles(text: string): string[] {
  return codeActions(new LanguageDocument(text)).map((action) => action.title);
}

describe('codeActions', () => {
  it('renames a deprecated property spelling to the engine name', () => {
    const text = ['[node name="S" type="AnimatedSprite2D"]', 'frames = ExtResource("1")'].join('\n');
    const action = codeActions(new LanguageDocument(text))[0]!;
    expect(action.title).toBe("Rename deprecated 'frames' to 'sprite_frames'");
    expect(action.edit).toEqual([
      {
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 6 } },
        newText: 'sprite_frames',
      },
    ]);
  });

  it('repairs a property key to its nearest catalogued spelling', () => {
    const text = ['[node name="M" type="MeshInstance3D"]', 'mash = ExtResource("1")'].join('\n');
    expect(titles(text)).toEqual(["Change 'mash' to 'mesh'"]);
  });

  it('repairs a node type that no class matches', () => {
    const text = '[node name="M" type="MeshInstnce3D"]';
    expect(titles(text)).toEqual(["Change 'MeshInstnce3D' to 'MeshInstance3D'"]);
  });

  it('offers nothing for a scene whose names are all catalogued', () => {
    expect(codeActions(new LanguageDocument(SCENE))).toEqual([]);
  });

  it('narrows to the sections a range overlaps', () => {
    const text = [
      '[node name="A" type="MeshInstnce3D"]',
      '',
      '[node name="B" type="MeshInstance3D"]',
      'mash = null',
    ].join('\n');
    const actions = codeActions(new LanguageDocument(text), {
      start: { line: 2, character: 0 },
      end: { line: 3, character: 10 },
    });
    expect(actions.map((action) => action.title)).toEqual(["Change 'mash' to 'mesh'"]);
  });
});
