/**
 * Gives a test one realm for binary data, as a browser does. The vmThreads pool runs each test
 * file in a VM context, but Node's `TextEncoder` and happy-dom's `Blob` come from the host realm.
 * So `instanceof ArrayBuffer` fails on an encoded buffer, and `Blob` reads a local `ArrayBuffer`
 * as the string `[object ArrayBuffer]`.
 */

/** True when this file runs in a VM context whose typed arrays differ from Node's. */
function isSplitRealm(): boolean {
  return !(new TextEncoder().encode('') instanceof Uint8Array);
}

/** A `TextEncoder` whose `encode` returns a `Uint8Array` of this realm. */
function localRealmTextEncoder(HostTextEncoder: typeof TextEncoder): typeof TextEncoder {
  return class extends HostTextEncoder {
    override encode(input?: string): Uint8Array<ArrayBuffer> {
      return new Uint8Array(super.encode(input));
    }
  };
}

/** A `Blob` that reads a local `ArrayBuffer` part through a view, which every realm accepts. */
function localRealmBlob(HostBlob: typeof Blob): typeof Blob {
  return class extends HostBlob {
    constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
      super(
        parts?.map((part) => (part instanceof ArrayBuffer ? new Uint8Array(part) : part)),
        options
      );
    }
  };
}

/** Replaces the host-realm `TextEncoder` and `Blob` with ones that speak this realm's buffers. */
export function unifyBinaryRealm(): void {
  if (!isSplitRealm()) return;
  globalThis.TextEncoder = localRealmTextEncoder(globalThis.TextEncoder);
  globalThis.Blob = localRealmBlob(globalThis.Blob);
}
