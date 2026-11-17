import { describe, expect, it, vi } from 'vitest';
import { baseMaterialShader } from './baseMaterialShader.js';
import * as renderModes from './renderModes.js';

vi.mock('./renderModes.js', { spy: true });

describe('baseMaterialShader', () => {
  it('writes one text for one key, as Godot caches one shader per material key', () => {
    const first = baseMaterialShader('StandardMaterial3D', { rim_enabled: true, rim: 0.2 });
    const writes = vi.mocked(renderModes.renderModes).mock.calls.length;

    const second = baseMaterialShader('StandardMaterial3D', { rim_enabled: true, rim: 0.9 });

    expect(second).toBe(first);
    expect(vi.mocked(renderModes.renderModes).mock.calls.length).toBe(writes);
  });

  it('writes another text for another key', () => {
    const rim = baseMaterialShader('StandardMaterial3D', { rim_enabled: true });

    expect(baseMaterialShader('ORMMaterial3D', { rim_enabled: true })).not.toBe(rim);
  });
});
