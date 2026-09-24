/**
 * TextureButton registration contract: the parser self-registers in the NodeRegistry and the
 * native (WebGL canvas) painter in the ControlComponentRegistry. Controls render through the
 * native 2D-UI canvas (ADR-0002), not the 3D NodeComponentRegistry.
 */

import { describe, it, expect } from 'vitest';
import './index'; // parser registration side effect
import './index.r3f'; // native component registration side effect
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { parseTextureButton } from './parser';
import { TextureButton } from './Component';
import { textureButtonMinimumSize, textureButtonTextureSlots } from './nativeSolver';

describe('TextureButton registration', () => {
  it('registers the parser under its type name', () => {
    const reg = nodeRegistry.getRegistration('TextureButton');
    expect(reg).not.toBeNull();
    expect(reg!.parser).toBe(parseTextureButton);
  });

  it('registers the native (WebGL) painter and rect solver', () => {
    expect(controlComponentRegistry.get('TextureButton')).toBe(TextureButton);
    expect(controlSolverRegistry.minimumSize('TextureButton')).toBe(textureButtonMinimumSize);
    expect(controlSolverRegistry.textureSlots('TextureButton')).toBe(textureButtonTextureSlots);
  });
});
