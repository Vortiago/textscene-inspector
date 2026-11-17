import { useEffect, useState } from 'react';
import type { ShaderDecoders } from '../shaders/preprocessor/decoders.js';
import { memoisedImport } from '../resources/memoisedImport.js';
import { loadBrotliDecoder } from './controls/native/text/brotliDecoder.js';

/** Imported only for a text that may decompress, as the two decoders are about 60 kB gzipped. */
const loadZstdDecoder = memoisedImport(() => import('fzstd').then((module) => module.decompress));

/** The Zstandard and Brotli decoders the previewer lends a shader's `#if`, one import shared by all. */
const loadShaderDecoders = memoisedImport(async (): Promise<ShaderDecoders> => {
  const [zstd, brotli] = await Promise.all([loadZstdDecoder(), loadBrotliDecoder()]);
  return { zstd, brotli };
});

/** A text that never names `decompress` decodes nothing, so it waits for no import. */
export function mayDecompress(code: string): boolean {
  return code.includes('decompress');
}

/** The decoders once loaded, `{}` for a text that needs none, and null while they load. */
export function useShaderDecoders(code: string | null): ShaderDecoders | null {
  const isNeeded = code !== null && mayDecompress(code);
  const loaded = loadShaderDecoders.state();
  const [decoders, setDecoders] = useState<ShaderDecoders | null>(
    typeof loaded === 'object' ? loaded.module : null
  );
  useEffect(() => {
    if (!isNeeded || decoders) return undefined;
    let isCurrent = true;
    loadShaderDecoders().then(
      (module) => isCurrent && setDecoders(module),
      () => isCurrent && setDecoders({})
    );
    return () => {
      isCurrent = false;
    };
  }, [isNeeded, decoders]);
  if (!isNeeded) return NO_DECODERS;
  return decoders;
}

const NO_DECODERS: ShaderDecoders = {};
