/** The WebGL2 calls that send texels to a texture. */
const UPLOAD_CALLS = [
  'texImage2D',
  'texSubImage2D',
  'texImage3D',
  'texSubImage3D',
  'compressedTexImage2D',
  'compressedTexSubImage2D',
  'compressedTexImage3D',
  'compressedTexSubImage3D',
] as const;

type UploadCall = (typeof UPLOAD_CALLS)[number];

/** Calls `onUpload` at each texture upload on `gl`, until the returned stop puts the own calls back. */
export function countTextureUploads(gl: WebGL2RenderingContext, onUpload: () => void): () => void {
  const own = new Map<UploadCall, (...args: unknown[]) => unknown>();
  for (const call of UPLOAD_CALLS) {
    const upload = gl[call] as ((...args: unknown[]) => unknown) | undefined;
    if (!upload) continue;
    own.set(call, upload);
    Object.assign(gl, {
      [call]: (...args: unknown[]) => {
        onUpload();
        return upload.apply(gl, args);
      },
    });
  }
  return () => {
    for (const [call, upload] of own) Object.assign(gl, { [call]: upload });
  };
}
