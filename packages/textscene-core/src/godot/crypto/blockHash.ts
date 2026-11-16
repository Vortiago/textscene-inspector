const BLOCK_BYTES = 64;

/** 64-byte blocks closed by `0x80`, zeros and the bit length: little-endian for MD5, big for SHA. */
export function hashBlocks(
  chunks: readonly Uint8Array[],
  compress: (block: DataView) => void,
  isLittleEndian: boolean
): void {
  const block = new Uint8Array(BLOCK_BYTES);
  const words = new DataView(block.buffer);
  let filled = 0;
  let length = 0;

  const absorb = (bytes: Uint8Array): void => {
    for (let read = 0; read < bytes.length;) {
      const taken = Math.min(BLOCK_BYTES - filled, bytes.length - read);
      block.set(bytes.subarray(read, read + taken), filled);
      filled += taken;
      read += taken;
      if (filled === BLOCK_BYTES) {
        compress(words);
        filled = 0;
      }
    }
  };

  for (const chunk of chunks) {
    absorb(chunk);
    length += chunk.length;
  }
  absorb(padding(length, filled, isLittleEndian));
}

function padding(length: number, filled: number, isLittleEndian: boolean): Uint8Array {
  const zeros = (BLOCK_BYTES + 55 - filled) % BLOCK_BYTES;
  const tail = new Uint8Array(1 + zeros + 8);
  tail[0] = 0x80;
  const bits = new DataView(tail.buffer, 1 + zeros);
  const low = (length * 8) >>> 0;
  const high = Math.floor(length / 2 ** 29);
  bits.setUint32(isLittleEndian ? 0 : 4, low, isLittleEndian);
  bits.setUint32(isLittleEndian ? 4 : 0, high, isLittleEndian);
  return tail;
}

/** The state words as the digest's bytes. */
export function stateBytes(state: Int32Array, isLittleEndian: boolean): Uint8Array {
  const bytes = new DataView(new ArrayBuffer(state.length * 4));
  state.forEach((word, i) => bytes.setInt32(i * 4, word, isLittleEndian));
  return new Uint8Array(bytes.buffer);
}

/** Bytes as lowercase hex, two digits each. */
export function hexBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const rotateLeft = (word: number, shift: number): number => (word << shift) | (word >>> (32 - shift));
