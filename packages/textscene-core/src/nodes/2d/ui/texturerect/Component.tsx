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
import { controlStyle } from '../../../../r3f/controls/controlLayout';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { resolveTexture2DSource } from '../../../../resources/SubResourceResolver';
import { atlasRegionDataUrl } from '../../../../resources/textures/atlastexture/build';
import { imageToDataUrl } from '../../../../r3f/controls/imageToDataUrl';
import { useResource } from '../../../../resources/useResource';
import type { TextureRectProperties } from './types';

export function TextureRect({ node, children }: ControlComponentProps) {
  const props = node.properties as TextureRectProperties;
  const parentKind = useControlParent();
  const { externalResources, internalResources } = useSceneResources();

  // An AtlasTexture resolves to the SHEET plus the cell to show. A control draws
  // an <img>, not a textured quad, so the cell is cut out of the decoded bitmap
  // rather than windowed with UVs — and the control's intrinsic size is the
  // cell's, since Godot sizes it from `texture->get_size()`, which for an
  // AtlasTexture is its region (atlas_texture.cpp:33-42).
  const { path, region } = resolveTexture2DSource(props.texture, externalResources, internalResources);

  // Always call the hook (rules of hooks); '' short-circuits to pending.
  const tex = useResource<THREE.Texture>(path ?? '', 'Texture2D');
  const src = useMemo(
    () =>
      region ? atlasRegionDataUrl(tex.value?.image, region) : imageToDataUrl(tex.value?.image),
    [tex.value, region]
  );

  const layout = controlStyle(
    props,
    parentKind,
    textureRectMinSize(props.expandMode, region ?? (tex.value?.image as ImageLike | undefined))
  );

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

/** Just enough of a decoded image to read its pixel dimensions. */
interface ImageLike {
  width?: number;
  height?: number;
  naturalWidth?: number;
  naturalHeight?: number;
}

/**
 * The minimum size a TextureRect contributes to its parent's layout, from
 * `expand_mode` (`texture_rect.cpp::get_minimum_size()`).
 *
 * The default EXPAND_KEEP_SIZE floors the control at the texture's own size —
 * without it, a TextureRect inside a container collapses to nothing, because
 * the `<img>` is positioned out of flow so it cannot floor anything itself.
 *
 * The four FIT_* modes derive their minimum from the control's CURRENT size, a
 * self-referential rule with no direct CSS equivalent — but `aspect-ratio`
 * states the same relationship from the other direction. FIT_WIDTH/FIT_HEIGHT
 * tie the two axes 1:1 ("the height of the texture will be ignored"), and the
 * PROPORTIONAL pair ties them at the texture's aspect. What CSS resolves for us
 * rather than being told is WHICH axis is authoritative.
 */
export function textureRectMinSize(
  expandMode: number | undefined,
  image: ImageLike | undefined
): CSSProperties {
  const width = image?.naturalWidth || image?.width || 0;
  const height = image?.naturalHeight || image?.height || 0;
  if (width <= 0 || height <= 0) return {};

  switch (expandMode ?? 0) {
    case 0: // EXPAND_KEEP_SIZE
      return { minWidth: width, minHeight: height };
    case 2: // EXPAND_FIT_WIDTH — one axis follows the other, texture aspect ignored
    case 4: // EXPAND_FIT_HEIGHT
      return { aspectRatio: '1 / 1' };
    case 3: // EXPAND_FIT_WIDTH_PROPORTIONAL
    case 5: // EXPAND_FIT_HEIGHT_PROPORTIONAL
      return { aspectRatio: `${width} / ${height}` };
    default: // EXPAND_IGNORE_SIZE
      return {};
  }
}
