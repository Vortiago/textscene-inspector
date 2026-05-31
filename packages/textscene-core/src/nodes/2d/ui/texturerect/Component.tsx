/**
 * <TextureRect> — displays a Texture2D image from an ExtResource. The image
 * is loaded host-agnostically via `useResource` (web fetch / VS Code file
 * provider), so the rendered <img> src comes from the loaded THREE.Texture's
 * decoded image rather than a raw URL. Outside a ResourceLoaderProvider the
 * hook degrades to a dashed placeholder.
 *
 * `stretch_mode` → CSS object-fit: 0 fill, 4/5 contain, 6 cover, else none;
 * modes 3 and 5 also center the image (Godot's KEEP_CENTERED variants).
 */

import type { CSSProperties } from 'react';
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
  const src = (tex.value?.image as { src?: string } | undefined)?.src;

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
