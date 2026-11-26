import type * as THREE from 'three';

/** The objects three draws with a geometry and a material: a mesh, a line or points. */
export type Drawable = THREE.Mesh | THREE.Line | THREE.Points;
