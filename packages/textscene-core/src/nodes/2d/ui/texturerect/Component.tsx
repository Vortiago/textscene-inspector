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
 * `stretch_mode` → CSS object-fit: 0 fill, 2/3 none (intrinsic px), 6 cover,
 * else contain (fit + keep aspect); object-position anchors top-left (2/4) or
 * center (3/5). Mode 1 (tile) renders a background-repeat <div> instead.
 * `flip_h`/`flip_v` add a CSS mirror transform. The image layer is absolutely
 * positioned in a layout-sized wrapper so the texture's intrinsic size can't
 * drive (and overflow) the flex layout — see `textureRectFit`.
 */

import { useMemo, type CSSProperties } from 'react';
import type * as THREE from 'three';
import type { ControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { controlLayoutStyle } from '../../../../r3f/controls/controlLayout';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { resolveTexture2DPath } from '../../../../resources/SubResourceResolver';
import { useResource } from '../../../../resources/useResource';
import type { TextureRectProperties } from './types';

export function TextureRect({ node, children }: ControlComponentProps) {
  const props = node.properties as TextureRectProperties;
  const parentKind = useControlParent();
  const { externalResources, internalResources } = useSceneResources();

  const path = resolveTexture2DPath(props.texture, externalResources, internalResources);

  // Always call the hook (rules of hooks); '' short-circuits to pending.
  const tex = useResource<THREE.Texture>(path ?? '', 'Texture2D');
  const src = useMemo(() => imageToDataUrl(tex.value?.image), [tex.value]);

  const layout = controlLayoutStyle(props, parentKind);

  if (src) {
    // The image layer is absolutely positioned inside this layout-sized wrapper
    // so the texture's intrinsic size never floors the flex layout — a tall
    // portrait fits its box instead of overflowing it (the DialogSystem bug).
    // STRETCH_TILE (1) can't tile via <img>, so it renders a background-repeat
    // <div> instead.
    return (
      <div
        data-control-type="TextureRect"
        data-node-name={node.name}
        style={{ ...layout, overflow: 'hidden' }}
      >
        {props.stretchMode === 1 ? (
          <div data-texture-tile="true" style={textureRectTileStyle(src, props)} />
        ) : (
          <img src={src} alt={node.name} style={textureRectFit(props)} />
        )}
        {children}
      </div>
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
    >
      {children}
    </div>
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
 * CSS for the <img> inside a TextureRect's layout-sized wrapper. The image is
 * taken OUT OF FLOW (`position: absolute; inset: 0`) and sized to the wrapper
 * (`width/height: 100%`), so the texture's intrinsic size never floors the
 * flex layout — a tall portrait fits its box instead of overflowing it (the
 * DialogSystem LeftPortrait bug). `object-fit` follows Godot's stretch_mode
 * (default `contain` — fit + keep aspect, not the intrinsic-size `none`).
 */
interface TextureRectFitProps {
  stretchMode?: number;
  expandMode?: number;
  flipH?: boolean;
  flipV?: boolean;
}

export function textureRectFit(props: TextureRectFitProps): CSSProperties {
  const style: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: stretchObjectFit(props.stretchMode),
  };
  const objectPosition = stretchObjectPosition(props.stretchMode);
  if (objectPosition) style.objectPosition = objectPosition;
  const transform = flipTransform(props);
  if (transform) style.transform = transform;
  return style;
}

/**
 * CSS for STRETCH_TILE (mode 1): a background-repeat layer that tiles the
 * texture at its natural size across the control's box (an <img> can't tile).
 */
export function textureRectTileStyle(src: string, props: TextureRectFitProps): CSSProperties {
  const style: CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundImage: `url(${src})`,
    backgroundRepeat: 'repeat',
    backgroundSize: 'auto',
  };
  const transform = flipTransform(props);
  if (transform) style.transform = transform;
  return style;
}

/** Godot StretchMode → CSS object-fit; default `contain` so images fit, not overflow. */
function stretchObjectFit(mode: number | undefined): CSSProperties['objectFit'] {
  switch (mode) {
    case 0:
      return 'fill';
    case 2: // STRETCH_KEEP
    case 3: // STRETCH_KEEP_CENTERED — intrinsic pixel size, not scaled
      return 'none';
    case 6:
      return 'cover';
    default: // 1 tile (handled by background div), 4/5 keep aspect
      return 'contain';
  }
}

/** Godot StretchMode → CSS object-position (alignment of the drawn texture). */
function stretchObjectPosition(mode: number | undefined): string | undefined {
  switch (mode) {
    case 2: // STRETCH_KEEP → top-left
    case 4: // STRETCH_KEEP_ASPECT → top-left
      return 'top left';
    case 3: // STRETCH_KEEP_CENTERED
    case 5: // STRETCH_KEEP_ASPECT_CENTERED
      return 'center';
    default:
      return undefined;
  }
}

/** `flip_h`/`flip_v` → a CSS mirror transform; undefined when neither is set. */
function flipTransform(props: { flipH?: boolean; flipV?: boolean }): string | undefined {
  if (!props.flipH && !props.flipV) return undefined;
  return `scale(${props.flipH ? -1 : 1}, ${props.flipV ? -1 : 1})`;
}
