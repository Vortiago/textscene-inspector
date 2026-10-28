/**
 * The quad of a node icon: a unit square of ±0.05 at the node origin, unshaded, with an alpha scissor
 * of 0.1 and no fog, drawn at one on-screen size (`node_3d_editor_gizmos.cpp:331-386,949-985`). A
 * click on it selects its node, since the delegated pointer root resolves the hit to the node group.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { materialProgramInputs } from '../materialProgramInputs';
import { releasedOnUnmount } from '../sharedTexture';
import { GIZMO_RENDER_ORDER, GizmoGroup } from '../components/GizmoGroup';
import { nodeIconUserData } from '../editorHelpers';
import { useGizmoLookValue } from '../gizmo/PluginGizmo';
import type { TscnNode } from '../../parser/types';
import type { EditorIconRegistration } from './editorIconRegistration';
import { editorIconTexture } from './editorIconTexture';
import { iconAppearance } from './iconAppearance';
import { iconWorldMatrix } from './iconWorldMatrix';

const ICON_HALF_SIZE = 0.05;

/** The scissor of the icon material (`node_3d_editor_gizmos.cpp:974-975`). */
const ALPHA_SCISSOR = 0.1;

/** `Vector3(-s, s, 0)` and its three corners, with the UV from the top left (`:338-351`). */
const ICON_QUAD = releasedOnUnmount(new THREE.PlaneGeometry(2 * ICON_HALF_SIZE, 2 * ICON_HALF_SIZE));

/** Scratch, overwritten by every frame. */
const nodeOrigin = new THREE.Vector3();

interface BillboardIconProps {
  node: TscnNode;
  registration: EditorIconRegistration;
}

/** Mounts only inside a {@link PluginGizmo}, which gives the look of the node. */
export function BillboardIcon({ node, registration }: BillboardIconProps) {
  const look = useGizmoLookValue();
  if (!look) throw new Error('expected BillboardIcon inside a PluginGizmo, found none');
  const { icon } = registration;
  const meshRef = useRef<THREE.Mesh>(null);
  // Under the gate, so a node with the Gizmos toggle off never parses its light colour.
  const modulate = useMemo(() => registration.modulate?.(node), [registration, node]);
  const { color, opacity } = useMemo(
    () => iconAppearance(look.variant, look.isInstantiated, modulate),
    [look.variant, look.isInstantiated, modulate]
  );
  const material = useMemo(
    () =>
      materialProgramInputs({
        props: {
          map: editorIconTexture(icon),
          color,
          opacity,
          alphaTest: ALPHA_SCISSOR,
          fog: false,
          side: THREE.DoubleSide,
        },
      }),
    [icon, color, opacity]
  );
  const userData = useMemo(nodeIconUserData, []);

  // The icon writes its own world matrix, as a whole-node billboard does (`nodeBillboard.ts`).
  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    if (!mesh?.parent) return;
    mesh.parent.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();
    nodeOrigin.setFromMatrixPosition(mesh.parent.matrixWorld);
    iconWorldMatrix(mesh.matrixWorld, nodeOrigin, camera);
  });

  return (
    <GizmoGroup>
      <mesh
        ref={meshRef}
        geometry={ICON_QUAD}
        renderOrder={GIZMO_RENDER_ORDER}
        matrixWorldAutoUpdate={false}
        userData={userData}
      >
        <meshBasicMaterial key={material.key} {...material.props} />
      </mesh>
    </GizmoGroup>
  );
}
