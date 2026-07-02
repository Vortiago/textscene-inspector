/**
 * AudioStreamPlayer types.
 *
 * Property surface matches the linter validators in linterParser.ts.
 * AudioStreamPlayer is non-spatial (extends Node, not Node2D/Node3D).
 */

import type { NodeProperties } from '../../node/types';
import type { AudioStreamBaseProperties } from '../types';

export interface AudioStreamPlayerProperties
  extends NodeProperties,
    AudioStreamBaseProperties {}
