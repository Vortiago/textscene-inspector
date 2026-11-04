import { describe, expect, it } from 'vitest';
import { ReflectionBuffers } from './reflectionBuffers';
import { testRenderer } from '../../testing/recordingWebGL';

const SHAPE = { width: 640, height: 360, samples: 0, isHalfSize: true };

describe('ReflectionBuffers', () => {
  it.each(['hiz', 'chain'] as const)(
    "holds only Godot's mips in the %s, as three caps the texture's last level there",
    async (name) => {
      const { renderer } = await testRenderer();

      const buffers = new ReflectionBuffers(renderer, SHAPE);

      expect(buffers[name].texture.mipmaps).toHaveLength(buffers.mipCount);
      buffers.dispose();
    }
  );
});
