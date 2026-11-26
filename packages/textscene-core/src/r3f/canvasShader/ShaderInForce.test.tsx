import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { useIsReachedByLight } from '../components/LitCanvasItemPixels';
import { useClipMask } from '../canvasGroup/ClipMaskContext';
import type { ClipMask } from '../canvasGroup/clipMask';
import { ShaderInForce } from './ShaderInForce';

vi.mock('../components/LitCanvasItemPixels', () => ({ useIsReachedByLight: vi.fn() }));
vi.mock('../canvasGroup/ClipMaskContext', () => ({ useClipMask: vi.fn() }));

const shaderNamed = (file: string): ShaderText => ({ code: '', file, parameters: {}, textures: {} });
const OWN = shaderNamed('own');
const MATERIAL = shaderNamed('material');

const MASK = {} as ClipMask;

/** What `ShaderInForce` draws: the file of the shader it hands its children, or `classic`. */
function drawn(
  shader: ShaderText | null,
  materialShader: ShaderText | null,
  isReachedByLight: boolean,
  isClipMask = false
) {
  vi.mocked(useIsReachedByLight).mockReturnValue(isReachedByLight);
  vi.mocked(useClipMask).mockReturnValue(isClipMask ? MASK : null);
  const { container } = render(
    <ShaderInForce shader={shader} materialShader={materialShader} fallback="classic">
      {(inForce) => inForce.file}
    </ShaderInForce>
  );
  return container.textContent;
}

describe('ShaderInForce', () => {
  it.each([
    [OWN, MATERIAL, false, 'own'],
    [OWN, MATERIAL, true, 'own'],
    [OWN, null, true, 'own'],
    [null, MATERIAL, false, 'material'],
    [null, MATERIAL, true, 'classic'],
    [null, null, false, 'classic'],
    [null, null, true, 'classic'],
  ] as const)(
    'with own %o, material %o and a light %s draws %s',
    (shader, materialShader, isLit, expected) => {
      expect(drawn(shader, materialShader, isLit)).toBe(expected);
    }
  );

  it.each([
    [OWN, 'own'],
    [null, 'classic'],
  ] as const)("draws a clip_children owner's own pixels with own %o through %s", (shader, expected) => {
    expect(drawn(shader, MATERIAL, false, true)).toBe(expected);
  });
});
