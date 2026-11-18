import { describe, expect, it } from 'vitest';
import { parseCaseId, parseMaterialOutput } from './materialTexts.mjs';

const line = (id, text) => `MATERIAL ${id} ${Buffer.from(text, 'utf8').toString('base64')}`;

describe('parseMaterialOutput', () => {
  it("reads each material's id and text, and skips Godot's other lines", () => {
    const output = [
      'GODOT 4.6.3-stable',
      line('StandardMaterial3D', 'shader_type spatial;\n'),
      'WARNING: something',
      line('ORMMaterial3D|rim_enabled=true', 'a\tb\n'),
      'MATERIALS DONE',
    ].join('\n');

    expect(parseMaterialOutput(output)).toEqual([
      { id: 'StandardMaterial3D', text: 'shader_type spatial;\n' },
      { id: 'ORMMaterial3D|rim_enabled=true', text: 'a\tb\n' },
    ]);
  });

  it('fails when the run did not end', () => {
    expect(() => parseMaterialOutput(line('StandardMaterial3D', 'x'))).toThrow('expected "MATERIALS DONE"');
  });

  it('fails on a material whose text Godot did not give', () => {
    expect(() => parseMaterialOutput('MATERIAL StandardMaterial3D \nMATERIALS DONE')).toThrow(
      "expected Godot's shader text for material StandardMaterial3D, found none"
    );
  });
});

describe('parseCaseId', () => {
  it("reads a material's class and its settings, a bool as true and the rest as numbers", () => {
    expect(parseCaseId('ORMMaterial3D|rim_enabled=true|stencil_flags=7')).toEqual({
      materialClass: 'ORMMaterial3D',
      settings: { rim_enabled: true, stencil_flags: 7 },
      isNextPass: false,
    });
  });

  it('reads a bool set to false as false', () => {
    expect(parseCaseId('StandardMaterial3D|texture_repeat=false').settings).toEqual({
      texture_repeat: false,
    });
  });

  it("reads the next pass of a material's stencil", () => {
    expect(parseCaseId('StandardMaterial3D|stencil_mode=1|next_pass')).toEqual({
      materialClass: 'StandardMaterial3D',
      settings: { stencil_mode: 1 },
      isNextPass: true,
    });
  });

  it('reads the default material as no settings', () => {
    expect(parseCaseId('StandardMaterial3D').settings).toEqual({});
  });
});
