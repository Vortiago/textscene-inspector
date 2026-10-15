/** `Light3D`'s class defaults that every light type reads. */

/** `Light3D()` sets `PARAM_SHADOW_OPACITY` to 1 (`scene/3d/light_3d.cpp:488`). */
export const LIGHT_SHADOW_OPACITY_DEFAULT = 1;

/** `Light3D()` sets `PARAM_SPECULAR` to 0.5 (`scene/3d/light_3d.cpp:476`). */
export const LIGHT_SPECULAR_DEFAULT = 0.5;

/** `DirectionalLight3D()` sets `PARAM_SPECULAR` to 1 (`scene/3d/light_3d.cpp:605`). */
export const DIRECTIONAL_LIGHT_SPECULAR_DEFAULT = 1;

/** `Light3D()` sets `PARAM_SIZE` to 0 (`scene/3d/light_3d.cpp:478`). AreaLight3D sets its own. */
export const LIGHT_SIZE_DEFAULT = 0;

/** `Light3D()` sets `PARAM_SHADOW_NORMAL_BIAS` to 1 (`scene/3d/light_3d.cpp:491`). DirectionalLight3D sets its own. */
export const LIGHT_SHADOW_NORMAL_BIAS_DEFAULT = 1;

/** `Light3D()` sets `PARAM_SHADOW_BIAS` to 0.1 (`scene/3d/light_3d.cpp:490`). */
export const LIGHT_SHADOW_BIAS_DEFAULT = 0.1;

/** `SpotLight3D()` sets `PARAM_SHADOW_BIAS` to 0.03 (`scene/3d/light_3d.cpp:681`). */
export const SPOT_LIGHT_SHADOW_BIAS_DEFAULT = 0.03;
