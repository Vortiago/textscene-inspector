/**
 * Godot's sky projection: the sky pass reads only the scale and offset columns of the camera
 * projection (`sky.cpp:224-227`) and casts each pixel's ray through them at a depth of -1
 * (`sky.glsl:218-220`). Under a perspective camera that is the camera's own ray. Under an
 * orthographic one the sky spreads as through a lens whose tangent is the half-extent.
 */

/** GLSL: the view-space ray of a clip-space `xy`, as `sky.glsl:218-220` builds it. */
export const GODOT_SKY_VIEW_RAY = /* glsl */ `vec3(
		( position.xy + vec2( projectionMatrix[ 2 ][ 0 ], projectionMatrix[ 2 ][ 1 ] ) )
			/ vec2( projectionMatrix[ 0 ][ 0 ], projectionMatrix[ 1 ][ 1 ] ),
		- 1.0 )`;
