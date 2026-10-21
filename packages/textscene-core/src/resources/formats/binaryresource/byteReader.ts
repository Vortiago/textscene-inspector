/**
 * A cursor over a binary resource's bytes, read as Godot's `FileAccess` reads them: little endian
 * unless the header says big, and a `real_t` as a float or a double as the header's flag says.
 */

const UTF8 = new TextDecoder('utf-8');

export class ByteReader {
  private readonly view: DataView;
  private offset = 0;
  /** Set once from the header (`resource_format_binary.cpp:1022`). */
  isLittleEndian = true;
  /** Set once from the header's `FORMAT_FLAG_REAL_T_IS_DOUBLE` (`:1053`). */
  isRealDouble = false;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get position(): number {
    return this.offset;
  }

  seek(offset: number): void {
    this.offset = offset;
  }

  u16(): number {
    return this.view.getUint16(this.advance(2), this.isLittleEndian);
  }

  u32(): number {
    return this.view.getUint32(this.advance(4), this.isLittleEndian);
  }

  i32(): number {
    return this.view.getInt32(this.advance(4), this.isLittleEndian);
  }

  u64(): bigint {
    return this.view.getBigUint64(this.advance(8), this.isLittleEndian);
  }

  i64(): bigint {
    return this.view.getBigInt64(this.advance(8), this.isLittleEndian);
  }

  f32(): number {
    return this.view.getFloat32(this.advance(4), this.isLittleEndian);
  }

  f64(): number {
    return this.view.getFloat64(this.advance(8), this.isLittleEndian);
  }

  /** `FileAccess::get_real`: a double when the file stores `real_t` as one. */
  real(): number {
    return this.isRealDouble ? this.f64() : this.f32();
  }

  /** The next `length` bytes, as a view into the file. */
  take(length: number): Uint8Array {
    const start = this.advance(length);
    return this.bytes.subarray(start, start + length);
  }

  /** `get_unicode_string` (`:924-934`): a u32 length, then that many UTF-8 bytes. */
  unicodeString(): string {
    return this.utf8(this.u32());
  }

  /** `length` UTF-8 bytes. The saver counts the terminating NUL into the length, so it is dropped. */
  utf8(length: number): string {
    return UTF8.decode(this.take(length)).replace(/\0+$/, '');
  }

  /** Moves past `length` bytes and returns where they start, refusing a read past the end. */
  private advance(length: number): number {
    const start = this.offset;
    if (start + length > this.bytes.byteLength) {
      throw new Error(
        `expected ${length} more bytes at offset ${start}, got ${this.bytes.byteLength - start}`
      );
    }
    this.offset += length;
    return start;
  }
}
