/**
 * The 2D-UI overlay (ADR-0003): a DOM layer mounted as a sibling of the R3F
 * <Canvas> (never inside it). Fills the viewport region; root Control nodes
 * position themselves against it via anchors/offsets (parent kind 'free').
 *
 * Takes the Control subtree roots directly; the shell decides when to mount it
 * (2D viewport mode) vs the 3D canvas — that wiring + the 2D/3D toggle is P4.
 */

import type { CSSProperties } from 'react';
import type { TscnNode } from '../../parser/types';
import { ControlDispatcher } from './ControlDispatcher';
import { ControlParentProvider } from './ControlParentContext';

const OVERLAY_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

export interface ControlOverlayProps {
  nodes: readonly TscnNode[];
}

export function ControlOverlay({ nodes }: ControlOverlayProps) {
  return (
    <div data-control-overlay="true" style={OVERLAY_STYLE}>
      <ControlParentProvider kind="free">
        <ControlDispatcher nodes={nodes} />
      </ControlParentProvider>
    </div>
  );
}
