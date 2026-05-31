/**
 * <TextureRect> — displays a Texture2D image from an ExtResource. The image is
 * loaded host-agnostically via `useResource` (web fetch / VS Code file provider)
 * into a THREE.Texture. For the DOM <img> we can't reuse the texture's
 * `image.src`: the loader typically backs it with a blob URL that is revoked
 * once decoded, so a fresh <img> pointed at it renders broken. Instead we draw
 * the already-decoded image element to a canvas and use a self-contained data
 * URL — the decoded bitmap survives blob revocation. Outside a
 * ResourceLoaderProvider (or before decode) the hook degrades to a placeholder.
 *
 * `stretch_mode` → CSS object-fit: 0 fill, 4/5 contain, 6 cover, else none;
 * modes 3 and 5 also center the image (Godot's KEEP_CENTERED variants).
 */

import { useMemo, type CSSProperties } from 'react';
import type * as THREE from 'three';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import type { TscnExternalResource } from '../../../../parser/types';
import { parseResourceReference } from '../../../../resources/SubResourceResolver';
import { useResource } from '../../../../resources/useResource';
import type { TextureRectProperties } from './types';

export function TextureRect({ node }: ControlComponentProps) {
  const props = node.properties as TextureRectProperties;
  const parentKind = useControlParent();
  const { externalResources } = useSceneResources();

  const path = resolveTexturePath(props.texture, externalResources);

  // Always call the hook (rules of hooks); '' short-circuits to pending.
  const tex = useResource<THREE.Texture>(path ?? '', 'Texture2D');
  const src = useMemo(() => imageToDataUrl(tex.value?.image), [tex.value]);

  const layout = controlLayoutStyle(props, parentKind);

  if (src) {
    const style: CSSProperties = {
      ...layout,
      objectFit: stretchObjectFit(props.stretchMode),
      width: '100%',
      height: '100%',
      display: 'block',
    };
    if (props.stretchMode === 3 || props.stretchMode === 5) {
      style.objectPosition = 'center';
    }
    return (
      <img
        src={src}
        style={style}
        alt={node.name}
        data-control-type="TextureRect"
        data-node-name={node.name}
      />
    );
  }

  return (
    <div
      data-control-type="TextureRect"
      data-control-fallback="true"
      style={{
        ...layout,
        minWidth: 32,
        minHeight: 32,
        outline: '1px dashed #c792ea',
      }}
      title={path ?? 'no texture'}
    />
  );
}

/**
 * Draw a decoded texture image (HTMLImageElement / ImageBitmap / canvas) to a
 * canvas and return a self-contained data URL. The decoded bitmap survives the
 * loader revoking its source blob URL, so this is stable where reusing
 * `image.src` is not. Returns undefined when the image isn't decoded yet, no
 * DOM/canvas is available (jsdom tests), or the draw is cross-origin tainted.
 */
function imageToDataUrl(image: unknown): string | undefined {
  const img = image as
    | { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number }
    | undefined;
  if (!img) return undefined;
  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  if (!w || !h) return undefined;
  const doc = globalThis.document;
  if (!doc) return undefined;
  try {
    const canvas = doc.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(img as CanvasImageSource, 0, 0);
    return canvas.toDataURL();
  } catch {
    return undefined; // tainted canvas / unsupported image source
  }
}

/**
 * Resolve a `texture` reference to a loadable path. `res://` paths pass
 * through; ExtResource ids are looked up in the scene's externalResources
 * table. Mirrors Sprite3D's resolveTexturePath.
 */
function resolveTexturePath(
  textureRef: string | undefined,
  externalResources: readonly TscnExternalResource[]
): string | null {
  if (!textureRef) return null;
  if (textureRef.startsWith('res://')) return textureRef;
  const parsed = parseResourceReference(textureRef);
  if (!parsed || parsed.type !== 'ExtResource') return null;
  const ext = externalResources.find((r) => r.id === parsed.id);
  return ext?.path ?? null;
}

/** Godot StretchMode → CSS object-fit. */
function stretchObjectFit(mode: number | undefined): CSSProperties['objectFit'] {
  switch (mode) {
    case 0:
      return 'fill';
    case 4:
    case 5:
      return 'contain';
    case 6:
      return 'cover';
    default:
      return 'none';
  }
}
