import { useMemo } from 'react';
import type { Sky } from '../../resources/sky/types';
import type { ShaderDecoders } from '../../shaders/preprocessor/decoders';
import { skyUsage } from '../../shaders/sky/skyUsage';
import { mayDecompress } from '../shaderDecoders';

/** The decode has no decoders, so a text whose `#if` decompresses reads its usage again once they load. */
export function useDecompressedSky(sky: Sky, decoders: ShaderDecoders | null): Sky {
  return useMemo(() => {
    const { material } = sky;
    if (material.kind !== 'shader' || !decoders || !mayDecompress(material.code)) return sky;
    return { ...sky, material: { ...material, usage: skyUsage(material.code, { decoders }) } };
  }, [sky, decoders]);
}
