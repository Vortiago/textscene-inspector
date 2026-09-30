/**
 * The tiled upload queue of the `<Canvas>` a consumer draws in. Null outside
 * one, where a texture has no renderer to upload to and passes straight through.
 */
import { createContext } from 'react';
import type { TiledUploadQueue } from './TiledUploadQueue';

export type TiledUploads = Pick<TiledUploadQueue, 'needsTiling' | 'enqueue'>;

export const TiledUploadContext = createContext<TiledUploads | null>(null);
