# Instruction table

The shader package transpiles Godot 4.6.3's shading language instruction by instruction. This
table lists every instruction, read from Godot's source by `pnpm godot:shader-language`. Do
not edit it by hand.

A row is transpiled when a probe names it. The probe's record holds Godot's own answers, and the
real-GL test checks the transpilation against them. An open row names the issue that transpiles it.

A transpiled row states what the emitter writes for each target: `native` when its TSL node is the
GLSL or WGSL operation itself, `lowered` with the name of the operations it writes instead. The
probes run on WebGL 2. WebGPURenderer runs the same TSL nodes, and no probe runs there until the
canvases draw on WebGPURenderer (#1788).

1515 of 1889 instructions transpiled.

## data type

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `void` | transpiled (`function-vector-array-out`, `function-out-index-read-before-another-out`, `function-inout-index-read-before-an-out`, `function-void-call-discards`, `function-void`, `function-out`, `function-out-before-read`, `function-inout-twice`, `function-inout-read-after-a-writing-argument`, `function-inout-vector-lane`, `function-inout-array-element`, `function-inout-struct-member`, `function-out-struct`, `function-out-array`, `function-void-value`, `function-void-return-value`, `function-void-argument`, `function-out-constant`, `function-out-expression`, `function-out-const-local`, `function-out-swizzle-twice`, `function-out-member-of-call`, `function-inout-member-of-sum`, `function-const-out`, `function-const-inout`, `function-qualifier-twice`) | native | untested (#1788) | `servers/rendering/shader_language.h:210` |
| `bool` | transpiled (`type-bool`) | native | untested (#1788) | `servers/rendering/shader_language.h:211` |
| `bvec2` | transpiled (`type-bvec2`) | native | untested (#1788) | `servers/rendering/shader_language.h:212` |
| `bvec3` | transpiled (`type-bvec3`) | native | untested (#1788) | `servers/rendering/shader_language.h:213` |
| `bvec4` | transpiled (`type-bvec4`) | native | untested (#1788) | `servers/rendering/shader_language.h:214` |
| `int` | transpiled (`type-int`) | native | untested (#1788) | `servers/rendering/shader_language.h:215` |
| `ivec2` | transpiled (`type-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.h:216` |
| `ivec3` | transpiled (`type-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.h:217` |
| `ivec4` | transpiled (`type-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.h:218` |
| `uint` | transpiled (`type-uint`, `folding-negative-int-to-uint`) | native | untested (#1788) | `servers/rendering/shader_language.h:219` |
| `uvec2` | transpiled (`type-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.h:220` |
| `uvec3` | transpiled (`type-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.h:221` |
| `uvec4` | transpiled (`type-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.h:222` |
| `float` | transpiled (`type-float`) | native | untested (#1788) | `servers/rendering/shader_language.h:223` |
| `vec2` | transpiled (`type-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.h:224` |
| `vec3` | transpiled (`type-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.h:225` |
| `vec4` | transpiled (`type-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.h:226` |
| `mat2` | transpiled (`type-mat2`) | native | untested (#1788) | `servers/rendering/shader_language.h:227` |
| `mat3` | transpiled (`type-mat3`) | native | untested (#1788) | `servers/rendering/shader_language.h:228` |
| `mat4` | transpiled (`type-mat4`) | native | untested (#1788) | `servers/rendering/shader_language.h:229` |
| `sampler2D` | transpiled (`texture-removed-screen-texture`, `texture-removed-depth-texture`, `texture-removed-normal-roughness-texture`, `texture-2d-filter_nearest`, `texture-2d-filter_linear`, `texture-2d-filter_nearest_mipmap`, `texture-2d-filter_linear_mipmap`, `texture-2d-filter_nearest_mipmap_anisotropic`, `texture-2d-filter_linear_mipmap_anisotropic`, `texture-2d-default-filter`, `texture-2d-repeat-enable`, `texture-2d-repeat-disable`, `texture-unset-none`, `texture-unset-hint_default_white`, `texture-unset-hint_default_black`, `texture-unset-hint_default_transparent`, `texture-unset-hint_normal`, `texture-unset-hint_roughness_normal`, `texture-unset-hint_anisotropy`, `texture-unset-hint_roughness_r`, `texture-unset-hint_roughness_g`, `texture-unset-hint_roughness_b`, `texture-unset-hint_roughness_a`, `texture-unset-hint_roughness_gray`, `texture-set-null-default-black`, `texture-2d-lod`, `texture-2d-lod-linear-mipmap`, `texture-2d-lod-linear-no-mipmap-filter`, `texture-2d-texel-fetch`, `texture-2d-size`, `texture-2d-size-unset`, `texture-2d-source-color`, `texture-2d-source-color-hdr`, `texture-argument`, `texture-array-elements`, `texture-array-computed-index`, `texture-array-computed-argument`, `texture-function-textureSize-sampler2D-int`, `texture-function-texture-sampler2D-vec2`, `texture-function-texture-sampler2D-vec2-float`, `texture-function-textureProj-sampler2D-vec3`, `texture-function-textureProj-sampler2D-vec4`, `texture-function-textureProj-sampler2D-vec3-float`, `texture-function-textureProj-sampler2D-vec4-float`, `texture-function-textureLod-sampler2D-vec2-float`, `texture-function-texelFetch-sampler2D-ivec2-int`, `texture-function-textureProjLod-sampler2D-vec3-float`, `texture-function-textureProjLod-sampler2D-vec4-float`, `texture-function-textureGrad-sampler2D-vec2-vec2-vec2`, `texture-function-textureProjGrad-sampler2D-vec3-vec2-vec2`, `texture-function-textureProjGrad-sampler2D-vec4-vec2-vec2`, `texture-function-textureGather-sampler2D-vec2`, `texture-function-textureGather-sampler2D-vec2-int`, `texture-function-textureQueryLod-sampler2D-vec2`, `texture-function-textureQueryLevels-sampler2D`) | native | untested (#1788) | `servers/rendering/shader_language.h:230` |
| `isampler2D` | transpiled (`texture-function-textureSize-isampler2D-int`, `texture-function-texture-isampler2D-vec2`, `texture-function-texture-isampler2D-vec2-float`, `texture-function-textureProj-isampler2D-vec3`, `texture-function-textureProj-isampler2D-vec4`, `texture-function-textureProj-isampler2D-vec3-float`, `texture-function-textureProj-isampler2D-vec4-float`, `texture-function-textureLod-isampler2D-vec2-float`, `texture-function-texelFetch-isampler2D-ivec2-int`, `texture-function-textureProjLod-isampler2D-vec3-float`, `texture-function-textureProjLod-isampler2D-vec4-float`, `texture-function-textureGrad-isampler2D-vec2-vec2-vec2`, `texture-function-textureProjGrad-isampler2D-vec3-vec2-vec2`, `texture-function-textureProjGrad-isampler2D-vec4-vec2-vec2`, `texture-function-textureGather-isampler2D-vec2`, `texture-function-textureGather-isampler2D-vec2-int`, `texture-function-textureQueryLod-isampler2D-vec2`, `texture-function-textureQueryLevels-isampler2D`) | native | untested (#1788) | `servers/rendering/shader_language.h:231` |
| `usampler2D` | transpiled (`texture-unsigned`, `texture-function-textureSize-usampler2D-int`, `texture-function-texture-usampler2D-vec2`, `texture-function-texture-usampler2D-vec2-float`, `texture-function-textureProj-usampler2D-vec3`, `texture-function-textureProj-usampler2D-vec4`, `texture-function-textureProj-usampler2D-vec3-float`, `texture-function-textureProj-usampler2D-vec4-float`, `texture-function-textureLod-usampler2D-vec2-float`, `texture-function-texelFetch-usampler2D-ivec2-int`, `texture-function-textureProjLod-usampler2D-vec3-float`, `texture-function-textureProjLod-usampler2D-vec4-float`, `texture-function-textureGrad-usampler2D-vec2-vec2-vec2`, `texture-function-textureProjGrad-usampler2D-vec3-vec2-vec2`, `texture-function-textureProjGrad-usampler2D-vec4-vec2-vec2`, `texture-function-textureGather-usampler2D-vec2`, `texture-function-textureGather-usampler2D-vec2-int`, `texture-function-textureQueryLod-usampler2D-vec2`, `texture-function-textureQueryLevels-usampler2D`) | native | untested (#1788) | `servers/rendering/shader_language.h:232` |
| `sampler2DArray` | transpiled (`texture-layers-lod-rg8`, `texture-layers`, `texture-function-textureSize-sampler2DArray-int`, `texture-function-texture-sampler2DArray-vec3`, `texture-function-texture-sampler2DArray-vec3-float`, `texture-function-textureLod-sampler2DArray-vec3-float`, `texture-function-texelFetch-sampler2DArray-ivec3-int`, `texture-function-textureGrad-sampler2DArray-vec3-vec2-vec2`, `texture-function-textureGather-sampler2DArray-vec3`, `texture-function-textureGather-sampler2DArray-vec3-int`, `texture-function-textureQueryLod-sampler2DArray-vec2`, `texture-function-textureQueryLevels-sampler2DArray`) | native | untested (#1788) | `servers/rendering/shader_language.h:233` |
| `isampler2DArray` | transpiled (`texture-function-textureSize-isampler2DArray-int`, `texture-function-texture-isampler2DArray-vec3`, `texture-function-texture-isampler2DArray-vec3-float`, `texture-function-textureLod-isampler2DArray-vec3-float`, `texture-function-texelFetch-isampler2DArray-ivec3-int`, `texture-function-textureGrad-isampler2DArray-vec3-vec2-vec2`, `texture-function-textureGather-isampler2DArray-vec3`, `texture-function-textureGather-isampler2DArray-vec3-int`, `texture-function-textureQueryLod-isampler2DArray-vec2`, `texture-function-textureQueryLevels-isampler2DArray`) | native | untested (#1788) | `servers/rendering/shader_language.h:234` |
| `usampler2DArray` | transpiled (`texture-function-textureSize-usampler2DArray-int`, `texture-function-texture-usampler2DArray-vec3`, `texture-function-texture-usampler2DArray-vec3-float`, `texture-function-textureLod-usampler2DArray-vec3-float`, `texture-function-texelFetch-usampler2DArray-ivec3-int`, `texture-function-textureGrad-usampler2DArray-vec3-vec2-vec2`, `texture-function-textureGather-usampler2DArray-vec3`, `texture-function-textureGather-usampler2DArray-vec3-int`, `texture-function-textureQueryLod-usampler2DArray-vec2`, `texture-function-textureQueryLevels-usampler2DArray`) | native | untested (#1788) | `servers/rendering/shader_language.h:235` |
| `sampler3D` | transpiled (`texture-3d-lod`, `texture-volume`, `texture-function-textureSize-sampler3D-int`, `texture-function-texture-sampler3D-vec3`, `texture-function-texture-sampler3D-vec3-float`, `texture-function-textureProj-sampler3D-vec4`, `texture-function-textureProj-sampler3D-vec4-float`, `texture-function-textureLod-sampler3D-vec3-float`, `texture-function-texelFetch-sampler3D-ivec3-int`, `texture-function-textureProjLod-sampler3D-vec4-float`, `texture-function-textureGrad-sampler3D-vec3-vec3-vec3`, `texture-function-textureProjGrad-sampler3D-vec4-vec3-vec3`, `texture-function-textureQueryLod-sampler3D-vec3`, `texture-function-textureQueryLevels-sampler3D`) | native | untested (#1788) | `servers/rendering/shader_language.h:236` |
| `isampler3D` | transpiled (`texture-function-textureSize-isampler3D-int`, `texture-function-texture-isampler3D-vec3`, `texture-function-texture-isampler3D-vec3-float`, `texture-function-textureProj-isampler3D-vec4`, `texture-function-textureProj-isampler3D-vec4-float`, `texture-function-textureLod-isampler3D-vec3-float`, `texture-function-texelFetch-isampler3D-ivec3-int`, `texture-function-textureProjLod-isampler3D-vec4-float`, `texture-function-textureGrad-isampler3D-vec3-vec3-vec3`, `texture-function-textureProjGrad-isampler3D-vec4-vec3-vec3`, `texture-function-textureQueryLod-isampler3D-vec3`, `texture-function-textureQueryLevels-isampler3D`) | native | untested (#1788) | `servers/rendering/shader_language.h:237` |
| `usampler3D` | transpiled (`texture-function-textureSize-usampler3D-int`, `texture-function-texture-usampler3D-vec3`, `texture-function-texture-usampler3D-vec3-float`, `texture-function-textureProj-usampler3D-vec4`, `texture-function-textureProj-usampler3D-vec4-float`, `texture-function-textureLod-usampler3D-vec3-float`, `texture-function-texelFetch-usampler3D-ivec3-int`, `texture-function-textureProjLod-usampler3D-vec4-float`, `texture-function-textureGrad-usampler3D-vec3-vec3-vec3`, `texture-function-textureProjGrad-usampler3D-vec4-vec3-vec3`, `texture-function-textureQueryLod-usampler3D-vec3`, `texture-function-textureQueryLevels-usampler3D`) | native | untested (#1788) | `servers/rendering/shader_language.h:238` |
| `samplerCube` | transpiled (`texture-cube`, `texture-function-textureSize-samplerCube-int`, `texture-function-texture-samplerCube-vec3`, `texture-function-texture-samplerCube-vec3-float`, `texture-function-textureLod-samplerCube-vec3-float`, `texture-function-textureGrad-samplerCube-vec3-vec3-vec3`, `texture-function-textureGather-samplerCube-vec3`, `texture-function-textureGather-samplerCube-vec3-int`, `texture-function-textureQueryLod-samplerCube-vec3`, `texture-function-textureQueryLevels-samplerCube`) | native | untested (#1788) | `servers/rendering/shader_language.h:239` |
| `samplerCubeArray` | transpiled (`texture-cubes-size-lane`, `texture-cubes-size-swizzle`, `texture-cubes-size-float-constructor`, `texture-cubes-size-int-constructor`, `texture-cubes-size-first-of-two`, `texture-cubes-size-last-of-three`, `texture-cubes-size-before-scalar`, `texture-cubes-size-scaled-lane`, `texture-cubes-size-vector-sum`, `texture-cubes-size-component-wise-call`, `texture-cubes-size-equal-sizes`, `texture-cubes-size-equal-vector`, `texture-cubes-size-choice`, `texture-cubes-size-returned`, `texture-cubes-size-declared`, `texture-unset-cubes-none`, `texture-unset-cubes-hint_default_white`, `texture-unset-cubes-hint_default_black`, `texture-unset-cubes-hint_default_transparent`, `texture-cubes`, `texture-cubes-linear-edges`, `texture-function-textureSize-samplerCubeArray-int`, `texture-function-texture-samplerCubeArray-vec4`, `texture-function-texture-samplerCubeArray-vec4-float`, `texture-function-textureLod-samplerCubeArray-vec4-float`, `texture-function-textureGrad-samplerCubeArray-vec4-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.h:240` |
| `samplerExternalOES` | transpiled (`texture-unset-external-array`, `texture-external`, `texture-external-bias`) | native | untested (#1788) | `servers/rendering/shader_language.h:241` |
| `struct type` | transpiled (`statement-struct`, `statement-struct-member-write`, `statement-struct-array-member`, `statement-struct-array`, `statement-struct-nested`, `statement-struct-assign`, `statement-struct-array-elements`, `statement-struct-array-initialiser-list`, `statement-struct-array-unsized`, `statement-struct-wrong-argument`, `statement-struct-unknown-member`) | native | untested (#1788) | `servers/rendering/shader_language.h:242` |

## literal

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `float literal` | transpiled (`literal-0`, `literal-1`, `literal-2`, `literal-3`, `literal-4`, `literal-5`, `literal-unfolded`, `literal-overflow`, `fold-sum`, `fold-chain`, `fold-difference-quotient`, `fold-vector-scalar`, `fold-quotient-vector`, `fold-swizzle`, `fold-negated-sum`, `fold-overflow`, `fold-negative-zero`, `fold-division-by-zero`, `fold-chain-add-div`, `fold-chain-div-div`, `fold-chain-mul-sub`, `fold-chain-sub-mul`, `fold-chain-mul-div`, `fold-chain-add-sub`, `fold-chain-div-add`, `fold-chain-div-mul`, `fold-chain-mul-add`, `fold-chain-mul-mul`, `fold-chain-sub-sub`, `fold-chain-add-add`, `fold-mixed-vector`, `fold-mixed-vector-scalar`, `fold-mixed-scalar-vector`, `fold-mixed-swizzle`) | native | untested (#1788) | `servers/rendering/shader_language.h:59` |
| `int literal` | transpiled (`literal-int`, `literal-int-overflow`, `literal-int-unfolded`) | native | untested (#1788) | `servers/rendering/shader_language.h:60` |
| `uint literal` | transpiled (`literal-uint`, `literal-uint-overflow`, `literal-uint-negated`) | native | untested (#1788) | `servers/rendering/shader_language.h:61` |
| `true` | transpiled (`literal-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:284` |
| `false` | transpiled (`literal-bool-false`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:285` |

## qualifier

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `flat` | open, #1831 | | | `servers/rendering/shader_language.cpp:324` |
| `smooth` | open, #1831 | | | `servers/rendering/shader_language.cpp:325` |
| `lowp` | transpiled (`precision-lowp`) | lowered: dropped: every float is 32-bit | untested (#1788) | `servers/rendering/shader_language.cpp:329` |
| `mediump` | transpiled (`precision-mediump`) | lowered: dropped: every float is 32-bit | untested (#1788) | `servers/rendering/shader_language.cpp:330` |
| `highp` | transpiled (`precision-highp`) | lowered: dropped: every float is 32-bit | untested (#1788) | `servers/rendering/shader_language.cpp:331` |
| `in` | transpiled (`function-in`, `function-in-unwritten-caller`, `function-const-in`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:366` |
| `out` | transpiled (`function-vector-array-out`, `function-out-index-read-before-another-out`, `function-inout-index-read-before-an-out`, `function-out`, `function-out-before-read`, `function-out-value-function`, `function-out-struct`, `function-out-array`, `function-out-constant`, `function-out-expression`, `function-out-const-local`, `function-out-swizzle-twice`, `function-out-member-of-call`, `function-const-out`, `function-qualifier-twice`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:367` |
| `inout` | transpiled (`function-inout-index-read-before-an-out`, `function-inout-twice`, `function-inout-in-expression`, `function-inout-read-after-a-writing-argument`, `function-inout-read-after-a-writing-argument-of-a-value-call`, `function-inout-vector-lane`, `function-inout-array-element`, `function-inout-struct-member`, `function-inout-member-of-sum`, `function-const-inout`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:368` |

## shader head

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `uniform` | transpiled (`uniform-default-float`, `uniform-default-int`, `uniform-default-uint`, `uniform-default-bool`, `uniform-default-vec2`, `uniform-default-vec3`, `uniform-default-vec4`, `uniform-default-ivec2`, `uniform-default-ivec3`, `uniform-default-ivec4`, `uniform-default-uvec2`, `uniform-default-uvec3`, `uniform-default-uvec4`, `uniform-default-bvec2`, `uniform-default-bvec3`, `uniform-default-bvec4`, `uniform-default-mat2`, `uniform-default-mat3`, `uniform-default-mat4`, `uniform-unset-float`, `uniform-unset-int`, `uniform-unset-uint`, `uniform-unset-bool`, `uniform-unset-vec2`, `uniform-unset-vec3`, `uniform-unset-vec4`, `uniform-unset-ivec2`, `uniform-unset-ivec3`, `uniform-unset-ivec4`, `uniform-unset-uvec2`, `uniform-unset-uvec3`, `uniform-unset-uvec4`, `uniform-unset-bvec2`, `uniform-unset-bvec3`, `uniform-unset-bvec4`, `uniform-unset-mat2`, `uniform-unset-mat3`, `uniform-unset-mat4`, `uniform-default-int-to-float`, `uniform-default-int-to-uint`, `uniform-default-uint-to-int`, `uniform-precision`, `uniform-material-float`, `uniform-material-float-of-int`, `uniform-material-float-of-string`, `uniform-material-int`, `uniform-material-int-of-float`, `uniform-material-uint`, `uniform-material-uint-of-negative`, `uniform-material-uint-of-large-float`, `uniform-material-bool`, `uniform-material-bool-of-int`, `uniform-material-vec2`, `uniform-material-vec2-of-vector3`, `uniform-material-vec2-of-array`, `uniform-material-vec3`, `uniform-material-vec3-of-vector2i`, `uniform-material-vec3-of-color`, `uniform-material-vec4`, `uniform-material-vec4-of-quaternion`, `uniform-material-vec4-of-plane`, `uniform-material-vec4-of-rect2`, `uniform-material-vec4-of-color`, `uniform-material-vec4-of-packed`, `uniform-material-ivec2`, `uniform-material-ivec3-of-vector3`, `uniform-material-ivec4-of-rect2i`, `uniform-material-uvec2`, `uniform-material-uvec3-of-array`, `uniform-material-bvec3-of-int`, `uniform-material-bvec4-of-int`, `uniform-material-mat2`, `uniform-material-mat3`, `uniform-material-mat3-of-quaternion`, `uniform-material-mat4`, `uniform-material-mat4-of-transform3d`, `uniform-material-float-nan`, `uniform-array-float-unset`, `uniform-array-float-nan-first`, `uniform-array-float-short`, `uniform-array-int`, `uniform-array-uint`, `uniform-array-bool`, `uniform-array-vec2-of-array`, `uniform-array-vec2-of-numbers`, `uniform-array-vec3-of-colors`, `uniform-array-vec4-of-colors`, `uniform-array-vec4-unset`, `uniform-array-ivec2`, `uniform-array-bvec2`, `uniform-array-mat2-unset`, `uniform-array-mat2-short`, `uniform-array-mat3-of-bases`, `uniform-array-mat4-of-floats`, `uniform-computed-index`, `uniform-in-called-function`, `uniform-as-argument`, `uniform-color-default-ldr`, `uniform-color-unset-ldr`, `uniform-color-value-ldr`, `uniform-color-disabled-default-ldr`, `uniform-color-disabled-unset-ldr`, `uniform-color-disabled-value-ldr`, `uniform-color-plain-value-ldr`, `uniform-color-vec3-default-ldr`, `uniform-color-vec3-unset-ldr`, `uniform-color-array-ldr`, `uniform-color-default-hdr`, `uniform-color-unset-hdr`, `uniform-color-value-hdr`, `uniform-color-disabled-default-hdr`, `uniform-color-disabled-unset-hdr`, `uniform-color-disabled-value-hdr`, `uniform-color-plain-value-hdr`, `uniform-color-vec3-default-hdr`, `uniform-color-vec3-unset-hdr`, `uniform-color-array-hdr`, `uniform-hint-range-float`, `uniform-hint-range-int`, `uniform-hint-enum`, `uniform-struct-name`, `uniform-group-uniforms`, `texture-removed-screen-texture`, `texture-removed-depth-texture`, `texture-removed-normal-roughness-texture`, `texture-cubes-size-lane`, `texture-cubes-size-swizzle`, `texture-cubes-size-float-constructor`, `texture-cubes-size-int-constructor`, `texture-cubes-size-first-of-two`, `texture-cubes-size-last-of-three`, `texture-cubes-size-before-scalar`, `texture-cubes-size-scaled-lane`, `texture-cubes-size-vector-sum`, `texture-cubes-size-component-wise-call`, `texture-cubes-size-equal-sizes`, `texture-cubes-size-equal-vector`, `texture-cubes-size-choice`, `texture-cubes-size-returned`, `texture-cubes-size-declared`, `texture-2d-filter_nearest`, `texture-2d-filter_linear`, `texture-2d-filter_nearest_mipmap`, `texture-2d-filter_linear_mipmap`, `texture-2d-filter_nearest_mipmap_anisotropic`, `texture-2d-filter_linear_mipmap_anisotropic`, `texture-2d-default-filter`, `texture-2d-repeat-enable`, `texture-2d-repeat-disable`, `texture-unset-none`, `texture-unset-hint_default_white`, `texture-unset-hint_default_black`, `texture-unset-hint_default_transparent`, `texture-unset-hint_normal`, `texture-unset-hint_roughness_normal`, `texture-unset-hint_anisotropy`, `texture-unset-hint_roughness_r`, `texture-unset-hint_roughness_g`, `texture-unset-hint_roughness_b`, `texture-unset-hint_roughness_a`, `texture-unset-hint_roughness_gray`, `texture-unset-cubes-none`, `texture-unset-cubes-hint_default_white`, `texture-unset-cubes-hint_default_black`, `texture-unset-cubes-hint_default_transparent`, `texture-set-null-default-black`, `texture-unset-external-array`, `texture-2d-lod`, `texture-2d-lod-linear-mipmap`, `texture-2d-lod-linear-no-mipmap-filter`, `texture-layers-lod-rg8`, `texture-3d-lod`, `texture-2d-texel-fetch`, `texture-2d-size`, `texture-2d-size-unset`, `texture-2d-source-color`, `texture-2d-source-color-hdr`, `texture-argument`, `texture-array-elements`, `texture-array-computed-index`, `texture-array-computed-argument`, `texture-layers`, `texture-volume`, `texture-cube`, `texture-cubes`, `texture-cubes-linear-edges`, `texture-external`, `texture-external-bias`, `texture-unsigned`, `texture-function-textureSize-sampler2D-int`, `texture-function-textureSize-isampler2D-int`, `texture-function-textureSize-usampler2D-int`, `texture-function-textureSize-sampler2DArray-int`, `texture-function-textureSize-isampler2DArray-int`, `texture-function-textureSize-usampler2DArray-int`, `texture-function-textureSize-sampler3D-int`, `texture-function-textureSize-isampler3D-int`, `texture-function-textureSize-usampler3D-int`, `texture-function-textureSize-samplerCube-int`, `texture-function-textureSize-samplerCubeArray-int`, `texture-function-texture-sampler2D-vec2`, `texture-function-texture-sampler2D-vec2-float`, `texture-function-texture-usampler2D-vec2`, `texture-function-texture-usampler2D-vec2-float`, `texture-function-texture-isampler2D-vec2`, `texture-function-texture-isampler2D-vec2-float`, `texture-function-texture-sampler2DArray-vec3`, `texture-function-texture-sampler2DArray-vec3-float`, `texture-function-texture-usampler2DArray-vec3`, `texture-function-texture-usampler2DArray-vec3-float`, `texture-function-texture-isampler2DArray-vec3`, `texture-function-texture-isampler2DArray-vec3-float`, `texture-function-texture-sampler3D-vec3`, `texture-function-texture-sampler3D-vec3-float`, `texture-function-texture-usampler3D-vec3`, `texture-function-texture-usampler3D-vec3-float`, `texture-function-texture-isampler3D-vec3`, `texture-function-texture-isampler3D-vec3-float`, `texture-function-texture-samplerCube-vec3`, `texture-function-texture-samplerCube-vec3-float`, `texture-function-texture-samplerCubeArray-vec4`, `texture-function-texture-samplerCubeArray-vec4-float`, `texture-function-textureProj-sampler2D-vec3`, `texture-function-textureProj-sampler2D-vec4`, `texture-function-textureProj-sampler2D-vec3-float`, `texture-function-textureProj-sampler2D-vec4-float`, `texture-function-textureProj-isampler2D-vec3`, `texture-function-textureProj-isampler2D-vec4`, `texture-function-textureProj-isampler2D-vec3-float`, `texture-function-textureProj-isampler2D-vec4-float`, `texture-function-textureProj-usampler2D-vec3`, `texture-function-textureProj-usampler2D-vec4`, `texture-function-textureProj-usampler2D-vec3-float`, `texture-function-textureProj-usampler2D-vec4-float`, `texture-function-textureProj-sampler3D-vec4`, `texture-function-textureProj-sampler3D-vec4-float`, `texture-function-textureProj-isampler3D-vec4`, `texture-function-textureProj-isampler3D-vec4-float`, `texture-function-textureProj-usampler3D-vec4`, `texture-function-textureProj-usampler3D-vec4-float`, `texture-function-textureLod-sampler2D-vec2-float`, `texture-function-textureLod-isampler2D-vec2-float`, `texture-function-textureLod-usampler2D-vec2-float`, `texture-function-textureLod-sampler2DArray-vec3-float`, `texture-function-textureLod-isampler2DArray-vec3-float`, `texture-function-textureLod-usampler2DArray-vec3-float`, `texture-function-textureLod-sampler3D-vec3-float`, `texture-function-textureLod-isampler3D-vec3-float`, `texture-function-textureLod-usampler3D-vec3-float`, `texture-function-textureLod-samplerCube-vec3-float`, `texture-function-textureLod-samplerCubeArray-vec4-float`, `texture-function-texelFetch-sampler2D-ivec2-int`, `texture-function-texelFetch-isampler2D-ivec2-int`, `texture-function-texelFetch-usampler2D-ivec2-int`, `texture-function-texelFetch-sampler2DArray-ivec3-int`, `texture-function-texelFetch-isampler2DArray-ivec3-int`, `texture-function-texelFetch-usampler2DArray-ivec3-int`, `texture-function-texelFetch-sampler3D-ivec3-int`, `texture-function-texelFetch-isampler3D-ivec3-int`, `texture-function-texelFetch-usampler3D-ivec3-int`, `texture-function-textureProjLod-sampler2D-vec3-float`, `texture-function-textureProjLod-sampler2D-vec4-float`, `texture-function-textureProjLod-isampler2D-vec3-float`, `texture-function-textureProjLod-isampler2D-vec4-float`, `texture-function-textureProjLod-usampler2D-vec3-float`, `texture-function-textureProjLod-usampler2D-vec4-float`, `texture-function-textureProjLod-sampler3D-vec4-float`, `texture-function-textureProjLod-isampler3D-vec4-float`, `texture-function-textureProjLod-usampler3D-vec4-float`, `texture-function-textureGrad-sampler2D-vec2-vec2-vec2`, `texture-function-textureGrad-isampler2D-vec2-vec2-vec2`, `texture-function-textureGrad-usampler2D-vec2-vec2-vec2`, `texture-function-textureGrad-sampler2DArray-vec3-vec2-vec2`, `texture-function-textureGrad-isampler2DArray-vec3-vec2-vec2`, `texture-function-textureGrad-usampler2DArray-vec3-vec2-vec2`, `texture-function-textureGrad-sampler3D-vec3-vec3-vec3`, `texture-function-textureGrad-isampler3D-vec3-vec3-vec3`, `texture-function-textureGrad-usampler3D-vec3-vec3-vec3`, `texture-function-textureGrad-samplerCube-vec3-vec3-vec3`, `texture-function-textureGrad-samplerCubeArray-vec4-vec3-vec3`, `texture-function-textureProjGrad-sampler2D-vec3-vec2-vec2`, `texture-function-textureProjGrad-sampler2D-vec4-vec2-vec2`, `texture-function-textureProjGrad-isampler2D-vec3-vec2-vec2`, `texture-function-textureProjGrad-isampler2D-vec4-vec2-vec2`, `texture-function-textureProjGrad-usampler2D-vec3-vec2-vec2`, `texture-function-textureProjGrad-usampler2D-vec4-vec2-vec2`, `texture-function-textureProjGrad-sampler3D-vec4-vec3-vec3`, `texture-function-textureProjGrad-isampler3D-vec4-vec3-vec3`, `texture-function-textureProjGrad-usampler3D-vec4-vec3-vec3`, `texture-function-textureGather-sampler2D-vec2`, `texture-function-textureGather-isampler2D-vec2`, `texture-function-textureGather-usampler2D-vec2`, `texture-function-textureGather-sampler2D-vec2-int`, `texture-function-textureGather-isampler2D-vec2-int`, `texture-function-textureGather-usampler2D-vec2-int`, `texture-function-textureGather-sampler2DArray-vec3`, `texture-function-textureGather-isampler2DArray-vec3`, `texture-function-textureGather-usampler2DArray-vec3`, `texture-function-textureGather-sampler2DArray-vec3-int`, `texture-function-textureGather-isampler2DArray-vec3-int`, `texture-function-textureGather-usampler2DArray-vec3-int`, `texture-function-textureGather-samplerCube-vec3`, `texture-function-textureGather-samplerCube-vec3-int`, `texture-function-textureQueryLod-sampler2D-vec2`, `texture-function-textureQueryLod-isampler2D-vec2`, `texture-function-textureQueryLod-usampler2D-vec2`, `texture-function-textureQueryLod-sampler2DArray-vec2`, `texture-function-textureQueryLod-isampler2DArray-vec2`, `texture-function-textureQueryLod-usampler2DArray-vec2`, `texture-function-textureQueryLod-sampler3D-vec3`, `texture-function-textureQueryLod-isampler3D-vec3`, `texture-function-textureQueryLod-usampler3D-vec3`, `texture-function-textureQueryLod-samplerCube-vec3`, `texture-function-textureQueryLevels-sampler2D`, `texture-function-textureQueryLevels-isampler2D`, `texture-function-textureQueryLevels-usampler2D`, `texture-function-textureQueryLevels-sampler2DArray`, `texture-function-textureQueryLevels-isampler2DArray`, `texture-function-textureQueryLevels-usampler2DArray`, `texture-function-textureQueryLevels-sampler3D`, `texture-function-textureQueryLevels-isampler3D`, `texture-function-textureQueryLevels-usampler3D`, `texture-function-textureQueryLevels-samplerCube`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:335` |
| `group_uniforms` | transpiled (`uniform-group-uniforms`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:336` |
| `varying` | open, #1831 | | | `servers/rendering/shader_language.cpp:337` |
| `const` | transpiled (`global-const-scalar`, `global-const-list`, `global-const-array`, `global-const-in-two-functions`, `global-const-as-size`, `global-const-of-a-call`, `head-const/scalar`, `head-const/list`, `head-global/const-named-as-other-type-built-in`, `head-global/local-named-as-later-const`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:338` |
| `struct` | transpiled (`statement-struct`, `statement-struct-member-write`, `statement-struct-array-member`, `statement-struct-array`, `statement-struct-nested`, `statement-struct-assign`, `statement-struct-array-elements`, `statement-struct-array-initialiser-list`, `statement-struct-array-unsized`, `statement-struct-wrong-argument`, `statement-struct-unknown-member`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:339` |
| `shader_type` | transpiled (`sky-default`, `sky-fog`, `sky-fog-sun`, `sky-fog-energy-0`, `sky-fog-energy-3`, `sky-fog-affect-0`, `sky-fog-affect-half`, `sky-sun-coloured`, `sky-sun-below`, `sky-sun-energy-0`, `sky-camera-wide`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:340` |
| `render_mode` | transpiled (`head-render/one`, `head-render/list`, `head-render/two-statements`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:341` |
| `stencil_mode` | transpiled (`head-stencil/one`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:342` |
| `shader_type spatial` | transpiled (`head-type/spatial`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:523` |
| `shader_type canvas_item` | transpiled (`head-type/canvas_item`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:524` |
| `shader_type particles` | transpiled (`head-type/particles`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:525` |
| `shader_type sky` | transpiled (`sky-default`, `sky-fog`, `sky-fog-sun`, `sky-fog-energy-0`, `sky-fog-energy-3`, `sky-fog-affect-0`, `sky-fog-affect-half`, `sky-sun-coloured`, `sky-sun-below`, `sky-sun-energy-0`, `sky-camera-wide`, `head-type/sky`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:526` |
| `shader_type fog` | transpiled (`head-type/fog`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:527` |

## uniform

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `instance` | open, #1792 | | | `servers/rendering/shader_language.cpp:346` |
| `global` | open, #1183 | | | `servers/rendering/shader_language.cpp:347` |

## statement keyword

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `if` | transpiled (`statement-if`, `statement-if-else`, `statement-else-if`, `statement-dangling-else`, `statement-if-not-bool`, `statement-if-declares`, `statement-return-in-if`, `statement-return-in-loop`, `statement-return-missing-path`, `statement-discard`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:351` |
| `else` | transpiled (`statement-if-else`, `statement-else-if`, `statement-dangling-else`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:352` |
| `for` | transpiled (`loop-for-0-times`, `loop-for-1-times`, `loop-for-9-times`, `loop-for-argument-times`, `loop-for-break-continue`, `loop-for-continue-steps`, `loop-nested-break`, `loop-nested-continue`, `loop-for-scope`, `loop-for-empty-parts`, `loop-float-counter`, `statement-return-in-loop`, `statement-return-in-nested-loop`, `statement-switch-in-loop`, `statement-switch-in-loop-break`, `statement-discard-in-loop`, `statement-array-computed-index`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:353` |
| `while` | transpiled (`loop-while-0-times`, `loop-while-1-times`, `loop-while-9-times`, `loop-while-argument-times`, `loop-while-break-continue`, `loop-nested-break`, `statement-return-in-nested-loop`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:354` |
| `do` | transpiled (`loop-do-0-times`, `loop-do-1-times`, `loop-do-9-times`, `loop-do-argument-times`, `loop-do-break-continue`, `loop-do-continue-checks`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:355` |
| `switch` | transpiled (`statement-return-in-switch`, `statement-switch`, `statement-switch-fall-through`, `statement-switch-default-first`, `statement-switch-uint`, `statement-switch-in-loop`, `statement-switch-scope`, `statement-switch-fall-through-ended`, `statement-switch-default-last`, `statement-switch-uint-ended`, `statement-switch-in-loop-break`, `statement-switch-scope-ended`, `statement-switch-case-negative`, `statement-switch-empty-case-at-end`, `statement-switch-twice`, `statement-switch-float`, `statement-switch-case-variable`, `statement-switch-case-folded`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:356` |
| `case` | transpiled (`statement-return-in-switch`, `statement-switch`, `statement-switch-fall-through`, `statement-switch-default-first`, `statement-switch-uint`, `statement-switch-in-loop`, `statement-switch-scope`, `statement-switch-fall-through-ended`, `statement-switch-default-last`, `statement-switch-uint-ended`, `statement-switch-in-loop-break`, `statement-switch-scope-ended`, `statement-switch-case-negative`, `statement-switch-empty-case-at-end`, `statement-switch-twice`, `statement-switch-float`, `statement-switch-case-variable`, `statement-switch-case-folded`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:357` |
| `default` | transpiled (`statement-switch`, `statement-switch-default-first`, `statement-switch-uint`, `statement-switch-default-last`, `statement-switch-uint-ended`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:358` |
| `break` | transpiled (`loop-for-break-continue`, `loop-while-break-continue`, `loop-do-break-continue`, `loop-nested-break`, `loop-break-outside`, `loop-for-empty-parts`, `statement-switch`, `statement-switch-fall-through`, `statement-switch-uint`, `statement-switch-in-loop`, `statement-switch-fall-through-ended`, `statement-switch-uint-ended`, `statement-switch-in-loop-break`, `statement-switch-case-negative`, `statement-switch-empty-case-at-end`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:359` |
| `continue` | transpiled (`loop-for-break-continue`, `loop-while-break-continue`, `loop-do-break-continue`, `loop-do-continue-checks`, `loop-for-continue-steps`, `loop-nested-continue`, `loop-continue-outside`, `statement-switch-in-loop`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:360` |
| `return` | transpiled (`type-bool`, `type-bvec2`, `type-bvec3`, `type-bvec4`, `type-int`, `type-ivec2`, `type-ivec3`, `type-ivec4`, `type-uint`, `type-uvec2`, `type-uvec3`, `type-uvec4`, `type-float`, `type-vec2`, `type-vec3`, `type-vec4`, `type-mat2`, `type-mat3`, `type-mat4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:361` |
| `discard` | transpiled (`statement-discard`, `statement-discard-in-loop`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:362` |

## uniform hint

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `source_color` | transpiled (`uniform-color-default-ldr`, `uniform-color-unset-ldr`, `uniform-color-value-ldr`, `uniform-color-disabled-default-ldr`, `uniform-color-disabled-unset-ldr`, `uniform-color-disabled-value-ldr`, `uniform-color-vec3-default-ldr`, `uniform-color-vec3-unset-ldr`, `uniform-color-array-ldr`, `uniform-color-default-hdr`, `uniform-color-unset-hdr`, `uniform-color-value-hdr`, `uniform-color-disabled-default-hdr`, `uniform-color-disabled-unset-hdr`, `uniform-color-disabled-value-hdr`, `uniform-color-vec3-default-hdr`, `uniform-color-vec3-unset-hdr`, `uniform-color-array-hdr`, `texture-2d-source-color`, `texture-2d-source-color-hdr`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:372` |
| `color_conversion_disabled` | transpiled (`uniform-color-disabled-default-ldr`, `uniform-color-disabled-unset-ldr`, `uniform-color-disabled-value-ldr`, `uniform-color-disabled-default-hdr`, `uniform-color-disabled-unset-hdr`, `uniform-color-disabled-value-hdr`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:373` |
| `hint_range` | transpiled (`uniform-hint-range-float`, `uniform-hint-range-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:374` |
| `hint_enum` | transpiled (`uniform-hint-enum`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:375` |
| `instance_index` | open, #1792 | | | `servers/rendering/shader_language.cpp:376` |
| `hint_normal` | transpiled (`texture-unset-hint_normal`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:380` |
| `hint_default_white` | transpiled (`texture-unset-hint_default_white`, `texture-unset-cubes-hint_default_white`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:381` |
| `hint_default_black` | transpiled (`texture-unset-hint_default_black`, `texture-unset-cubes-hint_default_black`, `texture-set-null-default-black`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:382` |
| `hint_default_transparent` | transpiled (`texture-unset-hint_default_transparent`, `texture-unset-cubes-hint_default_transparent`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:383` |
| `hint_anisotropy` | transpiled (`texture-unset-hint_anisotropy`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:384` |
| `hint_roughness_r` | transpiled (`texture-unset-hint_roughness_r`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:385` |
| `hint_roughness_g` | transpiled (`texture-unset-hint_roughness_g`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:386` |
| `hint_roughness_b` | transpiled (`texture-unset-hint_roughness_b`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:387` |
| `hint_roughness_a` | transpiled (`texture-unset-hint_roughness_a`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:388` |
| `hint_roughness_normal` | transpiled (`texture-unset-hint_roughness_normal`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:389` |
| `hint_roughness_gray` | transpiled (`texture-unset-hint_roughness_gray`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:390` |
| `hint_screen_texture` | open, #1524 | | | `servers/rendering/shader_language.cpp:391` |
| `hint_normal_roughness_texture` | open, #1610 | | | `servers/rendering/shader_language.cpp:392` |
| `hint_depth_texture` | open, #1610 | | | `servers/rendering/shader_language.cpp:393` |

## sampler setting

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `filter_nearest` | transpiled (`texture-2d-filter_nearest`, `texture-2d-repeat-enable`, `texture-2d-repeat-disable`, `texture-2d-source-color`, `texture-2d-source-color-hdr`, `texture-argument`, `texture-array-elements`, `texture-array-computed-index`, `texture-array-computed-argument`, `texture-layers`, `texture-volume`, `texture-cube`, `texture-cubes`, `texture-external`, `texture-external-bias`, `texture-unsigned`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:395` |
| `filter_linear` | transpiled (`texture-2d-filter_linear`, `texture-2d-lod-linear-no-mipmap-filter`, `texture-cubes-linear-edges`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:396` |
| `filter_nearest_mipmap` | transpiled (`texture-2d-filter_nearest_mipmap`, `texture-2d-lod`, `texture-layers-lod-rg8`, `texture-3d-lod`, `texture-function-textureSize-isampler2D-int`, `texture-function-textureSize-usampler2D-int`, `texture-function-textureSize-isampler2DArray-int`, `texture-function-textureSize-usampler2DArray-int`, `texture-function-textureSize-isampler3D-int`, `texture-function-textureSize-usampler3D-int`, `texture-function-texture-usampler2D-vec2`, `texture-function-texture-usampler2D-vec2-float`, `texture-function-texture-isampler2D-vec2`, `texture-function-texture-isampler2D-vec2-float`, `texture-function-texture-usampler2DArray-vec3`, `texture-function-texture-usampler2DArray-vec3-float`, `texture-function-texture-isampler2DArray-vec3`, `texture-function-texture-isampler2DArray-vec3-float`, `texture-function-texture-usampler3D-vec3`, `texture-function-texture-usampler3D-vec3-float`, `texture-function-texture-isampler3D-vec3`, `texture-function-texture-isampler3D-vec3-float`, `texture-function-textureProj-isampler2D-vec3`, `texture-function-textureProj-isampler2D-vec4`, `texture-function-textureProj-isampler2D-vec3-float`, `texture-function-textureProj-isampler2D-vec4-float`, `texture-function-textureProj-usampler2D-vec3`, `texture-function-textureProj-usampler2D-vec4`, `texture-function-textureProj-usampler2D-vec3-float`, `texture-function-textureProj-usampler2D-vec4-float`, `texture-function-textureProj-isampler3D-vec4`, `texture-function-textureProj-isampler3D-vec4-float`, `texture-function-textureProj-usampler3D-vec4`, `texture-function-textureProj-usampler3D-vec4-float`, `texture-function-textureLod-isampler2D-vec2-float`, `texture-function-textureLod-usampler2D-vec2-float`, `texture-function-textureLod-isampler2DArray-vec3-float`, `texture-function-textureLod-usampler2DArray-vec3-float`, `texture-function-textureLod-isampler3D-vec3-float`, `texture-function-textureLod-usampler3D-vec3-float`, `texture-function-texelFetch-isampler2D-ivec2-int`, `texture-function-texelFetch-usampler2D-ivec2-int`, `texture-function-texelFetch-isampler2DArray-ivec3-int`, `texture-function-texelFetch-usampler2DArray-ivec3-int`, `texture-function-texelFetch-isampler3D-ivec3-int`, `texture-function-texelFetch-usampler3D-ivec3-int`, `texture-function-textureProjLod-isampler2D-vec3-float`, `texture-function-textureProjLod-isampler2D-vec4-float`, `texture-function-textureProjLod-usampler2D-vec3-float`, `texture-function-textureProjLod-usampler2D-vec4-float`, `texture-function-textureProjLod-isampler3D-vec4-float`, `texture-function-textureProjLod-usampler3D-vec4-float`, `texture-function-textureGrad-isampler2D-vec2-vec2-vec2`, `texture-function-textureGrad-usampler2D-vec2-vec2-vec2`, `texture-function-textureGrad-isampler2DArray-vec3-vec2-vec2`, `texture-function-textureGrad-usampler2DArray-vec3-vec2-vec2`, `texture-function-textureGrad-isampler3D-vec3-vec3-vec3`, `texture-function-textureGrad-usampler3D-vec3-vec3-vec3`, `texture-function-textureProjGrad-isampler2D-vec3-vec2-vec2`, `texture-function-textureProjGrad-isampler2D-vec4-vec2-vec2`, `texture-function-textureProjGrad-usampler2D-vec3-vec2-vec2`, `texture-function-textureProjGrad-usampler2D-vec4-vec2-vec2`, `texture-function-textureProjGrad-isampler3D-vec4-vec3-vec3`, `texture-function-textureProjGrad-usampler3D-vec4-vec3-vec3`, `texture-function-textureGather-isampler2D-vec2`, `texture-function-textureGather-usampler2D-vec2`, `texture-function-textureGather-isampler2D-vec2-int`, `texture-function-textureGather-usampler2D-vec2-int`, `texture-function-textureGather-isampler2DArray-vec3`, `texture-function-textureGather-usampler2DArray-vec3`, `texture-function-textureGather-isampler2DArray-vec3-int`, `texture-function-textureGather-usampler2DArray-vec3-int`, `texture-function-textureQueryLod-isampler2D-vec2`, `texture-function-textureQueryLod-usampler2D-vec2`, `texture-function-textureQueryLod-isampler2DArray-vec2`, `texture-function-textureQueryLod-usampler2DArray-vec2`, `texture-function-textureQueryLod-isampler3D-vec3`, `texture-function-textureQueryLod-usampler3D-vec3`, `texture-function-textureQueryLevels-isampler2D`, `texture-function-textureQueryLevels-usampler2D`, `texture-function-textureQueryLevels-isampler2DArray`, `texture-function-textureQueryLevels-usampler2DArray`, `texture-function-textureQueryLevels-isampler3D`, `texture-function-textureQueryLevels-usampler3D`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:397` |
| `filter_linear_mipmap` | transpiled (`texture-2d-filter_linear_mipmap`, `texture-2d-lod-linear-mipmap`, `texture-function-textureSize-sampler2D-int`, `texture-function-textureSize-sampler2DArray-int`, `texture-function-textureSize-sampler3D-int`, `texture-function-textureSize-samplerCube-int`, `texture-function-textureSize-samplerCubeArray-int`, `texture-function-texture-sampler2D-vec2`, `texture-function-texture-sampler2D-vec2-float`, `texture-function-texture-sampler2DArray-vec3`, `texture-function-texture-sampler2DArray-vec3-float`, `texture-function-texture-sampler3D-vec3`, `texture-function-texture-sampler3D-vec3-float`, `texture-function-texture-samplerCube-vec3`, `texture-function-texture-samplerCube-vec3-float`, `texture-function-texture-samplerCubeArray-vec4`, `texture-function-texture-samplerCubeArray-vec4-float`, `texture-function-textureProj-sampler2D-vec3`, `texture-function-textureProj-sampler2D-vec4`, `texture-function-textureProj-sampler2D-vec3-float`, `texture-function-textureProj-sampler2D-vec4-float`, `texture-function-textureProj-sampler3D-vec4`, `texture-function-textureProj-sampler3D-vec4-float`, `texture-function-textureLod-sampler2D-vec2-float`, `texture-function-textureLod-sampler2DArray-vec3-float`, `texture-function-textureLod-sampler3D-vec3-float`, `texture-function-textureLod-samplerCube-vec3-float`, `texture-function-textureLod-samplerCubeArray-vec4-float`, `texture-function-texelFetch-sampler2D-ivec2-int`, `texture-function-texelFetch-sampler2DArray-ivec3-int`, `texture-function-texelFetch-sampler3D-ivec3-int`, `texture-function-textureProjLod-sampler2D-vec3-float`, `texture-function-textureProjLod-sampler2D-vec4-float`, `texture-function-textureProjLod-sampler3D-vec4-float`, `texture-function-textureGrad-sampler2D-vec2-vec2-vec2`, `texture-function-textureGrad-sampler2DArray-vec3-vec2-vec2`, `texture-function-textureGrad-sampler3D-vec3-vec3-vec3`, `texture-function-textureGrad-samplerCube-vec3-vec3-vec3`, `texture-function-textureGrad-samplerCubeArray-vec4-vec3-vec3`, `texture-function-textureProjGrad-sampler2D-vec3-vec2-vec2`, `texture-function-textureProjGrad-sampler2D-vec4-vec2-vec2`, `texture-function-textureProjGrad-sampler3D-vec4-vec3-vec3`, `texture-function-textureGather-sampler2D-vec2`, `texture-function-textureGather-sampler2D-vec2-int`, `texture-function-textureGather-sampler2DArray-vec3`, `texture-function-textureGather-sampler2DArray-vec3-int`, `texture-function-textureGather-samplerCube-vec3`, `texture-function-textureGather-samplerCube-vec3-int`, `texture-function-textureQueryLod-sampler2D-vec2`, `texture-function-textureQueryLod-sampler2DArray-vec2`, `texture-function-textureQueryLod-sampler3D-vec3`, `texture-function-textureQueryLod-samplerCube-vec3`, `texture-function-textureQueryLevels-sampler2D`, `texture-function-textureQueryLevels-sampler2DArray`, `texture-function-textureQueryLevels-sampler3D`, `texture-function-textureQueryLevels-samplerCube`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:398` |
| `filter_nearest_mipmap_anisotropic` | transpiled (`texture-2d-filter_nearest_mipmap_anisotropic`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:399` |
| `filter_linear_mipmap_anisotropic` | transpiled (`texture-2d-filter_linear_mipmap_anisotropic`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:400` |
| `repeat_enable` | transpiled (`texture-2d-repeat-enable`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:401` |
| `repeat_disable` | transpiled (`texture-2d-repeat-disable`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:402` |

## operator

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `OP_EQUAL(bool,bool)` | transpiled (`folding-equality-of-equalities`, `equal-bool-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(bvec2,bvec2)` | transpiled (`equal-bvec2-bvec2`) | lowered: all(equal(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(bvec3,bvec3)` | transpiled (`equal-bvec3-bvec3`) | lowered: all(equal(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(bvec4,bvec4)` | transpiled (`equal-bvec4-bvec4`) | lowered: all(equal(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(int,int)` | transpiled (`equal-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(ivec2,ivec2)` | transpiled (`equal-ivec2-ivec2`) | lowered: all(equal(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(ivec3,ivec3)` | transpiled (`equal-ivec3-ivec3`) | lowered: all(equal(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(ivec4,ivec4)` | transpiled (`equal-ivec4-ivec4`) | lowered: all(equal(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(uint,uint)` | transpiled (`equal-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(uvec2,uvec2)` | transpiled (`equal-uvec2-uvec2`) | lowered: all(equal(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(uvec3,uvec3)` | transpiled (`equal-uvec3-uvec3`) | lowered: all(equal(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(uvec4,uvec4)` | transpiled (`equal-uvec4-uvec4`) | lowered: all(equal(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(float,float)` | transpiled (`folding-double-equality`, `equal-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(vec2,vec2)` | transpiled (`equal-vec2-vec2`) | lowered: all(equal(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(vec3,vec3)` | transpiled (`equal-vec3-vec3`) | lowered: all(equal(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(vec4,vec4)` | transpiled (`equal-vec4-vec4`) | lowered: all(equal(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(mat2,mat2)` | transpiled (`folding-matrix-equality`, `equal-mat2-mat2`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(mat3,mat3)` | transpiled (`equal-mat3-mat3`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_EQUAL(mat4,mat4)` | transpiled (`equal-mat4-mat4`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(bool,bool)` | transpiled (`not-equal-bool-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(bvec2,bvec2)` | transpiled (`not-equal-bvec2-bvec2`) | lowered: any(notEqual(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(bvec3,bvec3)` | transpiled (`not-equal-bvec3-bvec3`) | lowered: any(notEqual(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(bvec4,bvec4)` | transpiled (`not-equal-bvec4-bvec4`) | lowered: any(notEqual(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(int,int)` | transpiled (`not-equal-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(ivec2,ivec2)` | transpiled (`not-equal-ivec2-ivec2`) | lowered: any(notEqual(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(ivec3,ivec3)` | transpiled (`not-equal-ivec3-ivec3`) | lowered: any(notEqual(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(ivec4,ivec4)` | transpiled (`not-equal-ivec4-ivec4`) | lowered: any(notEqual(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(uint,uint)` | transpiled (`not-equal-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(uvec2,uvec2)` | transpiled (`not-equal-uvec2-uvec2`) | lowered: any(notEqual(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(uvec3,uvec3)` | transpiled (`not-equal-uvec3-uvec3`) | lowered: any(notEqual(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(uvec4,uvec4)` | transpiled (`not-equal-uvec4-uvec4`) | lowered: any(notEqual(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(float,float)` | transpiled (`not-equal-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(vec2,vec2)` | transpiled (`not-equal-vec2-vec2`) | lowered: any(notEqual(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(vec3,vec3)` | transpiled (`not-equal-vec3-vec3`) | lowered: any(notEqual(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(vec4,vec4)` | transpiled (`not-equal-vec4-vec4`) | lowered: any(notEqual(a, b)) | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(mat2,mat2)` | transpiled (`not-equal-mat2-mat2`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(mat3,mat3)` | transpiled (`not-equal-mat3-mat3`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_NOT_EQUAL(mat4,mat4)` | transpiled (`not-equal-mat4-mat4`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1565` |
| `OP_LESS(int,int)` | transpiled (`less-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1576` |
| `OP_LESS(uint,uint)` | transpiled (`less-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1576` |
| `OP_LESS(float,float)` | transpiled (`less-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1576` |
| `OP_LESS_EQUAL(int,int)` | transpiled (`less-equal-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1576` |
| `OP_LESS_EQUAL(uint,uint)` | transpiled (`less-equal-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1576` |
| `OP_LESS_EQUAL(float,float)` | transpiled (`less-equal-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1576` |
| `OP_GREATER(int,int)` | transpiled (`greater-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1576` |
| `OP_GREATER(uint,uint)` | transpiled (`greater-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1576` |
| `OP_GREATER(float,float)` | transpiled (`greater-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1576` |
| `OP_GREATER_EQUAL(int,int)` | transpiled (`greater-equal-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1576` |
| `OP_GREATER_EQUAL(uint,uint)` | transpiled (`greater-equal-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1576` |
| `OP_GREATER_EQUAL(float,float)` | transpiled (`greater-equal-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1576` |
| `OP_AND(bool,bool)` | transpiled (`branch-and`, `and-bool-bool`) | lowered: select | untested (#1788) | `servers/rendering/shader_language.cpp:1591` |
| `OP_OR(bool,bool)` | transpiled (`branch-or`, `or-bool-bool`) | lowered: select | untested (#1788) | `servers/rendering/shader_language.cpp:1591` |
| `OP_NOT(bool)` | transpiled (`not-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1604` |
| `OP_NEGATE(int)` | transpiled (`negation-text-decrement`, `negate-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_NEGATE(ivec2)` | transpiled (`negate-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_NEGATE(ivec3)` | transpiled (`negate-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_NEGATE(ivec4)` | transpiled (`negate-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_NEGATE(uint)` | transpiled (`negate-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_NEGATE(uvec2)` | transpiled (`negate-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_NEGATE(uvec3)` | transpiled (`negate-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_NEGATE(uvec4)` | transpiled (`negate-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_NEGATE(float)` | transpiled (`negate-float`, `negate-nested-scalar`, `negate-nested-triple`, `negate-nested-swizzle`, `negate-nested-sum`, `negate-nested-constant`, `unbracketed-negated`, `negation-text-element`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_NEGATE(vec2)` | transpiled (`negate-vec2`, `negate-nested-vector`, `negate-nested-constructor`, `negate-nested-constant-vector`, `negation-text-swizzle`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_NEGATE(vec3)` | transpiled (`negate-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_NEGATE(vec4)` | transpiled (`negate-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_ADD(int,int)` | transpiled (`add-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(int,ivec2)` | transpiled (`add-int-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(int,ivec3)` | transpiled (`add-int-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(int,ivec4)` | transpiled (`add-int-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(ivec2,int)` | transpiled (`add-ivec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(ivec2,ivec2)` | transpiled (`add-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(ivec3,int)` | transpiled (`add-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(ivec3,ivec3)` | transpiled (`add-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(ivec4,int)` | transpiled (`add-ivec4-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(ivec4,ivec4)` | transpiled (`add-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(uint,uint)` | transpiled (`add-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(uint,uvec2)` | transpiled (`add-uint-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(uint,uvec3)` | transpiled (`add-uint-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(uint,uvec4)` | transpiled (`add-uint-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(uvec2,uint)` | transpiled (`add-uvec2-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(uvec2,uvec2)` | transpiled (`add-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(uvec3,uint)` | transpiled (`add-uvec3-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(uvec3,uvec3)` | transpiled (`add-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(uvec4,uint)` | transpiled (`add-uvec4-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(uvec4,uvec4)` | transpiled (`add-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(float,float)` | transpiled (`add-float-float`, `folding-bool-to-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(float,vec2)` | transpiled (`add-float-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(float,vec3)` | transpiled (`add-float-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(float,vec4)` | transpiled (`add-float-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(float,mat2)` | transpiled (`add-float-mat2`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(float,mat3)` | transpiled (`add-float-mat3`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(float,mat4)` | transpiled (`add-float-mat4`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(vec2,float)` | transpiled (`add-vec2-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(vec2,vec2)` | transpiled (`add-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(vec3,float)` | transpiled (`add-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(vec3,vec3)` | transpiled (`add-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(vec4,float)` | transpiled (`add-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(vec4,vec4)` | transpiled (`add-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(mat2,float)` | transpiled (`add-mat2-float`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(mat2,mat2)` | transpiled (`add-mat2-mat2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(mat3,float)` | transpiled (`add-mat3-float`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(mat3,mat3)` | transpiled (`add-mat3-mat3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(mat4,float)` | transpiled (`add-mat4-float`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_ADD(mat4,mat4)` | transpiled (`add-mat4-mat4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(int,int)` | transpiled (`sub-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(int,ivec2)` | transpiled (`sub-int-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(int,ivec3)` | transpiled (`sub-int-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(int,ivec4)` | transpiled (`sub-int-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(ivec2,int)` | transpiled (`sub-ivec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(ivec2,ivec2)` | transpiled (`sub-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(ivec3,int)` | transpiled (`sub-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(ivec3,ivec3)` | transpiled (`sub-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(ivec4,int)` | transpiled (`sub-ivec4-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(ivec4,ivec4)` | transpiled (`sub-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(uint,uint)` | transpiled (`sub-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(uint,uvec2)` | transpiled (`sub-uint-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(uint,uvec3)` | transpiled (`sub-uint-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(uint,uvec4)` | transpiled (`sub-uint-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(uvec2,uint)` | transpiled (`sub-uvec2-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(uvec2,uvec2)` | transpiled (`sub-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(uvec3,uint)` | transpiled (`sub-uvec3-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(uvec3,uvec3)` | transpiled (`sub-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(uvec4,uint)` | transpiled (`sub-uvec4-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(uvec4,uvec4)` | transpiled (`sub-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(float,float)` | transpiled (`sub-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(float,vec2)` | transpiled (`sub-float-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(float,vec3)` | transpiled (`sub-float-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(float,vec4)` | transpiled (`sub-float-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(float,mat2)` | transpiled (`sub-float-mat2`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(float,mat3)` | transpiled (`sub-float-mat3`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(float,mat4)` | transpiled (`sub-float-mat4`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(vec2,float)` | transpiled (`sub-vec2-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(vec2,vec2)` | transpiled (`sub-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(vec3,float)` | transpiled (`sub-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(vec3,vec3)` | transpiled (`sub-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(vec4,float)` | transpiled (`sub-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(vec4,vec4)` | transpiled (`sub-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(mat2,float)` | transpiled (`sub-mat2-float`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(mat2,mat2)` | transpiled (`sub-mat2-mat2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(mat3,float)` | transpiled (`sub-mat3-float`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(mat3,mat3)` | transpiled (`sub-mat3-mat3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(mat4,float)` | transpiled (`sub-mat4-float`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_SUB(mat4,mat4)` | transpiled (`sub-mat4-mat4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(int,int)` | transpiled (`mul-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(int,ivec2)` | transpiled (`mul-int-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(int,ivec3)` | transpiled (`mul-int-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(int,ivec4)` | transpiled (`mul-int-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(ivec2,int)` | transpiled (`mul-ivec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(ivec2,ivec2)` | transpiled (`mul-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(ivec3,int)` | transpiled (`mul-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(ivec3,ivec3)` | transpiled (`mul-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(ivec4,int)` | transpiled (`mul-ivec4-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(ivec4,ivec4)` | transpiled (`mul-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(uint,uint)` | transpiled (`mul-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(uint,uvec2)` | transpiled (`mul-uint-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(uint,uvec3)` | transpiled (`mul-uint-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(uint,uvec4)` | transpiled (`mul-uint-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(uvec2,uint)` | transpiled (`mul-uvec2-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(uvec2,uvec2)` | transpiled (`mul-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(uvec3,uint)` | transpiled (`mul-uvec3-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(uvec3,uvec3)` | transpiled (`mul-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(uvec4,uint)` | transpiled (`mul-uvec4-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(uvec4,uvec4)` | transpiled (`mul-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(float,float)` | transpiled (`mul-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(float,vec2)` | transpiled (`mul-float-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(float,vec3)` | transpiled (`mul-float-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(float,vec4)` | transpiled (`mul-float-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(float,mat2)` | transpiled (`mul-float-mat2`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(float,mat3)` | transpiled (`mul-float-mat3`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(float,mat4)` | transpiled (`mul-float-mat4`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(vec2,float)` | transpiled (`mul-vec2-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(vec2,vec2)` | transpiled (`mul-vec2-vec2`, `unbracketed-operator-before`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(vec2,mat2)` | transpiled (`mul-vec2-mat2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(vec3,float)` | transpiled (`mul-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(vec3,vec3)` | transpiled (`mul-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(vec3,mat3)` | transpiled (`mul-vec3-mat3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(vec4,float)` | transpiled (`mul-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(vec4,vec4)` | transpiled (`mul-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(vec4,mat4)` | transpiled (`mul-vec4-mat4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(mat2,float)` | transpiled (`mul-mat2-float`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(mat2,vec2)` | transpiled (`mul-mat2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(mat2,mat2)` | transpiled (`mul-mat2-mat2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(mat3,float)` | transpiled (`mul-mat3-float`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(mat3,vec3)` | transpiled (`folding-matrix-times-vector`, `mul-mat3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(mat3,mat3)` | transpiled (`mul-mat3-mat3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(mat4,float)` | transpiled (`mul-mat4-float`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(mat4,vec4)` | transpiled (`ends-godot-matrix-times-vector`, `mul-mat4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MUL(mat4,mat4)` | transpiled (`mul-mat4-mat4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(int,int)` | transpiled (`ends-godot-least-int-over-minus-one`, `div-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(int,ivec2)` | transpiled (`div-int-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(int,ivec3)` | transpiled (`div-int-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(int,ivec4)` | transpiled (`div-int-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(ivec2,int)` | transpiled (`div-ivec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(ivec2,ivec2)` | transpiled (`div-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(ivec3,int)` | transpiled (`div-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(ivec3,ivec3)` | transpiled (`div-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(ivec4,int)` | transpiled (`div-ivec4-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(ivec4,ivec4)` | transpiled (`div-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(uint,uint)` | transpiled (`div-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(uint,uvec2)` | transpiled (`div-uint-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(uint,uvec3)` | transpiled (`div-uint-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(uint,uvec4)` | transpiled (`div-uint-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(uvec2,uint)` | transpiled (`div-uvec2-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(uvec2,uvec2)` | transpiled (`folding-uint-division-by-zero`, `div-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(uvec3,uint)` | transpiled (`div-uvec3-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(uvec3,uvec3)` | transpiled (`div-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(uvec4,uint)` | transpiled (`div-uvec4-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(uvec4,uvec4)` | transpiled (`div-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(float,float)` | transpiled (`div-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(float,vec2)` | transpiled (`div-float-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(float,vec3)` | transpiled (`div-float-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(float,vec4)` | transpiled (`div-float-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(float,mat2)` | transpiled (`div-float-mat2`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(float,mat3)` | transpiled (`div-float-mat3`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(float,mat4)` | transpiled (`div-float-mat4`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(vec2,float)` | transpiled (`div-vec2-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(vec2,vec2)` | transpiled (`div-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(vec3,float)` | transpiled (`div-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(vec3,vec3)` | transpiled (`div-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(vec4,float)` | transpiled (`div-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(vec4,vec4)` | transpiled (`div-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(mat2,float)` | transpiled (`div-mat2-float`) | lowered: product with the reciprocal | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(mat2,mat2)` | transpiled (`div-mat2-mat2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(mat3,float)` | transpiled (`div-mat3-float`) | lowered: product with the reciprocal | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(mat3,mat3)` | transpiled (`div-mat3-mat3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(mat4,float)` | transpiled (`div-mat4-float`) | lowered: product with the reciprocal | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_DIV(mat4,mat4)` | transpiled (`div-mat4-mat4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1627` |
| `OP_MOD(int,int)` | transpiled (`mod-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_MOD(ivec2,int)` | transpiled (`mod-ivec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_MOD(ivec2,ivec2)` | transpiled (`mod-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_MOD(ivec3,int)` | transpiled (`mod-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_MOD(ivec3,ivec3)` | transpiled (`mod-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_MOD(ivec4,int)` | transpiled (`mod-ivec4-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_MOD(ivec4,ivec4)` | transpiled (`mod-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_MOD(uint,uint)` | transpiled (`mod-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_MOD(uvec2,uint)` | transpiled (`mod-uvec2-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_MOD(uvec2,uvec2)` | transpiled (`mod-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_MOD(uvec3,uint)` | transpiled (`mod-uvec3-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_MOD(uvec3,uvec3)` | transpiled (`mod-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_MOD(uvec4,uint)` | transpiled (`mod-uvec4-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_MOD(uvec4,uvec4)` | transpiled (`mod-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_SHIFT_LEFT(int,int)` | transpiled (`shift-left-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_LEFT(ivec2,int)` | transpiled (`shift-left-ivec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_LEFT(ivec2,ivec2)` | transpiled (`shift-left-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_LEFT(ivec3,int)` | transpiled (`shift-left-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_LEFT(ivec3,ivec3)` | transpiled (`shift-left-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_LEFT(ivec4,int)` | transpiled (`shift-left-ivec4-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_LEFT(ivec4,ivec4)` | transpiled (`shift-left-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_LEFT(uint,uint)` | transpiled (`folding-shift-past-31`, `shift-left-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_LEFT(uvec2,uint)` | transpiled (`shift-left-uvec2-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_LEFT(uvec2,uvec2)` | transpiled (`shift-left-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_LEFT(uvec3,uint)` | transpiled (`shift-left-uvec3-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_LEFT(uvec3,uvec3)` | transpiled (`shift-left-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_LEFT(uvec4,uint)` | transpiled (`shift-left-uvec4-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_LEFT(uvec4,uvec4)` | transpiled (`shift-left-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_RIGHT(int,int)` | transpiled (`shift-right-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_RIGHT(ivec2,int)` | transpiled (`folding-shift-negative`, `shift-right-ivec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_RIGHT(ivec2,ivec2)` | transpiled (`shift-right-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_RIGHT(ivec3,int)` | transpiled (`shift-right-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_RIGHT(ivec3,ivec3)` | transpiled (`shift-right-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_RIGHT(ivec4,int)` | transpiled (`shift-right-ivec4-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_RIGHT(ivec4,ivec4)` | transpiled (`shift-right-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_RIGHT(uint,uint)` | transpiled (`shift-right-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_RIGHT(uvec2,uint)` | transpiled (`shift-right-uvec2-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_RIGHT(uvec2,uvec2)` | transpiled (`shift-right-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_RIGHT(uvec3,uint)` | transpiled (`shift-right-uvec3-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_RIGHT(uvec3,uvec3)` | transpiled (`shift-right-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_RIGHT(uvec4,uint)` | transpiled (`shift-right-uvec4-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_SHIFT_RIGHT(uvec4,uvec4)` | transpiled (`shift-right-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN(bool,bool)` | transpiled (`unbracketed-condition`, `assign-bool-bool`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(bvec2,bvec2)` | transpiled (`assign-bvec2-bvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(bvec3,bvec3)` | transpiled (`assign-bvec3-bvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(bvec4,bvec4)` | transpiled (`assign-bvec4-bvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(int,int)` | transpiled (`unbracketed-chain`, `assign-int-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(ivec2,ivec2)` | transpiled (`assign-ivec2-ivec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(ivec3,ivec3)` | transpiled (`assign-ivec3-ivec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(ivec4,ivec4)` | transpiled (`assign-ivec4-ivec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(uint,uint)` | transpiled (`assign-uint-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(uvec2,uvec2)` | transpiled (`assign-uvec2-uvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(uvec3,uvec3)` | transpiled (`assign-uvec3-uvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(uvec4,uvec4)` | transpiled (`assign-uvec4-uvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(float,float)` | transpiled (`assign-float-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(vec2,vec2)` | transpiled (`unbracketed-operator-after`, `assign-vec2-vec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(vec3,vec3)` | transpiled (`assign-vec3-vec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(vec4,vec4)` | transpiled (`assign-vec4-vec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(mat2,mat2)` | transpiled (`assign-mat2-mat2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(mat3,mat3)` | transpiled (`assign-mat3-mat3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN(mat4,mat4)` | transpiled (`assign-mat4-mat4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1810` |
| `OP_ASSIGN_ADD(int,int)` | transpiled (`assign-add-int-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(ivec2,int)` | transpiled (`assign-add-ivec2-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(ivec2,ivec2)` | transpiled (`assign-add-ivec2-ivec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(ivec3,int)` | transpiled (`assign-add-ivec3-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(ivec3,ivec3)` | transpiled (`assign-add-ivec3-ivec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(ivec4,int)` | transpiled (`assign-add-ivec4-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(ivec4,ivec4)` | transpiled (`assign-add-ivec4-ivec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(uint,uint)` | transpiled (`assign-add-uint-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(uvec2,uint)` | transpiled (`assign-add-uvec2-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(uvec2,uvec2)` | transpiled (`unbracketed-compound`, `assign-add-uvec2-uvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(uvec3,uint)` | transpiled (`assign-add-uvec3-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(uvec3,uvec3)` | transpiled (`assign-add-uvec3-uvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(uvec4,uint)` | transpiled (`assign-add-uvec4-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(uvec4,uvec4)` | transpiled (`assign-add-uvec4-uvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(float,float)` | transpiled (`assign-add-float-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(vec2,float)` | transpiled (`assign-add-vec2-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(vec2,vec2)` | transpiled (`assign-add-vec2-vec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(vec3,float)` | transpiled (`assign-add-vec3-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(vec3,vec3)` | transpiled (`assign-add-vec3-vec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(vec4,float)` | transpiled (`assign-add-vec4-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(vec4,vec4)` | transpiled (`assign-add-vec4-vec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(mat2,float)` | transpiled (`assign-add-mat2-float`) | lowered: written to the argument value, column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(mat2,mat2)` | transpiled (`assign-add-mat2-mat2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(mat3,float)` | transpiled (`assign-add-mat3-float`) | lowered: written to the argument value, column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(mat3,mat3)` | transpiled (`assign-add-mat3-mat3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(mat4,float)` | transpiled (`assign-add-mat4-float`) | lowered: written to the argument value, column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_ADD(mat4,mat4)` | transpiled (`assign-add-mat4-mat4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(int,int)` | transpiled (`assign-sub-int-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(ivec2,int)` | transpiled (`assign-sub-ivec2-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(ivec2,ivec2)` | transpiled (`assign-sub-ivec2-ivec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(ivec3,int)` | transpiled (`assign-sub-ivec3-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(ivec3,ivec3)` | transpiled (`assign-sub-ivec3-ivec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(ivec4,int)` | transpiled (`assign-sub-ivec4-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(ivec4,ivec4)` | transpiled (`assign-sub-ivec4-ivec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(uint,uint)` | transpiled (`assign-sub-uint-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(uvec2,uint)` | transpiled (`assign-sub-uvec2-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(uvec2,uvec2)` | transpiled (`assign-sub-uvec2-uvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(uvec3,uint)` | transpiled (`assign-sub-uvec3-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(uvec3,uvec3)` | transpiled (`assign-sub-uvec3-uvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(uvec4,uint)` | transpiled (`assign-sub-uvec4-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(uvec4,uvec4)` | transpiled (`assign-sub-uvec4-uvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(float,float)` | transpiled (`assign-sub-float-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(vec2,float)` | transpiled (`assign-sub-vec2-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(vec2,vec2)` | transpiled (`assign-sub-vec2-vec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(vec3,float)` | transpiled (`assign-sub-vec3-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(vec3,vec3)` | transpiled (`assign-sub-vec3-vec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(vec4,float)` | transpiled (`assign-sub-vec4-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(vec4,vec4)` | transpiled (`assign-sub-vec4-vec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(mat2,float)` | transpiled (`assign-sub-mat2-float`) | lowered: written to the argument value, column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(mat2,mat2)` | transpiled (`assign-sub-mat2-mat2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(mat3,float)` | transpiled (`assign-sub-mat3-float`) | lowered: written to the argument value, column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(mat3,mat3)` | transpiled (`assign-sub-mat3-mat3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(mat4,float)` | transpiled (`assign-sub-mat4-float`) | lowered: written to the argument value, column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_SUB(mat4,mat4)` | transpiled (`assign-sub-mat4-mat4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(int,int)` | transpiled (`assign-mul-int-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(ivec2,int)` | transpiled (`assign-swizzle-compound`, `assign-mul-ivec2-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(ivec2,ivec2)` | transpiled (`assign-mul-ivec2-ivec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(ivec3,int)` | transpiled (`assign-mul-ivec3-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(ivec3,ivec3)` | transpiled (`assign-mul-ivec3-ivec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(ivec4,int)` | transpiled (`assign-mul-ivec4-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(ivec4,ivec4)` | transpiled (`assign-mul-ivec4-ivec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(uint,uint)` | transpiled (`assign-mul-uint-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(uvec2,uint)` | transpiled (`assign-mul-uvec2-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(uvec2,uvec2)` | transpiled (`assign-mul-uvec2-uvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(uvec3,uint)` | transpiled (`assign-mul-uvec3-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(uvec3,uvec3)` | transpiled (`assign-mul-uvec3-uvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(uvec4,uint)` | transpiled (`assign-mul-uvec4-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(uvec4,uvec4)` | transpiled (`assign-mul-uvec4-uvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(float,float)` | transpiled (`assign-mul-float-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(vec2,float)` | transpiled (`assign-mul-vec2-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(vec2,vec2)` | transpiled (`assign-mul-vec2-vec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(vec2,mat2)` | transpiled (`assign-mul-vec2-mat2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(vec3,float)` | transpiled (`assign-mul-vec3-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(vec3,vec3)` | transpiled (`assign-mul-vec3-vec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(vec3,mat3)` | transpiled (`assign-mul-vec3-mat3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(vec4,float)` | transpiled (`assign-mul-vec4-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(vec4,vec4)` | transpiled (`assign-mul-vec4-vec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(vec4,mat4)` | transpiled (`assign-mul-vec4-mat4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(mat2,float)` | transpiled (`assign-mul-mat2-float`) | lowered: written to the argument value, column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(mat2,mat2)` | transpiled (`assign-mul-mat2-mat2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(mat3,float)` | transpiled (`assign-mul-mat3-float`) | lowered: written to the argument value, column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(mat3,mat3)` | transpiled (`assign-mul-mat3-mat3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(mat4,float)` | transpiled (`assign-mul-mat4-float`) | lowered: written to the argument value, column by column | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MUL(mat4,mat4)` | transpiled (`assign-mul-mat4-mat4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(int,int)` | transpiled (`assign-div-int-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(ivec2,int)` | transpiled (`assign-div-ivec2-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(ivec2,ivec2)` | transpiled (`assign-div-ivec2-ivec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(ivec3,int)` | transpiled (`assign-div-ivec3-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(ivec3,ivec3)` | transpiled (`assign-div-ivec3-ivec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(ivec4,int)` | transpiled (`assign-div-ivec4-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(ivec4,ivec4)` | transpiled (`assign-div-ivec4-ivec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(uint,uint)` | transpiled (`assign-div-uint-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(uvec2,uint)` | transpiled (`assign-div-uvec2-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(uvec2,uvec2)` | transpiled (`assign-div-uvec2-uvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(uvec3,uint)` | transpiled (`assign-div-uvec3-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(uvec3,uvec3)` | transpiled (`assign-div-uvec3-uvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(uvec4,uint)` | transpiled (`assign-div-uvec4-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(uvec4,uvec4)` | transpiled (`assign-div-uvec4-uvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(float,float)` | transpiled (`assign-div-float-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(vec2,float)` | transpiled (`assign-div-vec2-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(vec2,vec2)` | transpiled (`assign-div-vec2-vec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(vec3,float)` | transpiled (`assign-div-vec3-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(vec3,vec3)` | transpiled (`assign-div-vec3-vec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(vec4,float)` | transpiled (`assign-div-vec4-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(vec4,vec4)` | transpiled (`assign-div-vec4-vec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(mat2,float)` | transpiled (`assign-div-mat2-float`) | lowered: written to the argument value, product with the reciprocal | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(mat2,mat2)` | transpiled (`assign-div-mat2-mat2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(mat3,float)` | transpiled (`assign-div-mat3-float`) | lowered: written to the argument value, product with the reciprocal | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(mat3,mat3)` | transpiled (`assign-div-mat3-mat3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(mat4,float)` | transpiled (`assign-div-mat4-float`) | lowered: written to the argument value, product with the reciprocal | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_DIV(mat4,mat4)` | transpiled (`assign-div-mat4-mat4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1833` |
| `OP_ASSIGN_MOD(int,int)` | transpiled (`assign-mod-int-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_ASSIGN_MOD(ivec2,int)` | transpiled (`assign-mod-ivec2-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_ASSIGN_MOD(ivec2,ivec2)` | transpiled (`assign-mod-ivec2-ivec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_ASSIGN_MOD(ivec3,int)` | transpiled (`assign-mod-ivec3-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_ASSIGN_MOD(ivec3,ivec3)` | transpiled (`assign-mod-ivec3-ivec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_ASSIGN_MOD(ivec4,int)` | transpiled (`assign-mod-ivec4-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_ASSIGN_MOD(ivec4,ivec4)` | transpiled (`assign-mod-ivec4-ivec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_ASSIGN_MOD(uint,uint)` | transpiled (`assign-mod-uint-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_ASSIGN_MOD(uvec2,uint)` | transpiled (`assign-mod-uvec2-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_ASSIGN_MOD(uvec2,uvec2)` | transpiled (`assign-mod-uvec2-uvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_ASSIGN_MOD(uvec3,uint)` | transpiled (`assign-mod-uvec3-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_ASSIGN_MOD(uvec3,uvec3)` | transpiled (`assign-mod-uvec3-uvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_ASSIGN_MOD(uvec4,uint)` | transpiled (`assign-mod-uvec4-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_ASSIGN_MOD(uvec4,uvec4)` | transpiled (`assign-mod-uvec4-uvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1693` |
| `OP_ASSIGN_SHIFT_LEFT(int,int)` | transpiled (`assign-shift-left-int-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_LEFT(ivec2,int)` | transpiled (`assign-shift-left-ivec2-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_LEFT(ivec2,ivec2)` | transpiled (`assign-shift-left-ivec2-ivec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_LEFT(ivec3,int)` | transpiled (`assign-shift-left-ivec3-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_LEFT(ivec3,ivec3)` | transpiled (`assign-shift-left-ivec3-ivec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_LEFT(ivec4,int)` | transpiled (`assign-shift-left-ivec4-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_LEFT(ivec4,ivec4)` | transpiled (`assign-shift-left-ivec4-ivec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_LEFT(uint,uint)` | transpiled (`assign-shift-left-uint-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_LEFT(uvec2,uint)` | transpiled (`assign-shift-left-uvec2-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_LEFT(uvec2,uvec2)` | transpiled (`assign-shift-left-uvec2-uvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_LEFT(uvec3,uint)` | transpiled (`assign-shift-left-uvec3-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_LEFT(uvec3,uvec3)` | transpiled (`assign-shift-left-uvec3-uvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_LEFT(uvec4,uint)` | transpiled (`assign-shift-left-uvec4-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_LEFT(uvec4,uvec4)` | transpiled (`assign-shift-left-uvec4-uvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_RIGHT(int,int)` | transpiled (`assign-shift-right-int-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_RIGHT(ivec2,int)` | transpiled (`assign-shift-right-ivec2-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_RIGHT(ivec2,ivec2)` | transpiled (`assign-shift-right-ivec2-ivec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_RIGHT(ivec3,int)` | transpiled (`assign-shift-right-ivec3-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_RIGHT(ivec3,ivec3)` | transpiled (`assign-shift-right-ivec3-ivec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_RIGHT(ivec4,int)` | transpiled (`assign-shift-right-ivec4-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_RIGHT(ivec4,ivec4)` | transpiled (`assign-shift-right-ivec4-ivec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_RIGHT(uint,uint)` | transpiled (`assign-shift-right-uint-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_RIGHT(uvec2,uint)` | transpiled (`assign-shift-right-uvec2-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_RIGHT(uvec2,uvec2)` | transpiled (`assign-shift-right-uvec2-uvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_RIGHT(uvec3,uint)` | transpiled (`assign-shift-right-uvec3-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_RIGHT(uvec3,uvec3)` | transpiled (`assign-shift-right-uvec3-uvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_RIGHT(uvec4,uint)` | transpiled (`assign-shift-right-uvec4-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_SHIFT_RIGHT(uvec4,uvec4)` | transpiled (`assign-shift-right-uvec4-uvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1755` |
| `OP_ASSIGN_BIT_AND(int,int)` | transpiled (`assign-bit-and-int-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_AND(ivec2,int)` | transpiled (`assign-bit-and-ivec2-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_AND(ivec2,ivec2)` | transpiled (`assign-bit-and-ivec2-ivec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_AND(ivec3,int)` | transpiled (`assign-bit-and-ivec3-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_AND(ivec3,ivec3)` | transpiled (`assign-bit-and-ivec3-ivec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_AND(ivec4,int)` | transpiled (`assign-bit-and-ivec4-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_AND(ivec4,ivec4)` | transpiled (`assign-bit-and-ivec4-ivec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_AND(uint,uint)` | transpiled (`assign-bit-and-uint-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_AND(uvec2,uint)` | transpiled (`assign-bit-and-uvec2-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_AND(uvec2,uvec2)` | transpiled (`assign-bit-and-uvec2-uvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_AND(uvec3,uint)` | transpiled (`assign-bit-and-uvec3-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_AND(uvec3,uvec3)` | transpiled (`assign-bit-and-uvec3-uvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_AND(uvec4,uint)` | transpiled (`assign-bit-and-uvec4-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_AND(uvec4,uvec4)` | transpiled (`assign-bit-and-uvec4-uvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_OR(int,int)` | transpiled (`assign-bit-or-int-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_OR(ivec2,int)` | transpiled (`assign-bit-or-ivec2-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_OR(ivec2,ivec2)` | transpiled (`assign-bit-or-ivec2-ivec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_OR(ivec3,int)` | transpiled (`assign-bit-or-ivec3-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_OR(ivec3,ivec3)` | transpiled (`assign-bit-or-ivec3-ivec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_OR(ivec4,int)` | transpiled (`assign-bit-or-ivec4-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_OR(ivec4,ivec4)` | transpiled (`assign-bit-or-ivec4-ivec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_OR(uint,uint)` | transpiled (`assign-bit-or-uint-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_OR(uvec2,uint)` | transpiled (`assign-bit-or-uvec2-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_OR(uvec2,uvec2)` | transpiled (`assign-bit-or-uvec2-uvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_OR(uvec3,uint)` | transpiled (`assign-bit-or-uvec3-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_OR(uvec3,uvec3)` | transpiled (`assign-bit-or-uvec3-uvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_OR(uvec4,uint)` | transpiled (`assign-bit-or-uvec4-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_OR(uvec4,uvec4)` | transpiled (`assign-bit-or-uvec4-uvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_XOR(int,int)` | transpiled (`assign-bit-xor-int-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_XOR(ivec2,int)` | transpiled (`assign-bit-xor-ivec2-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_XOR(ivec2,ivec2)` | transpiled (`assign-bit-xor-ivec2-ivec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_XOR(ivec3,int)` | transpiled (`assign-bit-xor-ivec3-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_XOR(ivec3,ivec3)` | transpiled (`assign-bit-xor-ivec3-ivec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_XOR(ivec4,int)` | transpiled (`assign-bit-xor-ivec4-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_XOR(ivec4,ivec4)` | transpiled (`assign-bit-xor-ivec4-ivec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_XOR(uint,uint)` | transpiled (`assign-bit-xor-uint-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_XOR(uvec2,uint)` | transpiled (`assign-bit-xor-uvec2-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_XOR(uvec2,uvec2)` | transpiled (`assign-bit-xor-uvec2-uvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_XOR(uvec3,uint)` | transpiled (`assign-bit-xor-uvec3-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_XOR(uvec3,uvec3)` | transpiled (`assign-bit-xor-uvec3-uvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_XOR(uvec4,uint)` | transpiled (`assign-bit-xor-uvec4-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_ASSIGN_BIT_XOR(uvec4,uvec4)` | transpiled (`assign-bit-xor-uvec4-uvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_AND(int,int)` | transpiled (`bit-and-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_AND(ivec2,ivec2)` | transpiled (`bit-and-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_AND(ivec3,ivec3)` | transpiled (`bit-and-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_AND(ivec4,ivec4)` | transpiled (`bit-and-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_AND(uint,uint)` | transpiled (`bit-and-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_AND(uvec2,uvec2)` | transpiled (`bit-and-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_AND(uvec3,uvec3)` | transpiled (`bit-and-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_AND(uvec4,uvec4)` | transpiled (`bit-and-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_OR(int,int)` | transpiled (`bit-or-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_OR(ivec2,ivec2)` | transpiled (`bit-or-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_OR(ivec3,ivec3)` | transpiled (`bit-or-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_OR(ivec4,ivec4)` | transpiled (`bit-or-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_OR(uint,uint)` | transpiled (`bit-or-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_OR(uvec2,uvec2)` | transpiled (`bit-or-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_OR(uvec3,uvec3)` | transpiled (`bit-or-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_OR(uvec4,uvec4)` | transpiled (`bit-or-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_XOR(int,int)` | transpiled (`bit-xor-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_XOR(ivec2,ivec2)` | transpiled (`bit-xor-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_XOR(ivec3,ivec3)` | transpiled (`bit-xor-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_XOR(ivec4,ivec4)` | transpiled (`bit-xor-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_XOR(uint,uint)` | transpiled (`bit-xor-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_XOR(uvec2,uvec2)` | transpiled (`bit-xor-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_XOR(uvec3,uvec3)` | transpiled (`bit-xor-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_XOR(uvec4,uvec4)` | transpiled (`bit-xor-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1902` |
| `OP_BIT_INVERT(int)` | transpiled (`bit-invert-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1981` |
| `OP_BIT_INVERT(ivec2)` | transpiled (`bit-invert-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1981` |
| `OP_BIT_INVERT(ivec3)` | transpiled (`bit-invert-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1981` |
| `OP_BIT_INVERT(ivec4)` | transpiled (`bit-invert-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1981` |
| `OP_BIT_INVERT(uint)` | transpiled (`bit-invert-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1981` |
| `OP_BIT_INVERT(uvec2)` | transpiled (`bit-invert-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1981` |
| `OP_BIT_INVERT(uvec3)` | transpiled (`bit-invert-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1981` |
| `OP_BIT_INVERT(uvec4)` | transpiled (`bit-invert-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1981` |
| `OP_INCREMENT(int)` | transpiled (`increment-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_INCREMENT(ivec2)` | transpiled (`increment-ivec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_INCREMENT(ivec3)` | transpiled (`increment-ivec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_INCREMENT(ivec4)` | transpiled (`increment-ivec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_INCREMENT(uint)` | transpiled (`increment-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_INCREMENT(uvec2)` | transpiled (`increment-uvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_INCREMENT(uvec3)` | transpiled (`increment-uvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_INCREMENT(uvec4)` | transpiled (`increment-uvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_INCREMENT(float)` | transpiled (`unbracketed-swizzle-of-step`, `increment-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_INCREMENT(vec2)` | transpiled (`increment-vec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_INCREMENT(vec3)` | transpiled (`increment-vec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_INCREMENT(vec4)` | transpiled (`increment-vec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_DECREMENT(int)` | transpiled (`decrement-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_DECREMENT(ivec2)` | transpiled (`decrement-ivec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_DECREMENT(ivec3)` | transpiled (`decrement-ivec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_DECREMENT(ivec4)` | transpiled (`decrement-ivec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_DECREMENT(uint)` | transpiled (`decrement-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_DECREMENT(uvec2)` | transpiled (`decrement-uvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_DECREMENT(uvec3)` | transpiled (`decrement-uvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_DECREMENT(uvec4)` | transpiled (`decrement-uvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_DECREMENT(float)` | transpiled (`decrement-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_DECREMENT(vec2)` | transpiled (`decrement-vec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_DECREMENT(vec3)` | transpiled (`decrement-vec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_DECREMENT(vec4)` | transpiled (`decrement-vec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_SELECT_IF(bool,bool,bool)` | transpiled (`select-if-bool-bool-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,bvec2,bvec2)` | transpiled (`select-if-bool-bvec2-bvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,bvec3,bvec3)` | transpiled (`select-if-bool-bvec3-bvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,bvec4,bvec4)` | transpiled (`select-if-bool-bvec4-bvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,int,int)` | transpiled (`branch-select`, `folding-select`, `select-if-bool-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,ivec2,ivec2)` | transpiled (`ternary-negated-int`, `select-if-bool-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,ivec3,ivec3)` | transpiled (`select-if-bool-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,ivec4,ivec4)` | transpiled (`select-if-bool-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,uint,uint)` | transpiled (`select-if-bool-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,uvec2,uvec2)` | transpiled (`select-if-bool-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,uvec3,uvec3)` | transpiled (`select-if-bool-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,uvec4,uvec4)` | transpiled (`select-if-bool-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,float,float)` | transpiled (`ternary-double-negation`, `ternary-nested`, `select-if-bool-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,vec2,vec2)` | transpiled (`ternary-negated-vector`, `ternary-negated-else`, `select-if-bool-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,vec3,vec3)` | transpiled (`select-if-bool-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,vec4,vec4)` | transpiled (`select-if-bool-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,mat2,mat2)` | transpiled (`select-if-bool-mat2-mat2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,mat3,mat3)` | transpiled (`select-if-bool-mat3-mat3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_IF(bool,mat4,mat4)` | transpiled (`select-if-bool-mat4-mat4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1990` |
| `OP_SELECT_ELSE` | transpiled (`ternary-negated-vector`, `ternary-negated-else`, `ternary-double-negation`, `ternary-negated-int`, `ternary-nested`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1558` |
| `OP_POST_INCREMENT(int)` | transpiled (`unbracketed-post-step`, `post-increment-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_INCREMENT(ivec2)` | transpiled (`post-increment-ivec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_INCREMENT(ivec3)` | transpiled (`post-increment-ivec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_INCREMENT(ivec4)` | transpiled (`post-increment-ivec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_INCREMENT(uint)` | transpiled (`post-increment-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_INCREMENT(uvec2)` | transpiled (`post-increment-uvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_INCREMENT(uvec3)` | transpiled (`post-increment-uvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_INCREMENT(uvec4)` | transpiled (`post-increment-uvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_INCREMENT(float)` | transpiled (`assign-swizzle-step`, `post-increment-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_INCREMENT(vec2)` | transpiled (`post-increment-vec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_INCREMENT(vec3)` | transpiled (`post-increment-vec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_INCREMENT(vec4)` | transpiled (`post-increment-vec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_DECREMENT(int)` | transpiled (`post-decrement-int`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_DECREMENT(ivec2)` | transpiled (`post-decrement-ivec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_DECREMENT(ivec3)` | transpiled (`post-decrement-ivec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_DECREMENT(ivec4)` | transpiled (`post-decrement-ivec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_DECREMENT(uint)` | transpiled (`post-decrement-uint`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_DECREMENT(uvec2)` | transpiled (`post-decrement-uvec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_DECREMENT(uvec3)` | transpiled (`post-decrement-uvec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_DECREMENT(uvec4)` | transpiled (`post-decrement-uvec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_DECREMENT(float)` | transpiled (`post-decrement-float`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_DECREMENT(vec2)` | transpiled (`post-decrement-vec2`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_DECREMENT(vec3)` | transpiled (`post-decrement-vec3`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_POST_DECREMENT(vec4)` | transpiled (`post-decrement-vec4`) | lowered: written to the argument value | untested (#1788) | `servers/rendering/shader_language.cpp:1614` |
| `OP_CALL` | transpiled (`function-one-place`, `function-two-places`, `function-nested`, `function-from-a-function`, `function-in-a-loop`, `function-in-a-condition`, `function-no-arguments`, `function-vector`, `function-matrix`, `function-constant-converted`, `function-argument-named-as-function`, `function-early-return-in-loop`, `function-early-return-in-branch`, `function-value-call-as-statement`, `function-struct-call-as-statement`, `function-struct-return-in-branch`, `function-array-return-in-loop`, `function-vector-array-result`, `function-vector-array-out`, `function-vector-array-argument`, `function-array-call-as-statement`, `function-out-index-read-before-another-out`, `function-inout-index-read-before-an-out`, `function-void-call-discards`, `function-void`, `function-in`, `function-in-unwritten-caller`, `function-out`, `function-out-before-read`, `function-out-value-function`, `function-inout-twice`, `function-inout-in-expression`, `function-inout-read-after-a-writing-argument`, `function-inout-read-after-a-writing-argument-of-a-value-call`, `function-inout-vector-lane`, `function-inout-array-element`, `function-inout-struct-member`, `function-out-struct`, `function-out-array`, `function-const`, `function-const-of-constant`, `function-const-in`, `function-overload-by-type`, `function-overload-by-count`, `function-struct-argument`, `function-struct-return`, `function-struct-return-member`, `function-array-argument`, `function-array-argument-type-size`, `function-array-argument-constructed`, `function-array-argument-unchanged`, `function-array-return`, `function-struct-array-argument`, `function-recursion`, `function-probe-recursion`, `function-later-function`, `function-unknown-function`, `function-too-few`, `function-too-many`, `function-wrong-type`, `function-overload-constant`, `function-void-value`, `function-void-return-value`, `function-void-argument`, `function-out-constant`, `function-out-expression`, `function-out-const-local`, `function-out-swizzle-twice`, `function-out-member-of-call`, `function-inout-member-of-sum`, `function-const-out`, `function-const-inout`, `function-const-write`, `function-qualifier-twice`, `function-same-overload`, `function-overload-by-return`, `function-local-named-as-function`, `function-function-as-value`, `function-wrong-struct`, `function-wrong-array-size`, `function-array-return-size`, `function-const-return`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1558` |
| `OP_CONSTRUCT` | transpiled (`call-ivec2-bvec2`, `call-ivec2-ivec2`, `call-ivec2-uvec2`, `call-ivec2-vec2`, `call-vec2-bvec2`, `call-vec2-ivec2`, `call-vec2-uvec2`, `call-vec2-vec2`, `call-uvec2-bvec2`, `call-uvec2-ivec2`, `call-uvec2-uvec2`, `call-uvec2-vec2`, `call-bvec2-bvec2`, `call-bvec2-ivec2`, `call-bvec2-uvec2`, `call-bvec2-vec2`, `call-ivec3-bvec3`, `call-ivec3-ivec3`, `call-ivec3-uvec3`, `call-ivec3-vec3`, `call-vec3-bvec3`, `call-vec3-ivec3`, `call-vec3-uvec3`, `call-vec3-vec3`, `call-uvec3-bvec3`, `call-uvec3-ivec3`, `call-uvec3-uvec3`, `call-uvec3-vec3`, `call-bvec3-bvec3`, `call-bvec3-ivec3`, `call-bvec3-uvec3`, `call-bvec3-vec3`, `call-ivec4-bvec4`, `call-ivec4-ivec4`, `call-ivec4-uvec4`, `call-ivec4-vec4`, `call-vec4-bvec4`, `call-vec4-ivec4`, `call-vec4-uvec4`, `call-vec4-vec4`, `call-uvec4-bvec4`, `call-uvec4-ivec4`, `call-uvec4-uvec4`, `call-uvec4-vec4`, `call-bvec4-bvec4`, `call-bvec4-ivec4`, `call-bvec4-uvec4`, `call-bvec4-vec4`, `call-mat2-mat3`, `call-mat2-mat4`, `call-mat3-mat2`, `call-mat3-mat4`, `call-mat4-mat2`, `call-mat4-mat3`, `construct-bvec2-bool`, `construct-bvec2-bool-bool`, `construct-bvec3-bool`, `construct-bvec3-bool-bool-bool`, `construct-bvec3-bvec2-bool`, `construct-bvec3-bool-bvec2`, `construct-bvec4-bool`, `construct-bvec4-bool-bool-bool-bool`, `construct-bvec4-bool-bvec2-bool`, `construct-bvec4-bvec2-bool-bool`, `construct-bvec4-bool-bool-bvec2`, `construct-bvec4-bool-bvec3`, `construct-bvec4-bvec3-bool`, `construct-bvec4-bvec2-bvec2`, `construct-ivec2-int`, `construct-ivec2-int-int`, `construct-ivec3-int`, `construct-ivec3-int-int-int`, `construct-ivec3-ivec2-int`, `construct-ivec3-int-ivec2`, `construct-ivec4-int`, `construct-ivec4-int-int-int-int`, `construct-ivec4-int-ivec2-int`, `construct-ivec4-ivec2-int-int`, `construct-ivec4-int-int-ivec2`, `construct-ivec4-int-ivec3`, `construct-ivec4-ivec3-int`, `construct-ivec4-ivec2-ivec2`, `construct-uvec2-uint`, `construct-uvec2-uint-uint`, `construct-uvec3-uint`, `construct-uvec3-uint-uint-uint`, `construct-uvec3-uvec2-uint`, `construct-uvec3-uint-uvec2`, `construct-uvec4-uint`, `construct-uvec4-uint-uint-uint-uint`, `construct-uvec4-uint-uvec2-uint`, `construct-uvec4-uvec2-uint-uint`, `construct-uvec4-uint-uint-uvec2`, `construct-uvec4-uint-uvec3`, `construct-uvec4-uvec3-uint`, `construct-uvec4-uvec2-uvec2`, `construct-mat2-vec2-vec2`, `construct-mat3-vec3-vec3-vec3`, `construct-mat4-vec4-vec4-vec4-vec4`, `construct-mat2-float`, `construct-mat3-float`, `construct-mat4-float`, `construct-int-bool`, `construct-int-int`, `construct-int-uint`, `construct-int-float`, `construct-float-bool`, `construct-float-int`, `construct-float-uint`, `construct-float-float`, `construct-uint-bool`, `construct-uint-int`, `construct-uint-uint`, `construct-uint-float`, `construct-bool-bool`, `construct-bool-int`, `construct-bool-uint`, `construct-bool-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1558` |
| `OP_STRUCT` | transpiled (`statement-struct`, `statement-struct-member-write`, `statement-struct-array-member`, `statement-struct-array`, `statement-struct-nested`, `statement-struct-assign`, `statement-struct-array-elements`, `statement-struct-array-initialiser-list`, `statement-struct-array-unsized`, `statement-struct-wrong-argument`, `statement-struct-unknown-member`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1558` |
| `OP_INDEX` | transpiled (`index-vector-read`, `index-vector-constant`, `index-uint-index`, `index-matrix-column`, `index-matrix-lane`, `index-vector-write`, `index-matrix-write`, `index-lane-write`, `index-member-write`, `index-folded-read`, `index-folded-write`, `index-folded-past-end`, `index-folded-write-past-end`, `index-folded-call-read`, `index-folded-call-past-end`, `index-write-before-value`, `index-compound-before-value`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1558` |
| `OP_EMPTY` | transpiled (`statement-empty`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:1558` |

## statement

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `FLOW_OP_IF` | transpiled (`statement-if`, `statement-if-else`, `statement-else-if`, `statement-dangling-else`, `statement-if-not-bool`, `statement-if-declares`, `statement-return-in-if`, `statement-return-in-loop`, `statement-return-missing-path`, `statement-discard`) | native | untested (#1788) | `servers/rendering/shader_language.h:307` |
| `FLOW_OP_RETURN` | transpiled (`type-bool`, `type-bvec2`, `type-bvec3`, `type-bvec4`, `type-int`, `type-ivec2`, `type-ivec3`, `type-ivec4`, `type-uint`, `type-uvec2`, `type-uvec3`, `type-uvec4`, `type-float`, `type-vec2`, `type-vec3`, `type-vec4`, `type-mat2`, `type-mat3`, `type-mat4`, `statement-after-return`) | native | untested (#1788) | `servers/rendering/shader_language.h:308` |
| `FLOW_OP_FOR` | transpiled (`loop-for-0-times`, `loop-for-1-times`, `loop-for-9-times`, `loop-for-argument-times`, `loop-for-break-continue`, `loop-for-continue-steps`, `loop-nested-break`, `loop-nested-continue`, `loop-for-scope`, `loop-for-empty-parts`, `loop-float-counter`, `statement-return-in-loop`, `statement-return-in-nested-loop`, `statement-switch-in-loop`, `statement-switch-in-loop-break`, `statement-discard-in-loop`, `statement-array-computed-index`) | native | untested (#1788) | `servers/rendering/shader_language.h:309` |
| `FLOW_OP_WHILE` | transpiled (`loop-while-0-times`, `loop-while-1-times`, `loop-while-9-times`, `loop-while-argument-times`, `loop-while-break-continue`, `loop-nested-break`, `statement-return-in-nested-loop`) | native | untested (#1788) | `servers/rendering/shader_language.h:310` |
| `FLOW_OP_DO` | transpiled (`loop-do-0-times`, `loop-do-1-times`, `loop-do-9-times`, `loop-do-argument-times`, `loop-do-break-continue`, `loop-do-continue-checks`) | native | untested (#1788) | `servers/rendering/shader_language.h:311` |
| `FLOW_OP_BREAK` | transpiled (`loop-for-break-continue`, `loop-while-break-continue`, `loop-do-break-continue`, `loop-nested-break`, `loop-break-outside`, `loop-for-empty-parts`, `statement-switch`, `statement-switch-fall-through`, `statement-switch-uint`, `statement-switch-in-loop`, `statement-switch-fall-through-ended`, `statement-switch-uint-ended`, `statement-switch-in-loop-break`, `statement-switch-case-negative`, `statement-switch-empty-case-at-end`) | native | untested (#1788) | `servers/rendering/shader_language.h:312` |
| `FLOW_OP_SWITCH` | transpiled (`statement-return-in-switch`, `statement-switch`, `statement-switch-fall-through`, `statement-switch-default-first`, `statement-switch-uint`, `statement-switch-in-loop`, `statement-switch-scope`, `statement-switch-fall-through-ended`, `statement-switch-default-last`, `statement-switch-uint-ended`, `statement-switch-in-loop-break`, `statement-switch-scope-ended`, `statement-switch-case-negative`, `statement-switch-empty-case-at-end`, `statement-switch-twice`, `statement-switch-float`, `statement-switch-case-variable`, `statement-switch-case-folded`) | native | untested (#1788) | `servers/rendering/shader_language.h:313` |
| `FLOW_OP_CASE` | transpiled (`statement-return-in-switch`, `statement-switch`, `statement-switch-fall-through`, `statement-switch-default-first`, `statement-switch-uint`, `statement-switch-in-loop`, `statement-switch-scope`, `statement-switch-fall-through-ended`, `statement-switch-default-last`, `statement-switch-uint-ended`, `statement-switch-in-loop-break`, `statement-switch-scope-ended`, `statement-switch-case-negative`, `statement-switch-empty-case-at-end`, `statement-switch-twice`, `statement-switch-float`, `statement-switch-case-variable`, `statement-switch-case-folded`) | native | untested (#1788) | `servers/rendering/shader_language.h:314` |
| `FLOW_OP_DEFAULT` | transpiled (`statement-switch`, `statement-switch-default-first`, `statement-switch-uint`, `statement-switch-default-last`, `statement-switch-uint-ended`) | native | untested (#1788) | `servers/rendering/shader_language.h:315` |
| `FLOW_OP_CONTINUE` | transpiled (`loop-for-break-continue`, `loop-while-break-continue`, `loop-do-break-continue`, `loop-do-continue-checks`, `loop-for-continue-steps`, `loop-nested-continue`, `loop-continue-outside`, `statement-switch-in-loop`) | native | untested (#1788) | `servers/rendering/shader_language.h:316` |
| `FLOW_OP_DISCARD` | transpiled (`statement-discard`, `statement-discard-in-loop`) | native | untested (#1788) | `servers/rendering/shader_language.h:317` |

## tree node

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `NODE_TYPE_SHADER` | transpiled (`sky-default`, `sky-fog`, `sky-fog-sun`, `sky-fog-energy-0`, `sky-fog-energy-3`, `sky-fog-affect-0`, `sky-fog-affect-half`, `sky-sun-coloured`, `sky-sun-below`, `sky-sun-energy-0`, `sky-camera-wide`) | native | untested (#1788) | `servers/rendering/shader_language.h:373` |
| `NODE_TYPE_FUNCTION` | transpiled (`head-type/spatial`, `head-type/canvas_item`, `head-type/particles`, `head-type/sky`, `head-type/fog`) | native | untested (#1788) | `servers/rendering/shader_language.h:374` |
| `NODE_TYPE_BLOCK` | transpiled (`statement-block`, `statement-block-shadow`, `statement-block-out-of-scope`, `statement-if-declares`, `statement-switch-scope-ended`) | native | untested (#1788) | `servers/rendering/shader_language.h:375` |
| `NODE_TYPE_VARIABLE` | transpiled (`type-bool`, `type-bvec2`, `type-bvec3`, `type-bvec4`, `type-int`, `type-ivec2`, `type-ivec3`, `type-ivec4`, `type-uint`, `type-uvec2`, `type-uvec3`, `type-uvec4`, `type-float`, `type-vec2`, `type-vec3`, `type-vec4`, `type-mat2`, `type-mat3`, `type-mat4`) | native | untested (#1788) | `servers/rendering/shader_language.h:376` |
| `NODE_TYPE_VARIABLE_DECLARATION` | transpiled (`statement-local`, `statement-local-list`, `statement-local-const`, `statement-local-const-write`, `statement-local-undeclared`, `statement-local-twice`, `statement-local-of-argument-name`, `statement-block`, `statement-block-shadow`, `statement-block-out-of-scope`, `statement-local-initialised-by-itself`, `loop-for-scope`, `statement-switch-scope`, `statement-switch-scope-ended`, `statement-array`, `statement-array-type-first`, `statement-array-initialiser-list`, `statement-array-length`, `statement-array-length-before-operator`, `statement-array-computed-index`, `statement-array-swizzle-write`, `statement-array-assign`, `statement-array-size-mismatch`, `statement-array-constant-index-past-end`, `statement-array-const`, `statement-struct-array-member`, `statement-struct-array`, `statement-struct-array-elements`, `statement-struct-array-initialiser-list`, `statement-struct-array-unsized`) | native | untested (#1788) | `servers/rendering/shader_language.h:377` |
| `NODE_TYPE_CONSTANT` | transpiled (`statement-tree`) | native | untested (#1788) | `servers/rendering/shader_language.h:378` |
| `NODE_TYPE_OPERATOR` | transpiled (`statement-sequence`) | native | untested (#1788) | `servers/rendering/shader_language.h:379` |
| `NODE_TYPE_CONTROL_FLOW` | transpiled (`statement-if`, `statement-if-else`, `statement-else-if`, `statement-dangling-else`, `statement-if-not-bool`, `statement-if-declares`, `loop-for-0-times`, `loop-for-1-times`, `loop-for-9-times`, `loop-for-argument-times`, `loop-while-0-times`, `loop-while-1-times`, `loop-while-9-times`, `loop-while-argument-times`, `loop-do-0-times`, `loop-do-1-times`, `loop-do-9-times`, `loop-do-argument-times`, `loop-for-break-continue`, `loop-while-break-continue`, `loop-do-break-continue`, `loop-do-continue-checks`, `loop-for-continue-steps`, `loop-nested-break`, `loop-nested-break`, `loop-nested-continue`, `loop-for-scope`, `loop-for-empty-parts`, `loop-float-counter`, `statement-return-in-if`, `statement-return-in-loop`, `statement-return-in-loop`, `statement-return-in-nested-loop`, `statement-return-in-nested-loop`, `statement-return-in-switch`, `statement-return-missing-path`, `statement-switch`, `statement-switch-fall-through`, `statement-switch-default-first`, `statement-switch-uint`, `statement-switch-in-loop`, `statement-switch-in-loop`, `statement-switch-scope`, `statement-switch-fall-through-ended`, `statement-switch-default-last`, `statement-switch-uint-ended`, `statement-switch-in-loop-break`, `statement-switch-in-loop-break`, `statement-switch-scope-ended`, `statement-switch-case-negative`, `statement-switch-empty-case-at-end`, `statement-switch-twice`, `statement-switch-float`, `statement-switch-case-variable`, `statement-switch-case-folded`, `statement-discard`, `statement-discard-in-loop`, `statement-array-computed-index`) | native | untested (#1788) | `servers/rendering/shader_language.h:380` |
| `NODE_TYPE_MEMBER` | transpiled (`statement-tree`) | native | untested (#1788) | `servers/rendering/shader_language.h:381` |
| `NODE_TYPE_ARRAY` | transpiled (`statement-array`, `statement-array-type-first`, `statement-array-initialiser-list`, `statement-array-length`, `statement-array-length-before-operator`, `statement-array-computed-index`, `statement-array-swizzle-write`, `statement-array-assign`, `statement-array-size-mismatch`, `statement-array-constant-index-past-end`, `statement-array-const`, `statement-struct-array-member`, `statement-struct-array`, `statement-struct-array-elements`, `statement-struct-array-initialiser-list`, `statement-struct-array-unsized`, `uniform-array-float-unset`, `uniform-array-float-nan-first`, `uniform-array-float-short`, `uniform-array-int`, `uniform-array-uint`, `uniform-array-bool`, `uniform-array-vec2-of-array`, `uniform-array-vec2-of-numbers`, `uniform-array-vec3-of-colors`, `uniform-array-vec4-of-colors`, `uniform-array-vec4-unset`, `uniform-array-ivec2`, `uniform-array-bvec2`, `uniform-array-mat2-unset`, `uniform-array-mat2-short`, `uniform-array-mat3-of-bases`, `uniform-array-mat4-of-floats`, `uniform-computed-index`, `uniform-color-array-ldr`, `uniform-color-array-hdr`) | native | untested (#1788) | `servers/rendering/shader_language.h:382` |
| `NODE_TYPE_ARRAY_CONSTRUCT` | transpiled (`statement-array`, `statement-array-type-first`, `statement-array-assign`, `statement-array-size-mismatch`, `statement-array-const`, `statement-struct-array`, `statement-struct-array-unsized`) | native | untested (#1788) | `servers/rendering/shader_language.h:383` |
| `NODE_TYPE_STRUCT` | transpiled (`statement-struct`, `statement-struct-member-write`, `statement-struct-array-member`, `statement-struct-array`, `statement-struct-nested`, `statement-struct-assign`, `statement-struct-array-elements`, `statement-struct-array-initialiser-list`, `statement-struct-array-unsized`, `statement-struct-wrong-argument`, `statement-struct-unknown-member`) | native | untested (#1788) | `servers/rendering/shader_language.h:384` |

## constructor

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `bvec2(bool)` | transpiled (`construct-bvec2-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2422` |
| `bvec2(bool,bool)` | transpiled (`construct-bvec2-bool-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2423` |
| `bvec3(bool)` | transpiled (`construct-bvec3-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2424` |
| `bvec3(bool,bool,bool)` | transpiled (`construct-bvec3-bool-bool-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2425` |
| `bvec3(bvec2,bool)` | transpiled (`construct-bvec3-bvec2-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2426` |
| `bvec3(bool,bvec2)` | transpiled (`construct-bvec3-bool-bvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2427` |
| `bvec4(bool)` | transpiled (`construct-bvec4-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2428` |
| `bvec4(bool,bool,bool,bool)` | transpiled (`construct-bvec4-bool-bool-bool-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2429` |
| `bvec4(bool,bvec2,bool)` | transpiled (`construct-bvec4-bool-bvec2-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2430` |
| `bvec4(bvec2,bool,bool)` | transpiled (`construct-bvec4-bvec2-bool-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2431` |
| `bvec4(bool,bool,bvec2)` | transpiled (`construct-bvec4-bool-bool-bvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2432` |
| `bvec4(bool,bvec3)` | transpiled (`construct-bvec4-bool-bvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2433` |
| `bvec4(bvec3,bool)` | transpiled (`construct-bvec4-bvec3-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2434` |
| `bvec4(bvec2,bvec2)` | transpiled (`construct-bvec4-bvec2-bvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2435` |
| `vec2(float)` | transpiled (`construct-vec2-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2437` |
| `vec2(float,float)` | transpiled (`construct-vec2-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2438` |
| `vec3(float)` | transpiled (`construct-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2439` |
| `vec3(float,float,float)` | transpiled (`construct-vec3-float-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2440` |
| `vec3(vec2,float)` | transpiled (`construct-vec3-vec2-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2441` |
| `vec3(float,vec2)` | transpiled (`construct-vec3-float-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2442` |
| `vec4(float)` | transpiled (`construct-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2443` |
| `vec4(float,float,float,float)` | transpiled (`construct-vec4-float-float-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2444` |
| `vec4(float,vec2,float)` | transpiled (`construct-vec4-float-vec2-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2445` |
| `vec4(vec2,float,float)` | transpiled (`construct-vec4-vec2-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2446` |
| `vec4(float,float,vec2)` | transpiled (`construct-vec4-float-float-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2447` |
| `vec4(float,vec3)` | transpiled (`construct-vec4-float-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2448` |
| `vec4(vec3,float)` | transpiled (`construct-vec4-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2449` |
| `vec4(vec2,vec2)` | transpiled (`construct-vec4-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2450` |
| `ivec2(int)` | transpiled (`construct-ivec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2452` |
| `ivec2(int,int)` | transpiled (`construct-ivec2-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2453` |
| `ivec3(int)` | transpiled (`construct-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2454` |
| `ivec3(int,int,int)` | transpiled (`construct-ivec3-int-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2455` |
| `ivec3(ivec2,int)` | transpiled (`construct-ivec3-ivec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2456` |
| `ivec3(int,ivec2)` | transpiled (`construct-ivec3-int-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2457` |
| `ivec4(int)` | transpiled (`construct-ivec4-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2458` |
| `ivec4(int,int,int,int)` | transpiled (`construct-ivec4-int-int-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2459` |
| `ivec4(int,ivec2,int)` | transpiled (`construct-ivec4-int-ivec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2460` |
| `ivec4(ivec2,int,int)` | transpiled (`construct-ivec4-ivec2-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2461` |
| `ivec4(int,int,ivec2)` | transpiled (`construct-ivec4-int-int-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2462` |
| `ivec4(int,ivec3)` | transpiled (`construct-ivec4-int-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2463` |
| `ivec4(ivec3,int)` | transpiled (`construct-ivec4-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2464` |
| `ivec4(ivec2,ivec2)` | transpiled (`construct-ivec4-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2465` |
| `uvec2(uint)` | transpiled (`construct-uvec2-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2467` |
| `uvec2(uint,uint)` | transpiled (`construct-uvec2-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2468` |
| `uvec3(uint)` | transpiled (`construct-uvec3-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2469` |
| `uvec3(uint,uint,uint)` | transpiled (`construct-uvec3-uint-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2470` |
| `uvec3(uvec2,uint)` | transpiled (`construct-uvec3-uvec2-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2471` |
| `uvec3(uint,uvec2)` | transpiled (`construct-uvec3-uint-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2472` |
| `uvec4(uint)` | transpiled (`construct-uvec4-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2473` |
| `uvec4(uint,uint,uint,uint)` | transpiled (`construct-uvec4-uint-uint-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2474` |
| `uvec4(uint,uvec2,uint)` | transpiled (`construct-uvec4-uint-uvec2-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2475` |
| `uvec4(uvec2,uint,uint)` | transpiled (`construct-uvec4-uvec2-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2476` |
| `uvec4(uint,uint,uvec2)` | transpiled (`construct-uvec4-uint-uint-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2477` |
| `uvec4(uint,uvec3)` | transpiled (`construct-uvec4-uint-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2478` |
| `uvec4(uvec3,uint)` | transpiled (`construct-uvec4-uvec3-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2479` |
| `uvec4(uvec2,uvec2)` | transpiled (`construct-uvec4-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2480` |
| `mat2(vec2,vec2)` | transpiled (`construct-mat2-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2482` |
| `mat3(vec3,vec3,vec3)` | transpiled (`construct-mat3-vec3-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2483` |
| `mat4(vec4,vec4,vec4,vec4)` | transpiled (`construct-mat4-vec4-vec4-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2484` |
| `mat2(float)` | transpiled (`construct-mat2-float`) | lowered: diagonal of columns | untested (#1788) | `servers/rendering/shader_language.cpp:2486` |
| `mat3(float)` | transpiled (`construct-mat3-float`) | lowered: diagonal of columns | untested (#1788) | `servers/rendering/shader_language.cpp:2487` |
| `mat4(float)` | transpiled (`construct-mat4-float`) | lowered: diagonal of columns | untested (#1788) | `servers/rendering/shader_language.cpp:2488` |

## function

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `int(bool)` | transpiled (`construct-int-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2492` |
| `int(int)` | transpiled (`construct-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2493` |
| `int(uint)` | transpiled (`construct-int-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2494` |
| `int(float)` | transpiled (`construct-int-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2495` |
| `float(bool)` | transpiled (`construct-float-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2497` |
| `float(int)` | transpiled (`construct-float-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2498` |
| `float(uint)` | transpiled (`construct-float-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2499` |
| `float(float)` | transpiled (`construct-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2500` |
| `uint(bool)` | transpiled (`construct-uint-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2502` |
| `uint(int)` | transpiled (`construct-uint-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2503` |
| `uint(uint)` | transpiled (`construct-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2504` |
| `uint(float)` | transpiled (`construct-uint-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2505` |
| `bool(bool)` | transpiled (`construct-bool-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2507` |
| `bool(int)` | transpiled (`construct-bool-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2508` |
| `bool(uint)` | transpiled (`construct-bool-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2509` |
| `bool(float)` | transpiled (`construct-bool-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2510` |
| `ivec2(bvec2)` | transpiled (`call-ivec2-bvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2514` |
| `ivec2(ivec2)` | transpiled (`call-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2515` |
| `ivec2(uvec2)` | transpiled (`call-ivec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2516` |
| `ivec2(vec2)` | transpiled (`call-ivec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2517` |
| `vec2(bvec2)` | transpiled (`call-vec2-bvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2519` |
| `vec2(ivec2)` | transpiled (`call-vec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2520` |
| `vec2(uvec2)` | transpiled (`call-vec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2521` |
| `vec2(vec2)` | transpiled (`call-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2522` |
| `uvec2(bvec2)` | transpiled (`call-uvec2-bvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2524` |
| `uvec2(ivec2)` | transpiled (`call-uvec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2525` |
| `uvec2(uvec2)` | transpiled (`call-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2526` |
| `uvec2(vec2)` | transpiled (`call-uvec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2527` |
| `bvec2(bvec2)` | transpiled (`call-bvec2-bvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2529` |
| `bvec2(ivec2)` | transpiled (`call-bvec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2530` |
| `bvec2(uvec2)` | transpiled (`call-bvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2531` |
| `bvec2(vec2)` | transpiled (`call-bvec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2532` |
| `ivec3(bvec3)` | transpiled (`call-ivec3-bvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2534` |
| `ivec3(ivec3)` | transpiled (`call-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2535` |
| `ivec3(uvec3)` | transpiled (`call-ivec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2536` |
| `ivec3(vec3)` | transpiled (`call-ivec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2537` |
| `vec3(bvec3)` | transpiled (`call-vec3-bvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2539` |
| `vec3(ivec3)` | transpiled (`call-vec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2540` |
| `vec3(uvec3)` | transpiled (`call-vec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2541` |
| `vec3(vec3)` | transpiled (`call-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2542` |
| `uvec3(bvec3)` | transpiled (`call-uvec3-bvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2544` |
| `uvec3(ivec3)` | transpiled (`call-uvec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2545` |
| `uvec3(uvec3)` | transpiled (`call-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2546` |
| `uvec3(vec3)` | transpiled (`call-uvec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2547` |
| `bvec3(bvec3)` | transpiled (`call-bvec3-bvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2549` |
| `bvec3(ivec3)` | transpiled (`call-bvec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2550` |
| `bvec3(uvec3)` | transpiled (`call-bvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2551` |
| `bvec3(vec3)` | transpiled (`call-bvec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2552` |
| `ivec4(bvec4)` | transpiled (`call-ivec4-bvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2554` |
| `ivec4(ivec4)` | transpiled (`call-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2555` |
| `ivec4(uvec4)` | transpiled (`call-ivec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2556` |
| `ivec4(vec4)` | transpiled (`call-ivec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2557` |
| `vec4(bvec4)` | transpiled (`call-vec4-bvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2559` |
| `vec4(ivec4)` | transpiled (`call-vec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2560` |
| `vec4(uvec4)` | transpiled (`call-vec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2561` |
| `vec4(vec4)` | transpiled (`call-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2562` |
| `uvec4(bvec4)` | transpiled (`call-uvec4-bvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2564` |
| `uvec4(ivec4)` | transpiled (`call-uvec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2565` |
| `uvec4(uvec4)` | transpiled (`call-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2566` |
| `uvec4(vec4)` | transpiled (`call-uvec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2567` |
| `bvec4(bvec4)` | transpiled (`call-bvec4-bvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2569` |
| `bvec4(ivec4)` | transpiled (`call-bvec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2570` |
| `bvec4(uvec4)` | transpiled (`call-bvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2571` |
| `bvec4(vec4)` | transpiled (`call-bvec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2572` |
| `mat2(mat3)` | transpiled (`call-mat2-mat3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2576` |
| `mat2(mat4)` | transpiled (`call-mat2-mat4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2577` |
| `mat3(mat2)` | transpiled (`call-mat3-mat2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2578` |
| `mat3(mat4)` | transpiled (`call-mat3-mat4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2579` |
| `mat4(mat2)` | transpiled (`call-mat4-mat2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2580` |
| `mat4(mat3)` | transpiled (`call-mat4-mat3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2581` |
| `radians(float)` | transpiled (`call-radians-float`, `fold-call-radians`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2586` |
| `radians(vec2)` | transpiled (`call-radians-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2587` |
| `radians(vec3)` | transpiled (`call-radians-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2588` |
| `radians(vec4)` | transpiled (`call-radians-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2589` |
| `degrees(float)` | transpiled (`call-degrees-float`, `fold-call-degrees`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2593` |
| `degrees(vec2)` | transpiled (`call-degrees-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2594` |
| `degrees(vec3)` | transpiled (`call-degrees-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2595` |
| `degrees(vec4)` | transpiled (`call-degrees-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2596` |
| `sin(float)` | transpiled (`call-sin-float`, `call-wrong-type`, `call-too-many`, `fold-call-sin-cos`, `fold-call-call-of-calls`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2600` |
| `sin(vec2)` | transpiled (`call-sin-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2601` |
| `sin(vec3)` | transpiled (`call-sin-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2602` |
| `sin(vec4)` | transpiled (`call-sin-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2603` |
| `cos(float)` | transpiled (`call-cos-float`, `fold-call-sin-cos`, `fold-call-call-of-calls`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2607` |
| `cos(vec2)` | transpiled (`call-cos-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2608` |
| `cos(vec3)` | transpiled (`call-cos-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2609` |
| `cos(vec4)` | transpiled (`call-cos-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2610` |
| `tan(float)` | transpiled (`call-tan-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2614` |
| `tan(vec2)` | transpiled (`call-tan-vec2`, `fold-call-tan`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2615` |
| `tan(vec3)` | transpiled (`call-tan-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2616` |
| `tan(vec4)` | transpiled (`call-tan-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2617` |
| `asin(float)` | transpiled (`call-asin-float`, `fold-call-inverse-trigonometry`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2621` |
| `asin(vec2)` | transpiled (`call-asin-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2622` |
| `asin(vec3)` | transpiled (`call-asin-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2623` |
| `asin(vec4)` | transpiled (`call-asin-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2624` |
| `acos(float)` | transpiled (`call-acos-float`, `fold-call-inverse-trigonometry`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2628` |
| `acos(vec2)` | transpiled (`call-acos-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2629` |
| `acos(vec3)` | transpiled (`call-acos-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2630` |
| `acos(vec4)` | transpiled (`call-acos-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2631` |
| `atan(float)` | transpiled (`call-atan-float`, `fold-call-inverse-trigonometry`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2635` |
| `atan(vec2)` | transpiled (`call-atan-vec2`, `gpu-call-mix-of-nan-of-a-constant`, `gpu-call-mix-of-nan-of-a-parameter`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2636` |
| `atan(vec3)` | transpiled (`call-atan-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2637` |
| `atan(vec4)` | transpiled (`call-atan-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2638` |
| `atan(float,float)` | transpiled (`call-atan-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2639` |
| `atan(vec2,vec2)` | transpiled (`call-atan-vec2-vec2`, `fold-call-atan-of-two`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2640` |
| `atan(vec3,vec3)` | transpiled (`call-atan-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2641` |
| `atan(vec4,vec4)` | transpiled (`call-atan-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2642` |
| `sinh(float)` | transpiled (`call-sinh-float`, `gpu-call-sinh-of-a-constant`, `gpu-call-sinh-of-a-parameter`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2646` |
| `sinh(vec2)` | transpiled (`call-sinh-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2647` |
| `sinh(vec3)` | transpiled (`call-sinh-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2648` |
| `sinh(vec4)` | transpiled (`call-sinh-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2649` |
| `cosh(float)` | transpiled (`call-cosh-float`, `gpu-call-cosh-of-a-constant`, `gpu-call-cosh-of-a-parameter`, `gpu-call-cosh-near-the-float-range-of-a-constant`, `gpu-call-cosh-near-the-float-range-of-a-parameter`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2653` |
| `cosh(vec2)` | transpiled (`call-cosh-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2654` |
| `cosh(vec3)` | transpiled (`call-cosh-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2655` |
| `cosh(vec4)` | transpiled (`call-cosh-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2656` |
| `tanh(float)` | transpiled (`call-tanh-float`, `gpu-call-tanh-of-a-constant`, `gpu-call-tanh-of-a-parameter`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2660` |
| `tanh(vec2)` | transpiled (`call-tanh-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2661` |
| `tanh(vec3)` | transpiled (`call-tanh-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2662` |
| `tanh(vec4)` | transpiled (`call-tanh-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2663` |
| `asinh(float)` | transpiled (`call-asinh-float`, `gpu-call-asinh-of-a-constant`, `gpu-call-asinh-of-a-parameter`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2667` |
| `asinh(vec2)` | transpiled (`call-asinh-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2668` |
| `asinh(vec3)` | transpiled (`call-asinh-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2669` |
| `asinh(vec4)` | transpiled (`call-asinh-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2670` |
| `acosh(float)` | transpiled (`call-acosh-float`, `gpu-call-acosh-of-a-constant`, `gpu-call-acosh-of-a-parameter`, `gpu-call-acosh-outside-its-domain-of-a-constant`, `gpu-call-acosh-outside-its-domain-of-a-parameter`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2674` |
| `acosh(vec2)` | transpiled (`call-acosh-vec2`, `gpu-call-mix-of-nan-of-a-constant`, `gpu-call-mix-of-nan-of-a-parameter`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2675` |
| `acosh(vec3)` | transpiled (`call-acosh-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2676` |
| `acosh(vec4)` | transpiled (`call-acosh-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2677` |
| `atanh(float)` | transpiled (`call-atanh-float`, `gpu-call-atanh-of-a-constant`, `gpu-call-atanh-of-a-parameter`, `gpu-call-atanh-outside-its-domain-of-a-constant`, `gpu-call-atanh-outside-its-domain-of-a-parameter`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2681` |
| `atanh(vec2)` | transpiled (`call-atanh-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2682` |
| `atanh(vec3)` | transpiled (`call-atanh-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2683` |
| `atanh(vec4)` | transpiled (`call-atanh-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2684` |
| `pow(float,float)` | transpiled (`call-pow-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2689` |
| `pow(vec2,vec2)` | transpiled (`call-pow-vec2-vec2`, `fold-call-pow`, `fold-call-vector-mod-max-pow`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2690` |
| `pow(vec3,vec3)` | transpiled (`call-pow-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2691` |
| `pow(vec4,vec4)` | transpiled (`call-pow-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2692` |
| `exp(float)` | transpiled (`call-exp-float`, `fold-call-exp-log`, `fold-call-call-of-calls`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2696` |
| `exp(vec2)` | transpiled (`call-exp-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2697` |
| `exp(vec3)` | transpiled (`call-exp-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2698` |
| `exp(vec4)` | transpiled (`call-exp-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2699` |
| `log(float)` | transpiled (`call-log-float`, `fold-call-exp-log`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2703` |
| `log(vec2)` | transpiled (`call-log-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2704` |
| `log(vec3)` | transpiled (`call-log-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2705` |
| `log(vec4)` | transpiled (`call-log-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2706` |
| `exp2(float)` | transpiled (`call-exp2-float`, `fold-call-exp2-log2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2710` |
| `exp2(vec2)` | transpiled (`call-exp2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2711` |
| `exp2(vec3)` | transpiled (`call-exp2-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2712` |
| `exp2(vec4)` | transpiled (`call-exp2-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2713` |
| `log2(float)` | transpiled (`call-log2-float`, `fold-call-exp2-log2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2717` |
| `log2(vec2)` | transpiled (`call-log2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2718` |
| `log2(vec3)` | transpiled (`call-log2-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2719` |
| `log2(vec4)` | transpiled (`call-log2-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2720` |
| `sqrt(float)` | transpiled (`call-sqrt-float`, `fold-call-sqrt-inversesqrt`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2724` |
| `sqrt(vec2)` | transpiled (`call-sqrt-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2725` |
| `sqrt(vec3)` | transpiled (`call-sqrt-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2726` |
| `sqrt(vec4)` | transpiled (`call-sqrt-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2727` |
| `inversesqrt(float)` | transpiled (`call-inversesqrt-float`, `fold-call-sqrt-inversesqrt`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2731` |
| `inversesqrt(vec2)` | transpiled (`call-inversesqrt-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2732` |
| `inversesqrt(vec3)` | transpiled (`call-inversesqrt-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2733` |
| `inversesqrt(vec4)` | transpiled (`call-inversesqrt-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2734` |
| `abs(float)` | transpiled (`call-abs-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2739` |
| `abs(vec2)` | transpiled (`call-abs-vec2`, `fold-call-abs`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2740` |
| `abs(vec3)` | transpiled (`call-abs-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2741` |
| `abs(vec4)` | transpiled (`call-abs-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2742` |
| `abs(int)` | transpiled (`call-abs-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2744` |
| `abs(ivec2)` | transpiled (`call-abs-ivec2`, `fold-call-abs`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2745` |
| `abs(ivec3)` | transpiled (`call-abs-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2746` |
| `abs(ivec4)` | transpiled (`call-abs-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2747` |
| `sign(float)` | transpiled (`call-sign-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2751` |
| `sign(vec2)` | transpiled (`call-sign-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2752` |
| `sign(vec3)` | transpiled (`call-sign-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2753` |
| `sign(vec4)` | transpiled (`call-sign-vec4`, `fold-call-sign`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2754` |
| `sign(int)` | transpiled (`call-sign-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2756` |
| `sign(ivec2)` | transpiled (`call-sign-ivec2`, `fold-call-sign-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2757` |
| `sign(ivec3)` | transpiled (`call-sign-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2758` |
| `sign(ivec4)` | transpiled (`call-sign-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2759` |
| `floor(float)` | transpiled (`call-floor-float`, `fold-call-floor-ceil-fract-trunc`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2763` |
| `floor(vec2)` | transpiled (`call-floor-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2764` |
| `floor(vec3)` | transpiled (`call-floor-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2765` |
| `floor(vec4)` | transpiled (`call-floor-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2766` |
| `trunc(float)` | transpiled (`call-trunc-float`, `fold-call-floor-ceil-fract-trunc`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2770` |
| `trunc(vec2)` | transpiled (`call-trunc-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2771` |
| `trunc(vec3)` | transpiled (`call-trunc-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2772` |
| `trunc(vec4)` | transpiled (`call-trunc-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2773` |
| `round(float)` | transpiled (`call-round-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2777` |
| `round(vec2)` | transpiled (`call-round-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2778` |
| `round(vec3)` | transpiled (`call-round-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2779` |
| `round(vec4)` | transpiled (`call-round-vec4`, `fold-call-round`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2780` |
| `roundEven(float)` | transpiled (`call-roundEven-float`) | lowered: floor(x) + mod(floor(x), 2) at a half | untested (#1788) | `servers/rendering/shader_language.cpp:2784` |
| `roundEven(vec2)` | transpiled (`call-roundEven-vec2`) | lowered: floor(x) + mod(floor(x), 2) at a half | untested (#1788) | `servers/rendering/shader_language.cpp:2785` |
| `roundEven(vec3)` | transpiled (`call-roundEven-vec3`) | lowered: floor(x) + mod(floor(x), 2) at a half | untested (#1788) | `servers/rendering/shader_language.cpp:2786` |
| `roundEven(vec4)` | transpiled (`call-roundEven-vec4`, `fold-call-round-even`) | lowered: floor(x) + mod(floor(x), 2) at a half | untested (#1788) | `servers/rendering/shader_language.cpp:2787` |
| `ceil(float)` | transpiled (`call-ceil-float`, `fold-call-floor-ceil-fract-trunc`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2791` |
| `ceil(vec2)` | transpiled (`call-ceil-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2792` |
| `ceil(vec3)` | transpiled (`call-ceil-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2793` |
| `ceil(vec4)` | transpiled (`call-ceil-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2794` |
| `fract(float)` | transpiled (`call-fract-float`, `fold-call-floor-ceil-fract-trunc`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2798` |
| `fract(vec2)` | transpiled (`call-fract-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2799` |
| `fract(vec3)` | transpiled (`call-fract-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2800` |
| `fract(vec4)` | transpiled (`call-fract-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2801` |
| `mod(float,float)` | transpiled (`call-mod-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2805` |
| `mod(vec2,vec2)` | transpiled (`call-mod-vec2-vec2`, `fold-call-vector-mod-max-pow`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2806` |
| `mod(vec2,float)` | transpiled (`call-mod-vec2-float`, `fold-call-mod`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2807` |
| `mod(vec3,vec3)` | transpiled (`call-mod-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2808` |
| `mod(vec3,float)` | transpiled (`call-mod-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2809` |
| `mod(vec4,vec4)` | transpiled (`call-mod-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2810` |
| `mod(vec4,float)` | transpiled (`call-mod-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2811` |
| `modf(float,float)` | transpiled (`call-modf-float-float-fraction`, `call-modf-float-float-whole`, `call-out-to-a-swizzle`, `call-out-to-an-element`, `call-out-to-a-constant`, `call-out-to-a-value`, `call-out-to-a-const`) | lowered: trunc(x) and x - trunc(x) | untested (#1788) | `servers/rendering/shader_language.cpp:2815` |
| `modf(vec2,vec2)` | transpiled (`call-modf-vec2-vec2-fraction`, `call-modf-vec2-vec2-whole`) | lowered: trunc(x) and x - trunc(x) | untested (#1788) | `servers/rendering/shader_language.cpp:2816` |
| `modf(vec3,vec3)` | transpiled (`call-modf-vec3-vec3-fraction`, `call-modf-vec3-vec3-whole`) | lowered: trunc(x) and x - trunc(x) | untested (#1788) | `servers/rendering/shader_language.cpp:2817` |
| `modf(vec4,vec4)` | transpiled (`call-modf-vec4-vec4-fraction`, `call-modf-vec4-vec4-whole`) | lowered: trunc(x) and x - trunc(x) | untested (#1788) | `servers/rendering/shader_language.cpp:2818` |
| `min(float,float)` | transpiled (`call-min-float-float`, `fold-call-min-max-of-nan`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2822` |
| `min(vec2,vec2)` | transpiled (`call-min-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2823` |
| `min(vec2,float)` | transpiled (`call-min-vec2-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2824` |
| `min(vec3,vec3)` | transpiled (`call-min-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2825` |
| `min(vec3,float)` | transpiled (`call-min-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2826` |
| `min(vec4,vec4)` | transpiled (`call-min-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2827` |
| `min(vec4,float)` | transpiled (`call-min-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2828` |
| `min(int,int)` | transpiled (`call-min-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2830` |
| `min(ivec2,ivec2)` | transpiled (`call-min-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2831` |
| `min(ivec2,int)` | transpiled (`call-min-ivec2-int`, `call-uint-constant-to-int`, `fold-call-min-max-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2832` |
| `min(ivec3,ivec3)` | transpiled (`call-min-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2833` |
| `min(ivec3,int)` | transpiled (`call-min-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2834` |
| `min(ivec4,ivec4)` | transpiled (`call-min-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2835` |
| `min(ivec4,int)` | transpiled (`call-min-ivec4-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2836` |
| `min(uint,uint)` | transpiled (`call-min-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2838` |
| `min(uvec2,uvec2)` | transpiled (`call-min-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2839` |
| `min(uvec2,uint)` | transpiled (`call-min-uvec2-uint`, `fold-call-min-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2840` |
| `min(uvec3,uvec3)` | transpiled (`call-min-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2841` |
| `min(uvec3,uint)` | transpiled (`call-min-uvec3-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2842` |
| `min(uvec4,uvec4)` | transpiled (`call-min-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2843` |
| `min(uvec4,uint)` | transpiled (`call-min-uvec4-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2844` |
| `max(float,float)` | transpiled (`call-max-float-float`, `call-int-constant-to-float`, `fold-call-min-max-of-nan`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2848` |
| `max(vec2,vec2)` | transpiled (`call-max-vec2-vec2`, `fold-call-vector-mod-max-pow`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2849` |
| `max(vec2,float)` | transpiled (`call-max-vec2-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2850` |
| `max(vec3,vec3)` | transpiled (`call-max-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2851` |
| `max(vec3,float)` | transpiled (`call-max-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2852` |
| `max(vec4,vec4)` | transpiled (`call-max-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2853` |
| `max(vec4,float)` | transpiled (`call-max-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2854` |
| `max(int,int)` | transpiled (`call-max-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2856` |
| `max(ivec2,ivec2)` | transpiled (`call-max-ivec2-ivec2`, `fold-call-min-max-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2857` |
| `max(ivec2,int)` | transpiled (`call-max-ivec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2858` |
| `max(ivec3,ivec3)` | transpiled (`call-max-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2859` |
| `max(ivec3,int)` | transpiled (`call-max-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2860` |
| `max(ivec4,ivec4)` | transpiled (`call-max-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2861` |
| `max(ivec4,int)` | transpiled (`call-max-ivec4-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2862` |
| `max(uint,uint)` | transpiled (`call-max-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2864` |
| `max(uvec2,uvec2)` | transpiled (`call-max-uvec2-uvec2`, `fold-call-max-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2865` |
| `max(uvec2,uint)` | transpiled (`call-max-uvec2-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2866` |
| `max(uvec3,uvec3)` | transpiled (`call-max-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2867` |
| `max(uvec3,uint)` | transpiled (`call-max-uvec3-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2868` |
| `max(uvec4,uvec4)` | transpiled (`call-max-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2869` |
| `max(uvec4,uint)` | transpiled (`call-max-uvec4-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2870` |
| `clamp(float,float,float)` | transpiled (`call-clamp-float-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2874` |
| `clamp(vec2,vec2,vec2)` | transpiled (`call-clamp-vec2-vec2-vec2`, `fold-call-vector-bounds`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2875` |
| `clamp(vec3,vec3,vec3)` | transpiled (`call-clamp-vec3-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2876` |
| `clamp(vec4,vec4,vec4)` | transpiled (`call-clamp-vec4-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2877` |
| `clamp(vec2,float,float)` | transpiled (`call-clamp-vec2-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2878` |
| `clamp(vec3,float,float)` | transpiled (`call-clamp-vec3-float-float`, `fold-call-clamp`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2879` |
| `clamp(vec4,float,float)` | transpiled (`call-clamp-vec4-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2880` |
| `clamp(int,int,int)` | transpiled (`call-clamp-int-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2882` |
| `clamp(ivec2,ivec2,ivec2)` | transpiled (`call-clamp-ivec2-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2883` |
| `clamp(ivec3,ivec3,ivec3)` | transpiled (`call-clamp-ivec3-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2884` |
| `clamp(ivec4,ivec4,ivec4)` | transpiled (`call-clamp-ivec4-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2885` |
| `clamp(ivec2,int,int)` | transpiled (`call-clamp-ivec2-int-int`, `fold-call-clamp-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2886` |
| `clamp(ivec3,int,int)` | transpiled (`call-clamp-ivec3-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2887` |
| `clamp(ivec4,int,int)` | transpiled (`call-clamp-ivec4-int-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2888` |
| `clamp(uint,uint,uint)` | transpiled (`call-clamp-uint-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2890` |
| `clamp(uvec2,uvec2,uvec2)` | transpiled (`call-clamp-uvec2-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2891` |
| `clamp(uvec3,uvec3,uvec3)` | transpiled (`call-clamp-uvec3-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2892` |
| `clamp(uvec4,uvec4,uvec4)` | transpiled (`call-clamp-uvec4-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2893` |
| `clamp(uvec2,uint,uint)` | transpiled (`call-clamp-uvec2-uint-uint`, `fold-call-clamp-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2894` |
| `clamp(uvec3,uint,uint)` | transpiled (`call-clamp-uvec3-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2895` |
| `clamp(uvec4,uint,uint)` | transpiled (`call-clamp-uvec4-uint-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2896` |
| `mix(float,float,float)` | transpiled (`call-mix-float-float-float`, `fold-call-mix`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2900` |
| `mix(vec2,vec2,float)` | transpiled (`call-mix-vec2-vec2-float`, `gpu-call-mix-of-nan-of-a-constant`, `gpu-call-mix-of-nan-of-a-parameter`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2901` |
| `mix(vec2,vec2,bvec2)` | transpiled (`call-mix-vec2-vec2-bvec2`, `fold-call-mix-bool`) | lowered: select by lane | untested (#1788) | `servers/rendering/shader_language.cpp:2902` |
| `mix(vec2,vec2,vec2)` | transpiled (`call-mix-vec2-vec2-vec2`, `fold-call-vector-bounds`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2903` |
| `mix(vec3,vec3,float)` | transpiled (`call-mix-vec3-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2904` |
| `mix(vec3,vec3,bvec3)` | transpiled (`call-mix-vec3-vec3-bvec3`) | lowered: select by lane | untested (#1788) | `servers/rendering/shader_language.cpp:2905` |
| `mix(vec3,vec3,vec3)` | transpiled (`call-mix-vec3-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2906` |
| `mix(vec4,vec4,float)` | transpiled (`call-mix-vec4-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2907` |
| `mix(vec4,vec4,bvec4)` | transpiled (`call-mix-vec4-vec4-bvec4`) | lowered: select by lane | untested (#1788) | `servers/rendering/shader_language.cpp:2908` |
| `mix(vec4,vec4,vec4)` | transpiled (`call-mix-vec4-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2909` |
| `step(float,float)` | transpiled (`call-step-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2913` |
| `step(vec2,vec2)` | transpiled (`call-step-vec2-vec2`, `fold-call-vector-steps`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2914` |
| `step(vec3,vec3)` | transpiled (`call-step-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2915` |
| `step(vec4,vec4)` | transpiled (`call-step-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2916` |
| `step(float,vec2)` | transpiled (`call-step-float-vec2`, `fold-call-step`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2917` |
| `step(float,vec3)` | transpiled (`call-step-float-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2918` |
| `step(float,vec4)` | transpiled (`call-step-float-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2919` |
| `smoothstep(float,float,float)` | transpiled (`call-smoothstep-float-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2923` |
| `smoothstep(vec2,vec2,vec2)` | transpiled (`call-smoothstep-vec2-vec2-vec2`, `fold-call-vector-steps`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2924` |
| `smoothstep(vec3,vec3,vec3)` | transpiled (`call-smoothstep-vec3-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2925` |
| `smoothstep(vec4,vec4,vec4)` | transpiled (`call-smoothstep-vec4-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2926` |
| `smoothstep(float,float,vec2)` | transpiled (`call-smoothstep-float-float-vec2`, `fold-call-smoothstep`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2927` |
| `smoothstep(float,float,vec3)` | transpiled (`call-smoothstep-float-float-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2928` |
| `smoothstep(float,float,vec4)` | transpiled (`call-smoothstep-float-float-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2929` |
| `isnan(float)` | transpiled (`call-isnan-float`, `fold-call-isnan-isinf`) | lowered: x != x | untested (#1788) | `servers/rendering/shader_language.cpp:2933` |
| `isnan(vec2)` | transpiled (`call-isnan-vec2`) | lowered: x != x | untested (#1788) | `servers/rendering/shader_language.cpp:2934` |
| `isnan(vec3)` | transpiled (`call-isnan-vec3`) | lowered: x != x | untested (#1788) | `servers/rendering/shader_language.cpp:2935` |
| `isnan(vec4)` | transpiled (`call-isnan-vec4`) | lowered: x != x | untested (#1788) | `servers/rendering/shader_language.cpp:2936` |
| `isinf(float)` | transpiled (`call-isinf-float`, `fold-call-isnan-isinf`) | lowered: abs(x) == infinity | untested (#1788) | `servers/rendering/shader_language.cpp:2940` |
| `isinf(vec2)` | transpiled (`call-isinf-vec2`) | lowered: abs(x) == infinity | untested (#1788) | `servers/rendering/shader_language.cpp:2941` |
| `isinf(vec3)` | transpiled (`call-isinf-vec3`) | lowered: abs(x) == infinity | untested (#1788) | `servers/rendering/shader_language.cpp:2942` |
| `isinf(vec4)` | transpiled (`call-isinf-vec4`) | lowered: abs(x) == infinity | untested (#1788) | `servers/rendering/shader_language.cpp:2943` |
| `floatBitsToInt(float)` | transpiled (`call-floatBitsToInt-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2947` |
| `floatBitsToInt(vec2)` | transpiled (`call-floatBitsToInt-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2948` |
| `floatBitsToInt(vec3)` | transpiled (`call-floatBitsToInt-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2949` |
| `floatBitsToInt(vec4)` | transpiled (`call-floatBitsToInt-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2950` |
| `floatBitsToUint(float)` | transpiled (`call-floatBitsToUint-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2954` |
| `floatBitsToUint(vec2)` | transpiled (`call-floatBitsToUint-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2955` |
| `floatBitsToUint(vec3)` | transpiled (`call-floatBitsToUint-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2956` |
| `floatBitsToUint(vec4)` | transpiled (`call-floatBitsToUint-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2957` |
| `intBitsToFloat(int)` | transpiled (`call-intBitsToFloat-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2961` |
| `intBitsToFloat(ivec2)` | transpiled (`call-intBitsToFloat-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2962` |
| `intBitsToFloat(ivec3)` | transpiled (`call-intBitsToFloat-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2963` |
| `intBitsToFloat(ivec4)` | transpiled (`call-intBitsToFloat-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2964` |
| `uintBitsToFloat(uint)` | transpiled (`call-uintBitsToFloat-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2968` |
| `uintBitsToFloat(uvec2)` | transpiled (`call-uintBitsToFloat-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2969` |
| `uintBitsToFloat(uvec3)` | transpiled (`call-uintBitsToFloat-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2970` |
| `uintBitsToFloat(uvec4)` | transpiled (`call-uintBitsToFloat-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2971` |
| `length(float)` | transpiled (`call-length-float`, `call-whole-array`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2976` |
| `length(vec2)` | transpiled (`call-length-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2977` |
| `length(vec3)` | transpiled (`call-length-vec3`, `fold-call-length`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2978` |
| `length(vec4)` | transpiled (`call-length-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2979` |
| `distance(float,float)` | transpiled (`call-distance-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2983` |
| `distance(vec2,vec2)` | transpiled (`call-distance-vec2-vec2`, `fold-call-distance`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2984` |
| `distance(vec3,vec3)` | transpiled (`call-distance-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2985` |
| `distance(vec4,vec4)` | transpiled (`call-distance-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2986` |
| `dot(float,float)` | transpiled (`call-dot-float-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2990` |
| `dot(vec2,vec2)` | transpiled (`call-dot-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2991` |
| `dot(vec3,vec3)` | transpiled (`call-dot-vec3-vec3`, `fold-call-dot`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2992` |
| `dot(vec4,vec4)` | transpiled (`call-dot-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2993` |
| `cross(vec3,vec3)` | transpiled (`call-cross-vec3-vec3`, `fold-call-cross`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:2997` |
| `normalize(float)` | transpiled (`call-normalize-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3001` |
| `normalize(vec2)` | transpiled (`call-normalize-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3002` |
| `normalize(vec3)` | transpiled (`call-normalize-vec3`, `fold-call-normalize`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3003` |
| `normalize(vec4)` | transpiled (`call-normalize-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3004` |
| `reflect(vec2,vec2)` | transpiled (`call-reflect-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3008` |
| `reflect(vec3,vec3)` | transpiled (`call-reflect-vec3-vec3`, `fold-call-reflect`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3009` |
| `reflect(vec4,vec4)` | transpiled (`call-reflect-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3010` |
| `refract(vec2,vec2,float)` | transpiled (`call-refract-vec2-vec2-float`, `fold-call-refract-past-the-critical-angle`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3014` |
| `refract(vec3,vec3,float)` | transpiled (`call-refract-vec3-vec3-float`, `fold-call-refract`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3015` |
| `refract(vec4,vec4,float)` | transpiled (`call-refract-vec4-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3016` |
| `faceforward(vec2,vec2,vec2)` | transpiled (`call-faceforward-vec2-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3020` |
| `faceforward(vec3,vec3,vec3)` | transpiled (`call-faceforward-vec3-vec3-vec3`, `fold-call-faceforward`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3021` |
| `faceforward(vec4,vec4,vec4)` | transpiled (`call-faceforward-vec4-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3022` |
| `matrixCompMult(mat2,mat2)` | transpiled (`call-matrixCompMult-mat2-mat2`, `gpu-call-matrix-comp-mult-of-a-constant`, `gpu-call-matrix-comp-mult-of-a-parameter`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:3026` |
| `matrixCompMult(mat3,mat3)` | transpiled (`call-matrixCompMult-mat3-mat3`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:3027` |
| `matrixCompMult(mat4,mat4)` | transpiled (`call-matrixCompMult-mat4-mat4`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:3028` |
| `outerProduct(vec2,vec2)` | transpiled (`call-outerProduct-vec2-vec2`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:3032` |
| `outerProduct(vec3,vec3)` | transpiled (`call-outerProduct-vec3-vec3`, `fold-call-outer-product`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:3033` |
| `outerProduct(vec4,vec4)` | transpiled (`call-outerProduct-vec4-vec4`) | lowered: column by column | untested (#1788) | `servers/rendering/shader_language.cpp:3034` |
| `transpose(mat2)` | transpiled (`call-transpose-mat2`, `gpu-call-transpose-of-a-constant`, `gpu-call-transpose-of-a-parameter`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3038` |
| `transpose(mat3)` | transpiled (`call-transpose-mat3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3039` |
| `transpose(mat4)` | transpiled (`call-transpose-mat4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3040` |
| `determinant(mat2)` | transpiled (`call-determinant-mat2`, `gpu-call-determinant-of-a-constant`, `gpu-call-determinant-of-a-parameter`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3044` |
| `determinant(mat3)` | transpiled (`call-determinant-mat3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3045` |
| `determinant(mat4)` | transpiled (`call-determinant-mat4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3046` |
| `inverse(mat2)` | transpiled (`call-inverse-mat2`, `gpu-call-inverse-of-a-constant`, `gpu-call-inverse-of-a-parameter`, `gpu-call-inverse-of-a-singular-matrix-of-a-constant`, `gpu-call-inverse-of-a-singular-matrix-of-a-parameter`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3050` |
| `inverse(mat3)` | transpiled (`call-inverse-mat3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3051` |
| `inverse(mat4)` | transpiled (`call-inverse-mat4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3052` |
| `lessThan(vec2,vec2)` | transpiled (`call-lessThan-vec2-vec2`, `fold-call-less-than`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3056` |
| `lessThan(vec3,vec3)` | transpiled (`call-lessThan-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3057` |
| `lessThan(vec4,vec4)` | transpiled (`call-lessThan-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3058` |
| `lessThan(ivec2,ivec2)` | transpiled (`call-lessThan-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3060` |
| `lessThan(ivec3,ivec3)` | transpiled (`call-lessThan-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3061` |
| `lessThan(ivec4,ivec4)` | transpiled (`call-lessThan-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3062` |
| `lessThan(uvec3,uvec3)` | transpiled (`call-lessThan-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3064` |
| `lessThan(uvec4,uvec4)` | transpiled (`call-lessThan-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3065` |
| `lessThan(uvec2,uvec2)` | transpiled (`call-lessThan-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3066` |
| `greaterThan(vec2,vec2)` | transpiled (`call-greaterThan-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3070` |
| `greaterThan(vec3,vec3)` | transpiled (`call-greaterThan-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3071` |
| `greaterThan(vec4,vec4)` | transpiled (`call-greaterThan-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3072` |
| `greaterThan(ivec2,ivec2)` | transpiled (`call-greaterThan-ivec2-ivec2`, `fold-call-less-than`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3074` |
| `greaterThan(ivec3,ivec3)` | transpiled (`call-greaterThan-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3075` |
| `greaterThan(ivec4,ivec4)` | transpiled (`call-greaterThan-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3076` |
| `greaterThan(uvec2,uvec2)` | transpiled (`call-greaterThan-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3078` |
| `greaterThan(uvec3,uvec3)` | transpiled (`call-greaterThan-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3079` |
| `greaterThan(uvec4,uvec4)` | transpiled (`call-greaterThan-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3080` |
| `lessThanEqual(vec2,vec2)` | transpiled (`call-lessThanEqual-vec2-vec2`, `fold-call-less-than-equal-of-nan`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3084` |
| `lessThanEqual(vec3,vec3)` | transpiled (`call-lessThanEqual-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3085` |
| `lessThanEqual(vec4,vec4)` | transpiled (`call-lessThanEqual-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3086` |
| `lessThanEqual(ivec2,ivec2)` | transpiled (`call-lessThanEqual-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3088` |
| `lessThanEqual(ivec3,ivec3)` | transpiled (`call-lessThanEqual-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3089` |
| `lessThanEqual(ivec4,ivec4)` | transpiled (`call-lessThanEqual-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3090` |
| `lessThanEqual(uvec2,uvec2)` | transpiled (`call-lessThanEqual-uvec2-uvec2`, `fold-call-compare-int-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3092` |
| `lessThanEqual(uvec3,uvec3)` | transpiled (`call-lessThanEqual-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3093` |
| `lessThanEqual(uvec4,uvec4)` | transpiled (`call-lessThanEqual-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3094` |
| `greaterThanEqual(vec2,vec2)` | transpiled (`call-greaterThanEqual-vec2-vec2`, `fold-call-less-than-equal-of-nan`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3098` |
| `greaterThanEqual(vec3,vec3)` | transpiled (`call-greaterThanEqual-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3099` |
| `greaterThanEqual(vec4,vec4)` | transpiled (`call-greaterThanEqual-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3100` |
| `greaterThanEqual(ivec2,ivec2)` | transpiled (`call-greaterThanEqual-ivec2-ivec2`, `fold-call-compare-int-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3102` |
| `greaterThanEqual(ivec3,ivec3)` | transpiled (`call-greaterThanEqual-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3103` |
| `greaterThanEqual(ivec4,ivec4)` | transpiled (`call-greaterThanEqual-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3104` |
| `greaterThanEqual(uvec2,uvec2)` | transpiled (`call-greaterThanEqual-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3106` |
| `greaterThanEqual(uvec3,uvec3)` | transpiled (`call-greaterThanEqual-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3107` |
| `greaterThanEqual(uvec4,uvec4)` | transpiled (`call-greaterThanEqual-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3108` |
| `equal(vec2,vec2)` | transpiled (`call-equal-vec2-vec2`, `fold-call-equal`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3112` |
| `equal(vec3,vec3)` | transpiled (`call-equal-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3113` |
| `equal(vec4,vec4)` | transpiled (`call-equal-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3114` |
| `equal(ivec2,ivec2)` | transpiled (`call-equal-ivec2-ivec2`, `fold-call-equal-int-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3116` |
| `equal(ivec3,ivec3)` | transpiled (`call-equal-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3117` |
| `equal(ivec4,ivec4)` | transpiled (`call-equal-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3118` |
| `equal(uvec2,uvec2)` | transpiled (`call-equal-uvec2-uvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3120` |
| `equal(uvec3,uvec3)` | transpiled (`call-equal-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3121` |
| `equal(uvec4,uvec4)` | transpiled (`call-equal-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3122` |
| `equal(bvec2,bvec2)` | transpiled (`call-equal-bvec2-bvec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3124` |
| `equal(bvec3,bvec3)` | transpiled (`call-equal-bvec3-bvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3125` |
| `equal(bvec4,bvec4)` | transpiled (`call-equal-bvec4-bvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3126` |
| `notEqual(vec2,vec2)` | transpiled (`call-notEqual-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3130` |
| `notEqual(vec3,vec3)` | transpiled (`call-notEqual-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3131` |
| `notEqual(vec4,vec4)` | transpiled (`call-notEqual-vec4-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3132` |
| `notEqual(ivec2,ivec2)` | transpiled (`call-notEqual-ivec2-ivec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3134` |
| `notEqual(ivec3,ivec3)` | transpiled (`call-notEqual-ivec3-ivec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3135` |
| `notEqual(ivec4,ivec4)` | transpiled (`call-notEqual-ivec4-ivec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3136` |
| `notEqual(uvec2,uvec2)` | transpiled (`call-notEqual-uvec2-uvec2`, `fold-call-equal`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3138` |
| `notEqual(uvec3,uvec3)` | transpiled (`call-notEqual-uvec3-uvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3139` |
| `notEqual(uvec4,uvec4)` | transpiled (`call-notEqual-uvec4-uvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3140` |
| `notEqual(bvec2,bvec2)` | transpiled (`call-notEqual-bvec2-bvec2`, `fold-call-equal-int-bool`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3142` |
| `notEqual(bvec3,bvec3)` | transpiled (`call-notEqual-bvec3-bvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3143` |
| `notEqual(bvec4,bvec4)` | transpiled (`call-notEqual-bvec4-bvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3144` |
| `any(bvec2)` | transpiled (`call-any-bvec2`, `fold-call-any-all-not`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3148` |
| `any(bvec3)` | transpiled (`call-any-bvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3149` |
| `any(bvec4)` | transpiled (`call-any-bvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3150` |
| `all(bvec2)` | transpiled (`call-all-bvec2`, `fold-call-any-all-not`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3154` |
| `all(bvec3)` | transpiled (`call-all-bvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3155` |
| `all(bvec4)` | transpiled (`call-all-bvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3156` |
| `not(bvec2)` | transpiled (`call-not-bvec2`, `fold-call-any-all-not`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3160` |
| `not(bvec3)` | transpiled (`call-not-bvec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3161` |
| `not(bvec4)` | transpiled (`call-not-bvec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3162` |
| `textureSize(sampler2D,int)` | transpiled (`texture-2d-size`, `texture-2d-size-unset`, `texture-function-textureSize-sampler2D-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3167` |
| `textureSize(isampler2D,int)` | transpiled (`texture-function-textureSize-isampler2D-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3168` |
| `textureSize(usampler2D,int)` | transpiled (`texture-function-textureSize-usampler2D-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3169` |
| `textureSize(sampler2DArray,int)` | transpiled (`texture-function-textureSize-sampler2DArray-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3170` |
| `textureSize(isampler2DArray,int)` | transpiled (`texture-function-textureSize-isampler2DArray-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3171` |
| `textureSize(usampler2DArray,int)` | transpiled (`texture-function-textureSize-usampler2DArray-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3172` |
| `textureSize(sampler3D,int)` | transpiled (`texture-function-textureSize-sampler3D-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3173` |
| `textureSize(isampler3D,int)` | transpiled (`texture-function-textureSize-isampler3D-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3174` |
| `textureSize(usampler3D,int)` | transpiled (`texture-function-textureSize-usampler3D-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3175` |
| `textureSize(samplerCube,int)` | transpiled (`texture-function-textureSize-samplerCube-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3176` |
| `textureSize(samplerCubeArray,int)` | transpiled (`texture-cubes-size-lane`, `texture-cubes-size-swizzle`, `texture-cubes-size-float-constructor`, `texture-cubes-size-int-constructor`, `texture-cubes-size-first-of-two`, `texture-cubes-size-last-of-three`, `texture-cubes-size-before-scalar`, `texture-cubes-size-scaled-lane`, `texture-cubes-size-vector-sum`, `texture-cubes-size-component-wise-call`, `texture-cubes-size-equal-sizes`, `texture-cubes-size-equal-vector`, `texture-cubes-size-choice`, `texture-cubes-size-returned`, `texture-cubes-size-declared`, `texture-function-textureSize-samplerCubeArray-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3177` |
| `texture(sampler2D,vec2)` | transpiled (`texture-removed-screen-texture`, `texture-removed-depth-texture`, `texture-removed-normal-roughness-texture`, `texture-2d-filter_nearest`, `texture-2d-filter_linear`, `texture-2d-filter_nearest_mipmap`, `texture-2d-filter_linear_mipmap`, `texture-2d-filter_nearest_mipmap_anisotropic`, `texture-2d-filter_linear_mipmap_anisotropic`, `texture-2d-default-filter`, `texture-2d-repeat-enable`, `texture-2d-repeat-disable`, `texture-unset-none`, `texture-unset-hint_default_white`, `texture-unset-hint_default_black`, `texture-unset-hint_default_transparent`, `texture-unset-hint_normal`, `texture-unset-hint_roughness_normal`, `texture-unset-hint_anisotropy`, `texture-unset-hint_roughness_r`, `texture-unset-hint_roughness_g`, `texture-unset-hint_roughness_b`, `texture-unset-hint_roughness_a`, `texture-unset-hint_roughness_gray`, `texture-set-null-default-black`, `texture-2d-source-color`, `texture-2d-source-color-hdr`, `texture-argument`, `texture-array-elements`, `texture-array-computed-index`, `texture-array-computed-argument`, `texture-function-texture-sampler2D-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3181` |
| `texture(sampler2D,vec2,float)` | transpiled (`texture-function-texture-sampler2D-vec2-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3182` |
| `texture(usampler2D,vec2)` | transpiled (`texture-unsigned`, `texture-function-texture-usampler2D-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3183` |
| `texture(usampler2D,vec2,float)` | transpiled (`texture-function-texture-usampler2D-vec2-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3184` |
| `texture(isampler2D,vec2)` | transpiled (`texture-function-texture-isampler2D-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3185` |
| `texture(isampler2D,vec2,float)` | transpiled (`texture-function-texture-isampler2D-vec2-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3186` |
| `texture(sampler2DArray,vec3)` | transpiled (`texture-layers`, `texture-function-texture-sampler2DArray-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3187` |
| `texture(sampler2DArray,vec3,float)` | transpiled (`texture-function-texture-sampler2DArray-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3188` |
| `texture(usampler2DArray,vec3)` | transpiled (`texture-function-texture-usampler2DArray-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3189` |
| `texture(usampler2DArray,vec3,float)` | transpiled (`texture-function-texture-usampler2DArray-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3190` |
| `texture(isampler2DArray,vec3)` | transpiled (`texture-function-texture-isampler2DArray-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3191` |
| `texture(isampler2DArray,vec3,float)` | transpiled (`texture-function-texture-isampler2DArray-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3192` |
| `texture(sampler3D,vec3)` | transpiled (`texture-volume`, `texture-function-texture-sampler3D-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3193` |
| `texture(sampler3D,vec3,float)` | transpiled (`texture-function-texture-sampler3D-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3194` |
| `texture(usampler3D,vec3)` | transpiled (`texture-function-texture-usampler3D-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3195` |
| `texture(usampler3D,vec3,float)` | transpiled (`texture-function-texture-usampler3D-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3196` |
| `texture(isampler3D,vec3)` | transpiled (`texture-function-texture-isampler3D-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3197` |
| `texture(isampler3D,vec3,float)` | transpiled (`texture-function-texture-isampler3D-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3198` |
| `texture(samplerCube,vec3)` | transpiled (`texture-cube`, `texture-function-texture-samplerCube-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3199` |
| `texture(samplerCube,vec3,float)` | transpiled (`texture-function-texture-samplerCube-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3200` |
| `texture(samplerCubeArray,vec4)` | transpiled (`texture-unset-cubes-none`, `texture-unset-cubes-hint_default_white`, `texture-unset-cubes-hint_default_black`, `texture-unset-cubes-hint_default_transparent`, `texture-cubes`, `texture-cubes-linear-edges`, `texture-function-texture-samplerCubeArray-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3201` |
| `texture(samplerCubeArray,vec4,float)` | transpiled (`texture-function-texture-samplerCubeArray-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3202` |
| `texture(samplerExternalOES,vec2)` | transpiled (`texture-unset-external-array`, `texture-external`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3203` |
| `texture(samplerExternalOES,vec2,float)` | transpiled (`texture-external-bias`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3204` |
| `textureProj(sampler2D,vec3)` | transpiled (`texture-function-textureProj-sampler2D-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3208` |
| `textureProj(sampler2D,vec4)` | transpiled (`texture-function-textureProj-sampler2D-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3209` |
| `textureProj(sampler2D,vec3,float)` | transpiled (`texture-function-textureProj-sampler2D-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3210` |
| `textureProj(sampler2D,vec4,float)` | transpiled (`texture-function-textureProj-sampler2D-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3211` |
| `textureProj(isampler2D,vec3)` | transpiled (`texture-function-textureProj-isampler2D-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3212` |
| `textureProj(isampler2D,vec4)` | transpiled (`texture-function-textureProj-isampler2D-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3213` |
| `textureProj(isampler2D,vec3,float)` | transpiled (`texture-function-textureProj-isampler2D-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3214` |
| `textureProj(isampler2D,vec4,float)` | transpiled (`texture-function-textureProj-isampler2D-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3215` |
| `textureProj(usampler2D,vec3)` | transpiled (`texture-function-textureProj-usampler2D-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3216` |
| `textureProj(usampler2D,vec4)` | transpiled (`texture-function-textureProj-usampler2D-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3217` |
| `textureProj(usampler2D,vec3,float)` | transpiled (`texture-function-textureProj-usampler2D-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3218` |
| `textureProj(usampler2D,vec4,float)` | transpiled (`texture-function-textureProj-usampler2D-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3219` |
| `textureProj(sampler3D,vec4)` | transpiled (`texture-function-textureProj-sampler3D-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3220` |
| `textureProj(sampler3D,vec4,float)` | transpiled (`texture-function-textureProj-sampler3D-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3221` |
| `textureProj(isampler3D,vec4)` | transpiled (`texture-function-textureProj-isampler3D-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3222` |
| `textureProj(isampler3D,vec4,float)` | transpiled (`texture-function-textureProj-isampler3D-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3223` |
| `textureProj(usampler3D,vec4)` | transpiled (`texture-function-textureProj-usampler3D-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3224` |
| `textureProj(usampler3D,vec4,float)` | transpiled (`texture-function-textureProj-usampler3D-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3225` |
| `textureLod(sampler2D,vec2,float)` | transpiled (`texture-2d-lod`, `texture-2d-lod-linear-mipmap`, `texture-2d-lod-linear-no-mipmap-filter`, `texture-function-textureLod-sampler2D-vec2-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3229` |
| `textureLod(isampler2D,vec2,float)` | transpiled (`texture-function-textureLod-isampler2D-vec2-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3230` |
| `textureLod(usampler2D,vec2,float)` | transpiled (`texture-function-textureLod-usampler2D-vec2-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3231` |
| `textureLod(sampler2DArray,vec3,float)` | transpiled (`texture-layers-lod-rg8`, `texture-function-textureLod-sampler2DArray-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3232` |
| `textureLod(isampler2DArray,vec3,float)` | transpiled (`texture-function-textureLod-isampler2DArray-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3233` |
| `textureLod(usampler2DArray,vec3,float)` | transpiled (`texture-function-textureLod-usampler2DArray-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3234` |
| `textureLod(sampler3D,vec3,float)` | transpiled (`texture-3d-lod`, `texture-function-textureLod-sampler3D-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3235` |
| `textureLod(isampler3D,vec3,float)` | transpiled (`texture-function-textureLod-isampler3D-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3236` |
| `textureLod(usampler3D,vec3,float)` | transpiled (`texture-function-textureLod-usampler3D-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3237` |
| `textureLod(samplerCube,vec3,float)` | transpiled (`texture-function-textureLod-samplerCube-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3238` |
| `textureLod(samplerCubeArray,vec4,float)` | transpiled (`texture-function-textureLod-samplerCubeArray-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3239` |
| `texelFetch(sampler2D,ivec2,int)` | transpiled (`texture-2d-texel-fetch`, `texture-function-texelFetch-sampler2D-ivec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3243` |
| `texelFetch(isampler2D,ivec2,int)` | transpiled (`texture-function-texelFetch-isampler2D-ivec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3244` |
| `texelFetch(usampler2D,ivec2,int)` | transpiled (`texture-function-texelFetch-usampler2D-ivec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3245` |
| `texelFetch(sampler2DArray,ivec3,int)` | transpiled (`texture-function-texelFetch-sampler2DArray-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3246` |
| `texelFetch(isampler2DArray,ivec3,int)` | transpiled (`texture-function-texelFetch-isampler2DArray-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3247` |
| `texelFetch(usampler2DArray,ivec3,int)` | transpiled (`texture-function-texelFetch-usampler2DArray-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3248` |
| `texelFetch(sampler3D,ivec3,int)` | transpiled (`texture-function-texelFetch-sampler3D-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3249` |
| `texelFetch(isampler3D,ivec3,int)` | transpiled (`texture-function-texelFetch-isampler3D-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3250` |
| `texelFetch(usampler3D,ivec3,int)` | transpiled (`texture-function-texelFetch-usampler3D-ivec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3251` |
| `textureProjLod(sampler2D,vec3,float)` | transpiled (`texture-function-textureProjLod-sampler2D-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3255` |
| `textureProjLod(sampler2D,vec4,float)` | transpiled (`texture-function-textureProjLod-sampler2D-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3256` |
| `textureProjLod(isampler2D,vec3,float)` | transpiled (`texture-function-textureProjLod-isampler2D-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3257` |
| `textureProjLod(isampler2D,vec4,float)` | transpiled (`texture-function-textureProjLod-isampler2D-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3258` |
| `textureProjLod(usampler2D,vec3,float)` | transpiled (`texture-function-textureProjLod-usampler2D-vec3-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3259` |
| `textureProjLod(usampler2D,vec4,float)` | transpiled (`texture-function-textureProjLod-usampler2D-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3260` |
| `textureProjLod(sampler3D,vec4,float)` | transpiled (`texture-function-textureProjLod-sampler3D-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3261` |
| `textureProjLod(isampler3D,vec4,float)` | transpiled (`texture-function-textureProjLod-isampler3D-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3262` |
| `textureProjLod(usampler3D,vec4,float)` | transpiled (`texture-function-textureProjLod-usampler3D-vec4-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3263` |
| `textureGrad(sampler2D,vec2,vec2,vec2)` | transpiled (`texture-function-textureGrad-sampler2D-vec2-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3267` |
| `textureGrad(isampler2D,vec2,vec2,vec2)` | transpiled (`texture-function-textureGrad-isampler2D-vec2-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3268` |
| `textureGrad(usampler2D,vec2,vec2,vec2)` | transpiled (`texture-function-textureGrad-usampler2D-vec2-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3269` |
| `textureGrad(sampler2DArray,vec3,vec2,vec2)` | transpiled (`texture-function-textureGrad-sampler2DArray-vec3-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3270` |
| `textureGrad(isampler2DArray,vec3,vec2,vec2)` | transpiled (`texture-function-textureGrad-isampler2DArray-vec3-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3271` |
| `textureGrad(usampler2DArray,vec3,vec2,vec2)` | transpiled (`texture-function-textureGrad-usampler2DArray-vec3-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3272` |
| `textureGrad(sampler3D,vec3,vec3,vec3)` | transpiled (`texture-function-textureGrad-sampler3D-vec3-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3273` |
| `textureGrad(isampler3D,vec3,vec3,vec3)` | transpiled (`texture-function-textureGrad-isampler3D-vec3-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3274` |
| `textureGrad(usampler3D,vec3,vec3,vec3)` | transpiled (`texture-function-textureGrad-usampler3D-vec3-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3275` |
| `textureGrad(samplerCube,vec3,vec3,vec3)` | transpiled (`texture-function-textureGrad-samplerCube-vec3-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3276` |
| `textureGrad(samplerCubeArray,vec4,vec3,vec3)` | transpiled (`texture-function-textureGrad-samplerCubeArray-vec4-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3277` |
| `textureProjGrad(sampler2D,vec3,vec2,vec2)` | transpiled (`texture-function-textureProjGrad-sampler2D-vec3-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3281` |
| `textureProjGrad(sampler2D,vec4,vec2,vec2)` | transpiled (`texture-function-textureProjGrad-sampler2D-vec4-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3282` |
| `textureProjGrad(isampler2D,vec3,vec2,vec2)` | transpiled (`texture-function-textureProjGrad-isampler2D-vec3-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3283` |
| `textureProjGrad(isampler2D,vec4,vec2,vec2)` | transpiled (`texture-function-textureProjGrad-isampler2D-vec4-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3284` |
| `textureProjGrad(usampler2D,vec3,vec2,vec2)` | transpiled (`texture-function-textureProjGrad-usampler2D-vec3-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3285` |
| `textureProjGrad(usampler2D,vec4,vec2,vec2)` | transpiled (`texture-function-textureProjGrad-usampler2D-vec4-vec2-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3286` |
| `textureProjGrad(sampler3D,vec4,vec3,vec3)` | transpiled (`texture-function-textureProjGrad-sampler3D-vec4-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3287` |
| `textureProjGrad(isampler3D,vec4,vec3,vec3)` | transpiled (`texture-function-textureProjGrad-isampler3D-vec4-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3288` |
| `textureProjGrad(usampler3D,vec4,vec3,vec3)` | transpiled (`texture-function-textureProjGrad-usampler3D-vec4-vec3-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3289` |
| `textureGather(sampler2D,vec2)` | transpiled (`texture-function-textureGather-sampler2D-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3293` |
| `textureGather(isampler2D,vec2)` | transpiled (`texture-function-textureGather-isampler2D-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3294` |
| `textureGather(usampler2D,vec2)` | transpiled (`texture-function-textureGather-usampler2D-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3295` |
| `textureGather(sampler2D,vec2,int)` | transpiled (`texture-function-textureGather-sampler2D-vec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3296` |
| `textureGather(isampler2D,vec2,int)` | transpiled (`texture-function-textureGather-isampler2D-vec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3297` |
| `textureGather(usampler2D,vec2,int)` | transpiled (`texture-function-textureGather-usampler2D-vec2-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3298` |
| `textureGather(sampler2DArray,vec3)` | transpiled (`texture-function-textureGather-sampler2DArray-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3299` |
| `textureGather(isampler2DArray,vec3)` | transpiled (`texture-function-textureGather-isampler2DArray-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3300` |
| `textureGather(usampler2DArray,vec3)` | transpiled (`texture-function-textureGather-usampler2DArray-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3301` |
| `textureGather(sampler2DArray,vec3,int)` | transpiled (`texture-function-textureGather-sampler2DArray-vec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3302` |
| `textureGather(isampler2DArray,vec3,int)` | transpiled (`texture-function-textureGather-isampler2DArray-vec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3303` |
| `textureGather(usampler2DArray,vec3,int)` | transpiled (`texture-function-textureGather-usampler2DArray-vec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3304` |
| `textureGather(samplerCube,vec3)` | transpiled (`texture-function-textureGather-samplerCube-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3305` |
| `textureGather(samplerCube,vec3,int)` | transpiled (`texture-function-textureGather-samplerCube-vec3-int`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3306` |
| `dFdx(float)` | transpiled (`call-dFdx-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3336` |
| `dFdx(vec2)` | transpiled (`call-dFdx-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3337` |
| `dFdx(vec3)` | transpiled (`call-dFdx-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3338` |
| `dFdx(vec4)` | transpiled (`call-dFdx-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3339` |
| `dFdy(float)` | transpiled (`call-dFdy-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3357` |
| `dFdy(vec2)` | transpiled (`call-dFdy-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3358` |
| `dFdy(vec3)` | transpiled (`call-dFdy-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3359` |
| `dFdy(vec4)` | transpiled (`call-dFdy-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3360` |
| `fwidth(float)` | transpiled (`call-fwidth-float`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3378` |
| `fwidth(vec2)` | transpiled (`call-fwidth-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3379` |
| `fwidth(vec3)` | transpiled (`call-fwidth-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3380` |
| `fwidth(vec4)` | transpiled (`call-fwidth-vec4`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3381` |
| `length[array]()` | transpiled (`statement-array-length`, `statement-array-length-before-operator`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3400` |
| `packHalf2x16(vec2)` | transpiled (`call-packHalf2x16-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3412` |
| `packUnorm2x16(vec2)` | transpiled (`call-packUnorm2x16-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3413` |
| `packSnorm2x16(vec2)` | transpiled (`call-packSnorm2x16-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3414` |
| `packUnorm4x8(vec4)` | transpiled (`call-packUnorm4x8-vec4`) | lowered: three's tsl_packUnorm4x8 | untested (#1788) | `servers/rendering/shader_language.cpp:3415` |
| `packSnorm4x8(vec4)` | transpiled (`call-packSnorm4x8-vec4`) | lowered: three's tsl_packSnorm4x8 | untested (#1788) | `servers/rendering/shader_language.cpp:3416` |
| `unpackHalf2x16(uint)` | transpiled (`call-unpackHalf2x16-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3418` |
| `unpackUnorm2x16(uint)` | transpiled (`call-unpackUnorm2x16-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3419` |
| `unpackSnorm2x16(uint)` | transpiled (`call-unpackSnorm2x16-uint`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3420` |
| `unpackUnorm4x8(uint)` | transpiled (`call-unpackUnorm4x8-uint`) | lowered: three's tsl_unpackUnorm4x8 | untested (#1788) | `servers/rendering/shader_language.cpp:3421` |
| `unpackSnorm4x8(uint)` | transpiled (`call-unpackSnorm4x8-uint`) | lowered: three's tsl_unpackSnorm4x8 | untested (#1788) | `servers/rendering/shader_language.cpp:3422` |

## function (high_end)

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `textureQueryLod(sampler2D,vec2)` | transpiled (`texture-function-textureQueryLod-sampler2D-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3310` |
| `textureQueryLod(isampler2D,vec2)` | transpiled (`texture-function-textureQueryLod-isampler2D-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3311` |
| `textureQueryLod(usampler2D,vec2)` | transpiled (`texture-function-textureQueryLod-usampler2D-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3312` |
| `textureQueryLod(sampler2DArray,vec2)` | transpiled (`texture-function-textureQueryLod-sampler2DArray-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3313` |
| `textureQueryLod(isampler2DArray,vec2)` | transpiled (`texture-function-textureQueryLod-isampler2DArray-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3314` |
| `textureQueryLod(usampler2DArray,vec2)` | transpiled (`texture-function-textureQueryLod-usampler2DArray-vec2`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3315` |
| `textureQueryLod(sampler3D,vec3)` | transpiled (`texture-function-textureQueryLod-sampler3D-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3316` |
| `textureQueryLod(isampler3D,vec3)` | transpiled (`texture-function-textureQueryLod-isampler3D-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3317` |
| `textureQueryLod(usampler3D,vec3)` | transpiled (`texture-function-textureQueryLod-usampler3D-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3318` |
| `textureQueryLod(samplerCube,vec3)` | transpiled (`texture-function-textureQueryLod-samplerCube-vec3`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3319` |
| `textureQueryLevels(sampler2D)` | transpiled (`texture-function-textureQueryLevels-sampler2D`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3323` |
| `textureQueryLevels(isampler2D)` | transpiled (`texture-function-textureQueryLevels-isampler2D`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3324` |
| `textureQueryLevels(usampler2D)` | transpiled (`texture-function-textureQueryLevels-usampler2D`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3325` |
| `textureQueryLevels(sampler2DArray)` | transpiled (`texture-function-textureQueryLevels-sampler2DArray`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3326` |
| `textureQueryLevels(isampler2DArray)` | transpiled (`texture-function-textureQueryLevels-isampler2DArray`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3327` |
| `textureQueryLevels(usampler2DArray)` | transpiled (`texture-function-textureQueryLevels-usampler2DArray`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3328` |
| `textureQueryLevels(sampler3D)` | transpiled (`texture-function-textureQueryLevels-sampler3D`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3329` |
| `textureQueryLevels(isampler3D)` | transpiled (`texture-function-textureQueryLevels-isampler3D`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3330` |
| `textureQueryLevels(usampler3D)` | transpiled (`texture-function-textureQueryLevels-usampler3D`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3331` |
| `textureQueryLevels(samplerCube)` | transpiled (`texture-function-textureQueryLevels-samplerCube`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:3332` |
| `dFdxCoarse(float)` | transpiled (`call-dFdxCoarse-float`) | lowered: nearest form dFdx, coarse not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3343` |
| `dFdxCoarse(vec2)` | transpiled (`call-dFdxCoarse-vec2`) | lowered: nearest form dFdx, coarse not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3344` |
| `dFdxCoarse(vec3)` | transpiled (`call-dFdxCoarse-vec3`) | lowered: nearest form dFdx, coarse not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3345` |
| `dFdxCoarse(vec4)` | transpiled (`call-dFdxCoarse-vec4`) | lowered: nearest form dFdx, coarse not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3346` |
| `dFdxFine(float)` | transpiled (`call-dFdxFine-float`) | lowered: nearest form dFdx, fine not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3350` |
| `dFdxFine(vec2)` | transpiled (`call-dFdxFine-vec2`) | lowered: nearest form dFdx, fine not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3351` |
| `dFdxFine(vec3)` | transpiled (`call-dFdxFine-vec3`) | lowered: nearest form dFdx, fine not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3352` |
| `dFdxFine(vec4)` | transpiled (`call-dFdxFine-vec4`) | lowered: nearest form dFdx, fine not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3353` |
| `dFdyCoarse(float)` | transpiled (`call-dFdyCoarse-float`) | lowered: nearest form dFdy, coarse not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3364` |
| `dFdyCoarse(vec2)` | transpiled (`call-dFdyCoarse-vec2`) | lowered: nearest form dFdy, coarse not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3365` |
| `dFdyCoarse(vec3)` | transpiled (`call-dFdyCoarse-vec3`) | lowered: nearest form dFdy, coarse not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3366` |
| `dFdyCoarse(vec4)` | transpiled (`call-dFdyCoarse-vec4`) | lowered: nearest form dFdy, coarse not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3367` |
| `dFdyFine(float)` | transpiled (`call-dFdyFine-float`) | lowered: nearest form dFdy, fine not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3371` |
| `dFdyFine(vec2)` | transpiled (`call-dFdyFine-vec2`) | lowered: nearest form dFdy, fine not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3372` |
| `dFdyFine(vec3)` | transpiled (`call-dFdyFine-vec3`) | lowered: nearest form dFdy, fine not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3373` |
| `dFdyFine(vec4)` | transpiled (`call-dFdyFine-vec4`) | lowered: nearest form dFdy, fine not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3374` |
| `fwidthCoarse(float)` | transpiled (`call-fwidthCoarse-float`) | lowered: nearest form fwidth, coarse not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3385` |
| `fwidthCoarse(vec2)` | transpiled (`call-fwidthCoarse-vec2`) | lowered: nearest form fwidth, coarse not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3386` |
| `fwidthCoarse(vec3)` | transpiled (`call-fwidthCoarse-vec3`) | lowered: nearest form fwidth, coarse not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3387` |
| `fwidthCoarse(vec4)` | transpiled (`call-fwidthCoarse-vec4`) | lowered: nearest form fwidth, coarse not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3388` |
| `fwidthFine(float)` | transpiled (`call-fwidthFine-float`) | lowered: nearest form fwidth, fine not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3392` |
| `fwidthFine(vec2)` | transpiled (`call-fwidthFine-vec2`) | lowered: nearest form fwidth, fine not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3393` |
| `fwidthFine(vec3)` | transpiled (`call-fwidthFine-vec3`) | lowered: nearest form fwidth, fine not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3394` |
| `fwidthFine(vec4)` | transpiled (`call-fwidthFine-vec4`) | lowered: nearest form fwidth, fine not shown on the test driver | untested (#1788) | `servers/rendering/shader_language.cpp:3395` |
| `fma(float,float,float)` | transpiled (`call-fma-float-float-float`) | lowered: nearest form a * b + c, which a driver may fuse | untested (#1788) | `servers/rendering/shader_language.cpp:3405` |
| `fma(vec2,vec2,vec2)` | transpiled (`call-fma-vec2-vec2-vec2`) | lowered: nearest form a * b + c, which a driver may fuse | untested (#1788) | `servers/rendering/shader_language.cpp:3406` |
| `fma(vec3,vec3,vec3)` | transpiled (`call-fma-vec3-vec3-vec3`) | lowered: nearest form a * b + c, which a driver may fuse | untested (#1788) | `servers/rendering/shader_language.cpp:3407` |
| `fma(vec4,vec4,vec4)` | transpiled (`call-fma-vec4-vec4-vec4`) | lowered: nearest form a * b + c, which a driver may fuse | untested (#1788) | `servers/rendering/shader_language.cpp:3408` |
| `bitfieldExtract(int,int,int)` | transpiled (`call-bitfieldExtract-int-int-int`, `call-bitfieldExtract-int-int-int-whole-word`, `call-bitfieldExtract-int-int-int-top-bit`, `call-bitfieldExtract-int-int-int-empty-at-the-top`, `call-bitfieldExtract-of-a-negative-constant`) | lowered: shifts to the top and back | untested (#1788) | `servers/rendering/shader_language.cpp:3426` |
| `bitfieldExtract(ivec2,int,int)` | transpiled (`call-bitfieldExtract-ivec2-int-int`, `call-bitfieldExtract-ivec2-int-int-whole-word`, `call-bitfieldExtract-ivec2-int-int-top-bit`, `call-bitfieldExtract-ivec2-int-int-empty-at-the-top`) | lowered: shifts to the top and back | untested (#1788) | `servers/rendering/shader_language.cpp:3427` |
| `bitfieldExtract(ivec3,int,int)` | transpiled (`call-bitfieldExtract-ivec3-int-int`, `call-bitfieldExtract-ivec3-int-int-whole-word`, `call-bitfieldExtract-ivec3-int-int-top-bit`, `call-bitfieldExtract-ivec3-int-int-empty-at-the-top`) | lowered: shifts to the top and back | untested (#1788) | `servers/rendering/shader_language.cpp:3428` |
| `bitfieldExtract(ivec4,int,int)` | transpiled (`call-bitfieldExtract-ivec4-int-int`, `call-bitfieldExtract-ivec4-int-int-whole-word`, `call-bitfieldExtract-ivec4-int-int-top-bit`, `call-bitfieldExtract-ivec4-int-int-empty-at-the-top`) | lowered: shifts to the top and back | untested (#1788) | `servers/rendering/shader_language.cpp:3429` |
| `bitfieldExtract(uint,int,int)` | transpiled (`call-bitfieldExtract-uint-int-int`, `call-bitfieldExtract-uint-int-int-whole-word`, `call-bitfieldExtract-uint-int-int-top-bit`, `call-bitfieldExtract-uint-int-int-empty-at-the-top`) | lowered: shifts to the top and back | untested (#1788) | `servers/rendering/shader_language.cpp:3431` |
| `bitfieldExtract(uvec2,int,int)` | transpiled (`call-bitfieldExtract-uvec2-int-int`, `call-bitfieldExtract-uvec2-int-int-whole-word`, `call-bitfieldExtract-uvec2-int-int-top-bit`, `call-bitfieldExtract-uvec2-int-int-empty-at-the-top`) | lowered: shifts to the top and back | untested (#1788) | `servers/rendering/shader_language.cpp:3432` |
| `bitfieldExtract(uvec3,int,int)` | transpiled (`call-bitfieldExtract-uvec3-int-int`, `call-bitfieldExtract-uvec3-int-int-whole-word`, `call-bitfieldExtract-uvec3-int-int-top-bit`, `call-bitfieldExtract-uvec3-int-int-empty-at-the-top`) | lowered: shifts to the top and back | untested (#1788) | `servers/rendering/shader_language.cpp:3433` |
| `bitfieldExtract(uvec4,int,int)` | transpiled (`call-bitfieldExtract-uvec4-int-int`, `call-bitfieldExtract-uvec4-int-int-whole-word`, `call-bitfieldExtract-uvec4-int-int-top-bit`, `call-bitfieldExtract-uvec4-int-int-empty-at-the-top`) | lowered: shifts to the top and back | untested (#1788) | `servers/rendering/shader_language.cpp:3434` |
| `bitfieldInsert(int,int,int,int)` | transpiled (`call-bitfieldInsert-int-int-int-int`, `call-bitfieldInsert-int-int-int-int-whole-word`, `call-bitfieldInsert-int-int-int-int-top-bit`, `call-bitfieldInsert-int-int-int-int-empty-at-the-top`, `call-bitfieldInsert-of-a-negative-constant`) | lowered: shifted mask | untested (#1788) | `servers/rendering/shader_language.cpp:3438` |
| `bitfieldInsert(ivec2,ivec2,int,int)` | transpiled (`call-bitfieldInsert-ivec2-ivec2-int-int`, `call-bitfieldInsert-ivec2-ivec2-int-int-whole-word`, `call-bitfieldInsert-ivec2-ivec2-int-int-top-bit`, `call-bitfieldInsert-ivec2-ivec2-int-int-empty-at-the-top`) | lowered: shifted mask | untested (#1788) | `servers/rendering/shader_language.cpp:3439` |
| `bitfieldInsert(ivec3,ivec3,int,int)` | transpiled (`call-bitfieldInsert-ivec3-ivec3-int-int`, `call-bitfieldInsert-ivec3-ivec3-int-int-whole-word`, `call-bitfieldInsert-ivec3-ivec3-int-int-top-bit`, `call-bitfieldInsert-ivec3-ivec3-int-int-empty-at-the-top`) | lowered: shifted mask | untested (#1788) | `servers/rendering/shader_language.cpp:3440` |
| `bitfieldInsert(ivec4,ivec4,int,int)` | transpiled (`call-bitfieldInsert-ivec4-ivec4-int-int`, `call-bitfieldInsert-ivec4-ivec4-int-int-whole-word`, `call-bitfieldInsert-ivec4-ivec4-int-int-top-bit`, `call-bitfieldInsert-ivec4-ivec4-int-int-empty-at-the-top`) | lowered: shifted mask | untested (#1788) | `servers/rendering/shader_language.cpp:3441` |
| `bitfieldInsert(uint,uint,int,int)` | transpiled (`call-bitfieldInsert-uint-uint-int-int`, `call-bitfieldInsert-uint-uint-int-int-whole-word`, `call-bitfieldInsert-uint-uint-int-int-top-bit`, `call-bitfieldInsert-uint-uint-int-int-empty-at-the-top`) | lowered: shifted mask | untested (#1788) | `servers/rendering/shader_language.cpp:3443` |
| `bitfieldInsert(uvec2,uvec2,int,int)` | transpiled (`call-bitfieldInsert-uvec2-uvec2-int-int`, `call-bitfieldInsert-uvec2-uvec2-int-int-whole-word`, `call-bitfieldInsert-uvec2-uvec2-int-int-top-bit`, `call-bitfieldInsert-uvec2-uvec2-int-int-empty-at-the-top`) | lowered: shifted mask | untested (#1788) | `servers/rendering/shader_language.cpp:3444` |
| `bitfieldInsert(uvec3,uvec3,int,int)` | transpiled (`call-bitfieldInsert-uvec3-uvec3-int-int`, `call-bitfieldInsert-uvec3-uvec3-int-int-whole-word`, `call-bitfieldInsert-uvec3-uvec3-int-int-top-bit`, `call-bitfieldInsert-uvec3-uvec3-int-int-empty-at-the-top`) | lowered: shifted mask | untested (#1788) | `servers/rendering/shader_language.cpp:3445` |
| `bitfieldInsert(uvec4,uvec4,int,int)` | transpiled (`call-bitfieldInsert-uvec4-uvec4-int-int`, `call-bitfieldInsert-uvec4-uvec4-int-int-whole-word`, `call-bitfieldInsert-uvec4-uvec4-int-int-top-bit`, `call-bitfieldInsert-uvec4-uvec4-int-int-empty-at-the-top`) | lowered: shifted mask | untested (#1788) | `servers/rendering/shader_language.cpp:3446` |
| `bitfieldReverse(int)` | transpiled (`call-bitfieldReverse-int`, `call-bitfieldReverse-of-a-negative-constant`) | lowered: swaps of bits, pairs, nibbles, bytes and halves | untested (#1788) | `servers/rendering/shader_language.cpp:3450` |
| `bitfieldReverse(ivec2)` | transpiled (`call-bitfieldReverse-ivec2`) | lowered: swaps of bits, pairs, nibbles, bytes and halves | untested (#1788) | `servers/rendering/shader_language.cpp:3451` |
| `bitfieldReverse(ivec3)` | transpiled (`call-bitfieldReverse-ivec3`) | lowered: swaps of bits, pairs, nibbles, bytes and halves | untested (#1788) | `servers/rendering/shader_language.cpp:3452` |
| `bitfieldReverse(ivec4)` | transpiled (`call-bitfieldReverse-ivec4`) | lowered: swaps of bits, pairs, nibbles, bytes and halves | untested (#1788) | `servers/rendering/shader_language.cpp:3453` |
| `bitfieldReverse(uint)` | transpiled (`call-bitfieldReverse-uint`) | lowered: swaps of bits, pairs, nibbles, bytes and halves | untested (#1788) | `servers/rendering/shader_language.cpp:3455` |
| `bitfieldReverse(uvec2)` | transpiled (`call-bitfieldReverse-uvec2`) | lowered: swaps of bits, pairs, nibbles, bytes and halves | untested (#1788) | `servers/rendering/shader_language.cpp:3456` |
| `bitfieldReverse(uvec3)` | transpiled (`call-bitfieldReverse-uvec3`) | lowered: swaps of bits, pairs, nibbles, bytes and halves | untested (#1788) | `servers/rendering/shader_language.cpp:3457` |
| `bitfieldReverse(uvec4)` | transpiled (`call-bitfieldReverse-uvec4`) | lowered: swaps of bits, pairs, nibbles, bytes and halves | untested (#1788) | `servers/rendering/shader_language.cpp:3458` |
| `bitCount(int)` | transpiled (`call-bitCount-int`, `call-bitCount-of-a-negative-constant`) | lowered: sums of bit pairs, nibbles and bytes | untested (#1788) | `servers/rendering/shader_language.cpp:3462` |
| `bitCount(ivec2)` | transpiled (`call-bitCount-ivec2`) | lowered: sums of bit pairs, nibbles and bytes | untested (#1788) | `servers/rendering/shader_language.cpp:3463` |
| `bitCount(ivec3)` | transpiled (`call-bitCount-ivec3`) | lowered: sums of bit pairs, nibbles and bytes | untested (#1788) | `servers/rendering/shader_language.cpp:3464` |
| `bitCount(ivec4)` | transpiled (`call-bitCount-ivec4`) | lowered: sums of bit pairs, nibbles and bytes | untested (#1788) | `servers/rendering/shader_language.cpp:3465` |
| `bitCount(uint)` | transpiled (`call-bitCount-uint`) | lowered: sums of bit pairs, nibbles and bytes | untested (#1788) | `servers/rendering/shader_language.cpp:3467` |
| `bitCount(uvec2)` | transpiled (`call-bitCount-uvec2`) | lowered: sums of bit pairs, nibbles and bytes | untested (#1788) | `servers/rendering/shader_language.cpp:3468` |
| `bitCount(uvec3)` | transpiled (`call-bitCount-uvec3`) | lowered: sums of bit pairs, nibbles and bytes | untested (#1788) | `servers/rendering/shader_language.cpp:3469` |
| `bitCount(uvec4)` | transpiled (`call-bitCount-uvec4`) | lowered: sums of bit pairs, nibbles and bytes | untested (#1788) | `servers/rendering/shader_language.cpp:3470` |
| `findLSB(int)` | transpiled (`call-findLSB-int`, `call-findLSB-of-a-negative-constant`) | lowered: bit count below the lowest set bit | untested (#1788) | `servers/rendering/shader_language.cpp:3474` |
| `findLSB(ivec2)` | transpiled (`call-findLSB-ivec2`) | lowered: bit count below the lowest set bit | untested (#1788) | `servers/rendering/shader_language.cpp:3475` |
| `findLSB(ivec3)` | transpiled (`call-findLSB-ivec3`) | lowered: bit count below the lowest set bit | untested (#1788) | `servers/rendering/shader_language.cpp:3476` |
| `findLSB(ivec4)` | transpiled (`call-findLSB-ivec4`) | lowered: bit count below the lowest set bit | untested (#1788) | `servers/rendering/shader_language.cpp:3477` |
| `findLSB(uint)` | transpiled (`call-findLSB-uint`) | lowered: bit count below the lowest set bit | untested (#1788) | `servers/rendering/shader_language.cpp:3479` |
| `findLSB(uvec2)` | transpiled (`call-findLSB-uvec2`) | lowered: bit count below the lowest set bit | untested (#1788) | `servers/rendering/shader_language.cpp:3480` |
| `findLSB(uvec3)` | transpiled (`call-findLSB-uvec3`) | lowered: bit count below the lowest set bit | untested (#1788) | `servers/rendering/shader_language.cpp:3481` |
| `findLSB(uvec4)` | transpiled (`call-findLSB-uvec4`) | lowered: bit count below the lowest set bit | untested (#1788) | `servers/rendering/shader_language.cpp:3482` |
| `findMSB(int)` | transpiled (`call-findMSB-int`, `call-findMSB-of-a-negative-constant`) | lowered: bit count of the bits filled below the top | untested (#1788) | `servers/rendering/shader_language.cpp:3486` |
| `findMSB(ivec2)` | transpiled (`call-findMSB-ivec2`) | lowered: bit count of the bits filled below the top | untested (#1788) | `servers/rendering/shader_language.cpp:3487` |
| `findMSB(ivec3)` | transpiled (`call-findMSB-ivec3`) | lowered: bit count of the bits filled below the top | untested (#1788) | `servers/rendering/shader_language.cpp:3488` |
| `findMSB(ivec4)` | transpiled (`call-findMSB-ivec4`) | lowered: bit count of the bits filled below the top | untested (#1788) | `servers/rendering/shader_language.cpp:3489` |
| `findMSB(uint)` | transpiled (`call-findMSB-uint`) | lowered: bit count of the bits filled below the top | untested (#1788) | `servers/rendering/shader_language.cpp:3491` |
| `findMSB(uvec2)` | transpiled (`call-findMSB-uvec2`) | lowered: bit count of the bits filled below the top | untested (#1788) | `servers/rendering/shader_language.cpp:3492` |
| `findMSB(uvec3)` | transpiled (`call-findMSB-uvec3`) | lowered: bit count of the bits filled below the top | untested (#1788) | `servers/rendering/shader_language.cpp:3493` |
| `findMSB(uvec4)` | transpiled (`call-findMSB-uvec4`) | lowered: bit count of the bits filled below the top | untested (#1788) | `servers/rendering/shader_language.cpp:3494` |
| `umulExtended(uint,uint,uint,uint)` | transpiled (`call-umulExtended-uint-uint-uint-uint-msb`, `call-umulExtended-uint-uint-uint-uint-lsb`) | lowered: products of 16-bit halves | untested (#1788) | `servers/rendering/shader_language.cpp:3498` |
| `umulExtended(uvec2,uvec2,uvec2,uvec2)` | transpiled (`call-umulExtended-uvec2-uvec2-uvec2-uvec2-msb`, `call-umulExtended-uvec2-uvec2-uvec2-uvec2-lsb`) | lowered: products of 16-bit halves | untested (#1788) | `servers/rendering/shader_language.cpp:3499` |
| `umulExtended(uvec3,uvec3,uvec3,uvec3)` | transpiled (`call-umulExtended-uvec3-uvec3-uvec3-uvec3-msb`, `call-umulExtended-uvec3-uvec3-uvec3-uvec3-lsb`) | lowered: products of 16-bit halves | untested (#1788) | `servers/rendering/shader_language.cpp:3500` |
| `umulExtended(uvec4,uvec4,uvec4,uvec4)` | transpiled (`call-umulExtended-uvec4-uvec4-uvec4-uvec4-msb`, `call-umulExtended-uvec4-uvec4-uvec4-uvec4-lsb`) | lowered: products of 16-bit halves | untested (#1788) | `servers/rendering/shader_language.cpp:3501` |
| `imulExtended(int,int,int,int)` | transpiled (`call-imulExtended-int-int-int-int-msb`, `call-imulExtended-int-int-int-int-lsb`) | lowered: products of 16-bit halves, less each negative operand | untested (#1788) | `servers/rendering/shader_language.cpp:3505` |
| `imulExtended(ivec2,ivec2,ivec2,ivec2)` | transpiled (`call-imulExtended-ivec2-ivec2-ivec2-ivec2-msb`, `call-imulExtended-ivec2-ivec2-ivec2-ivec2-lsb`) | lowered: products of 16-bit halves, less each negative operand | untested (#1788) | `servers/rendering/shader_language.cpp:3506` |
| `imulExtended(ivec3,ivec3,ivec3,ivec3)` | transpiled (`call-imulExtended-ivec3-ivec3-ivec3-ivec3-msb`, `call-imulExtended-ivec3-ivec3-ivec3-ivec3-lsb`) | lowered: products of 16-bit halves, less each negative operand | untested (#1788) | `servers/rendering/shader_language.cpp:3507` |
| `imulExtended(ivec4,ivec4,ivec4,ivec4)` | transpiled (`call-imulExtended-ivec4-ivec4-ivec4-ivec4-msb`, `call-imulExtended-ivec4-ivec4-ivec4-ivec4-lsb`) | lowered: products of 16-bit halves, less each negative operand | untested (#1788) | `servers/rendering/shader_language.cpp:3508` |
| `uaddCarry(uint,uint,uint)` | transpiled (`call-uaddCarry-uint-uint-uint-result`, `call-uaddCarry-uint-uint-uint-written`) | lowered: wrapped sum and comparison | untested (#1788) | `servers/rendering/shader_language.cpp:3512` |
| `uaddCarry(uvec2,uvec2,uvec2)` | transpiled (`call-uaddCarry-uvec2-uvec2-uvec2-result`, `call-uaddCarry-uvec2-uvec2-uvec2-written`) | lowered: wrapped sum and comparison | untested (#1788) | `servers/rendering/shader_language.cpp:3513` |
| `uaddCarry(uvec3,uvec3,uvec3)` | transpiled (`call-uaddCarry-uvec3-uvec3-uvec3-result`, `call-uaddCarry-uvec3-uvec3-uvec3-written`) | lowered: wrapped sum and comparison | untested (#1788) | `servers/rendering/shader_language.cpp:3514` |
| `uaddCarry(uvec4,uvec4,uvec4)` | transpiled (`call-uaddCarry-uvec4-uvec4-uvec4-result`, `call-uaddCarry-uvec4-uvec4-uvec4-written`) | lowered: wrapped sum and comparison | untested (#1788) | `servers/rendering/shader_language.cpp:3515` |
| `usubBorrow(uint,uint,uint)` | transpiled (`call-usubBorrow-uint-uint-uint-result`, `call-usubBorrow-uint-uint-uint-written`) | lowered: wrapped difference and comparison | untested (#1788) | `servers/rendering/shader_language.cpp:3519` |
| `usubBorrow(uvec2,uvec2,uvec2)` | transpiled (`call-usubBorrow-uvec2-uvec2-uvec2-result`, `call-usubBorrow-uvec2-uvec2-uvec2-written`) | lowered: wrapped difference and comparison | untested (#1788) | `servers/rendering/shader_language.cpp:3520` |
| `usubBorrow(uvec3,uvec3,uvec3)` | transpiled (`call-usubBorrow-uvec3-uvec3-uvec3-result`, `call-usubBorrow-uvec3-uvec3-uvec3-written`) | lowered: wrapped difference and comparison | untested (#1788) | `servers/rendering/shader_language.cpp:3521` |
| `usubBorrow(uvec4,uvec4,uvec4)` | transpiled (`call-usubBorrow-uvec4-uvec4-uvec4-result`, `call-usubBorrow-uvec4-uvec4-uvec4-written`) | lowered: wrapped difference and comparison | untested (#1788) | `servers/rendering/shader_language.cpp:3522` |
| `ldexp(float,int)` | transpiled (`call-ldexp-float-int`, `call-ldexp-float-int-range`, `call-ldexp-of-a-constant-exponent`) | lowered: three products by powers of two | untested (#1788) | `servers/rendering/shader_language.cpp:3526` |
| `ldexp(vec2,ivec2)` | transpiled (`call-ldexp-vec2-ivec2`) | lowered: three products by powers of two | untested (#1788) | `servers/rendering/shader_language.cpp:3527` |
| `ldexp(vec3,ivec3)` | transpiled (`call-ldexp-vec3-ivec3`) | lowered: three products by powers of two | untested (#1788) | `servers/rendering/shader_language.cpp:3528` |
| `ldexp(vec4,ivec4)` | transpiled (`call-ldexp-vec4-ivec4`) | lowered: three products by powers of two | untested (#1788) | `servers/rendering/shader_language.cpp:3529` |
| `frexp(float,int)` | transpiled (`call-frexp-float-int-fraction`, `call-frexp-float-int-exponent`, `call-frexp-to-a-value`) | lowered: exponent and fraction bits | untested (#1788) | `servers/rendering/shader_language.cpp:3533` |
| `frexp(vec2,ivec2)` | transpiled (`call-frexp-vec2-ivec2-fraction`, `call-frexp-vec2-ivec2-exponent`) | lowered: exponent and fraction bits | untested (#1788) | `servers/rendering/shader_language.cpp:3534` |
| `frexp(vec3,ivec3)` | transpiled (`call-frexp-vec3-ivec3-fraction`, `call-frexp-vec3-ivec3-exponent`) | lowered: exponent and fraction bits | untested (#1788) | `servers/rendering/shader_language.cpp:3535` |
| `frexp(vec4,ivec4)` | transpiled (`call-frexp-vec4-ivec4-fraction`, `call-frexp-vec4-ivec4-exponent`) | lowered: exponent and fraction bits | untested (#1788) | `servers/rendering/shader_language.cpp:3536` |

## swizzle

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `bvec2.xy` | transpiled (`swizzle-bvec2-xy`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6877` |
| `bvec2.rg` | transpiled (`swizzle-bvec2-rg`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6877` |
| `bvec2.st` | transpiled (`swizzle-bvec2-st`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6877` |
| `ivec2.xy` | transpiled (`swizzle-ivec2-xy`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6877` |
| `ivec2.rg` | transpiled (`swizzle-ivec2-rg`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6877` |
| `ivec2.st` | transpiled (`swizzle-ivec2-st`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6877` |
| `uvec2.xy` | transpiled (`swizzle-uvec2-xy`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6877` |
| `uvec2.rg` | transpiled (`swizzle-uvec2-rg`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6877` |
| `uvec2.st` | transpiled (`swizzle-uvec2-st`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6877` |
| `vec2.xy` | transpiled (`swizzle-vec2-xy`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6877` |
| `vec2.rg` | transpiled (`swizzle-vec2-rg`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6877` |
| `vec2.st` | transpiled (`swizzle-vec2-st`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6877` |
| `bvec3.xyz` | transpiled (`swizzle-bvec3-xyz`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6941` |
| `bvec3.rgb` | transpiled (`swizzle-bvec3-rgb`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6941` |
| `bvec3.stp` | transpiled (`swizzle-bvec3-stp`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6941` |
| `ivec3.xyz` | transpiled (`swizzle-ivec3-xyz`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6941` |
| `ivec3.rgb` | transpiled (`swizzle-ivec3-rgb`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6941` |
| `ivec3.stp` | transpiled (`swizzle-ivec3-stp`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6941` |
| `uvec3.xyz` | transpiled (`swizzle-uvec3-xyz`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6941` |
| `uvec3.rgb` | transpiled (`swizzle-uvec3-rgb`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6941` |
| `uvec3.stp` | transpiled (`swizzle-uvec3-stp`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6941` |
| `vec3.xyz` | transpiled (`swizzle-vec3-xyz`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6941` |
| `vec3.rgb` | transpiled (`swizzle-vec3-rgb`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6941` |
| `vec3.stp` | transpiled (`swizzle-vec3-stp`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:6941` |
| `bvec4.xyzw` | transpiled (`swizzle-bvec4-xyzw`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:7008` |
| `bvec4.rgba` | transpiled (`swizzle-bvec4-rgba`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:7008` |
| `bvec4.stpq` | transpiled (`swizzle-bvec4-stpq`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:7008` |
| `ivec4.xyzw` | transpiled (`swizzle-ivec4-xyzw`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:7008` |
| `ivec4.rgba` | transpiled (`swizzle-ivec4-rgba`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:7008` |
| `ivec4.stpq` | transpiled (`swizzle-ivec4-stpq`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:7008` |
| `uvec4.xyzw` | transpiled (`swizzle-uvec4-xyzw`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:7008` |
| `uvec4.rgba` | transpiled (`swizzle-uvec4-rgba`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:7008` |
| `uvec4.stpq` | transpiled (`swizzle-uvec4-stpq`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:7008` |
| `vec4.xyzw` | transpiled (`swizzle-vec4-xyzw`, `assign-swizzle`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:7008` |
| `vec4.rgba` | transpiled (`swizzle-vec4-rgba`, `assign-swizzle-rgba`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:7008` |
| `vec4.stpq` | transpiled (`swizzle-vec4-stpq`) | native | untested (#1788) | `servers/rendering/shader_language.cpp:7008` |

## built-in (read only)

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `spatial.global.TIME` | open, #1831 | | | `servers/rendering/shader_types.cpp:79` |
| `spatial.global.EXPOSURE` | open, #1831 | | | `servers/rendering/shader_types.cpp:80` |
| `spatial.global.IN_SHADOW_PASS` | open, #1831 | | | `servers/rendering/shader_types.cpp:81` |
| `spatial.constants.PI` | open, #1831 | | | `servers/rendering/shader_types.cpp:82` |
| `spatial.constants.TAU` | open, #1831 | | | `servers/rendering/shader_types.cpp:83` |
| `spatial.constants.E` | open, #1831 | | | `servers/rendering/shader_types.cpp:84` |
| `spatial.constants.OUTPUT_IS_SRGB` | open, #1831 | | | `servers/rendering/shader_types.cpp:85` |
| `spatial.constants.CLIP_SPACE_FAR` | open, #1831 | | | `servers/rendering/shader_types.cpp:86` |
| `spatial.constants.IS_MULTIVIEW` | open, #1831 | | | `servers/rendering/shader_types.cpp:87` |
| `spatial.vertex.INSTANCE_ID` | open, #1831 | | | `servers/rendering/shader_types.cpp:99` |
| `spatial.vertex.INSTANCE_CUSTOM` | open, #1831 | | | `servers/rendering/shader_types.cpp:100` |
| `spatial.vertex.VERTEX_ID` | open, #1831 | | | `servers/rendering/shader_types.cpp:101` |
| `spatial.vertex.BONE_INDICES` | open, #1831 | | | `servers/rendering/shader_types.cpp:103` |
| `spatial.vertex.BONE_WEIGHTS` | open, #1831 | | | `servers/rendering/shader_types.cpp:104` |
| `spatial.vertex.CUSTOM0` | open, #1831 | | | `servers/rendering/shader_types.cpp:105` |
| `spatial.vertex.CUSTOM1` | open, #1831 | | | `servers/rendering/shader_types.cpp:106` |
| `spatial.vertex.CUSTOM2` | open, #1831 | | | `servers/rendering/shader_types.cpp:107` |
| `spatial.vertex.CUSTOM3` | open, #1831 | | | `servers/rendering/shader_types.cpp:108` |
| `spatial.vertex.MODEL_MATRIX` | open, #1831 | | | `servers/rendering/shader_types.cpp:113` |
| `spatial.vertex.MODEL_NORMAL_MATRIX` | open, #1831 | | | `servers/rendering/shader_types.cpp:114` |
| `spatial.vertex.VIEW_MATRIX` | open, #1831 | | | `servers/rendering/shader_types.cpp:115` |
| `spatial.vertex.INV_VIEW_MATRIX` | open, #1831 | | | `servers/rendering/shader_types.cpp:116` |
| `spatial.vertex.INV_PROJECTION_MATRIX` | open, #1831 | | | `servers/rendering/shader_types.cpp:118` |
| `spatial.vertex.VIEWPORT_SIZE` | open, #1831 | | | `servers/rendering/shader_types.cpp:121` |
| `spatial.vertex.MAIN_CAM_INV_VIEW_MATRIX` | open, #1831 | | | `servers/rendering/shader_types.cpp:122` |
| `spatial.vertex.NODE_POSITION_WORLD` | open, #1831 | | | `servers/rendering/shader_types.cpp:124` |
| `spatial.vertex.CAMERA_POSITION_WORLD` | open, #1831 | | | `servers/rendering/shader_types.cpp:125` |
| `spatial.vertex.CAMERA_DIRECTION_WORLD` | open, #1831 | | | `servers/rendering/shader_types.cpp:126` |
| `spatial.vertex.CAMERA_VISIBLE_LAYERS` | open, #1831 | | | `servers/rendering/shader_types.cpp:127` |
| `spatial.vertex.NODE_POSITION_VIEW` | open, #1831 | | | `servers/rendering/shader_types.cpp:128` |
| `spatial.vertex.VIEW_INDEX` | open, #1831 | | | `servers/rendering/shader_types.cpp:130` |
| `spatial.vertex.VIEW_MONO_LEFT` | open, #1831 | | | `servers/rendering/shader_types.cpp:131` |
| `spatial.vertex.VIEW_RIGHT` | open, #1831 | | | `servers/rendering/shader_types.cpp:132` |
| `spatial.vertex.EYE_OFFSET` | open, #1831 | | | `servers/rendering/shader_types.cpp:133` |
| `spatial.fragment.VERTEX` | open, #1831 | | | `servers/rendering/shader_types.cpp:135` |
| `spatial.fragment.FRAGCOORD` | open, #1831 | | | `servers/rendering/shader_types.cpp:137` |
| `spatial.fragment.FRONT_FACING` | open, #1831 | | | `servers/rendering/shader_types.cpp:138` |
| `spatial.fragment.VIEW` | open, #1831 | | | `servers/rendering/shader_types.cpp:142` |
| `spatial.fragment.UV` | open, #1831 | | | `servers/rendering/shader_types.cpp:146` |
| `spatial.fragment.UV2` | open, #1831 | | | `servers/rendering/shader_types.cpp:147` |
| `spatial.fragment.COLOR` | open, #1831 | | | `servers/rendering/shader_types.cpp:148` |
| `spatial.fragment.SCREEN_UV` | open, #1831 | | | `servers/rendering/shader_types.cpp:170` |
| `spatial.fragment.POINT_COORD` | open, #1831 | | | `servers/rendering/shader_types.cpp:171` |
| `spatial.fragment.NODE_POSITION_WORLD` | open, #1831 | | | `servers/rendering/shader_types.cpp:173` |
| `spatial.fragment.CAMERA_POSITION_WORLD` | open, #1831 | | | `servers/rendering/shader_types.cpp:174` |
| `spatial.fragment.CAMERA_DIRECTION_WORLD` | open, #1831 | | | `servers/rendering/shader_types.cpp:175` |
| `spatial.fragment.CAMERA_VISIBLE_LAYERS` | open, #1831 | | | `servers/rendering/shader_types.cpp:176` |
| `spatial.fragment.NODE_POSITION_VIEW` | open, #1831 | | | `servers/rendering/shader_types.cpp:177` |
| `spatial.fragment.VIEW_INDEX` | open, #1831 | | | `servers/rendering/shader_types.cpp:179` |
| `spatial.fragment.VIEW_MONO_LEFT` | open, #1831 | | | `servers/rendering/shader_types.cpp:180` |
| `spatial.fragment.VIEW_RIGHT` | open, #1831 | | | `servers/rendering/shader_types.cpp:181` |
| `spatial.fragment.EYE_OFFSET` | open, #1831 | | | `servers/rendering/shader_types.cpp:182` |
| `spatial.fragment.MODEL_MATRIX` | open, #1831 | | | `servers/rendering/shader_types.cpp:184` |
| `spatial.fragment.MODEL_NORMAL_MATRIX` | open, #1831 | | | `servers/rendering/shader_types.cpp:185` |
| `spatial.fragment.VIEW_MATRIX` | open, #1831 | | | `servers/rendering/shader_types.cpp:186` |
| `spatial.fragment.INV_VIEW_MATRIX` | open, #1831 | | | `servers/rendering/shader_types.cpp:187` |
| `spatial.fragment.PROJECTION_MATRIX` | open, #1831 | | | `servers/rendering/shader_types.cpp:188` |
| `spatial.fragment.INV_PROJECTION_MATRIX` | open, #1831 | | | `servers/rendering/shader_types.cpp:189` |
| `spatial.fragment.VIEWPORT_SIZE` | open, #1831 | | | `servers/rendering/shader_types.cpp:190` |
| `spatial.light.MODEL_MATRIX` | open, #1453 | | | `servers/rendering/shader_types.cpp:202` |
| `spatial.light.VIEW_MATRIX` | open, #1453 | | | `servers/rendering/shader_types.cpp:203` |
| `spatial.light.INV_VIEW_MATRIX` | open, #1453 | | | `servers/rendering/shader_types.cpp:204` |
| `spatial.light.PROJECTION_MATRIX` | open, #1453 | | | `servers/rendering/shader_types.cpp:205` |
| `spatial.light.INV_PROJECTION_MATRIX` | open, #1453 | | | `servers/rendering/shader_types.cpp:206` |
| `spatial.light.VIEWPORT_SIZE` | open, #1453 | | | `servers/rendering/shader_types.cpp:207` |
| `spatial.light.FRAGCOORD` | open, #1453 | | | `servers/rendering/shader_types.cpp:209` |
| `spatial.light.NORMAL` | open, #1453 | | | `servers/rendering/shader_types.cpp:210` |
| `spatial.light.UV` | open, #1453 | | | `servers/rendering/shader_types.cpp:211` |
| `spatial.light.UV2` | open, #1453 | | | `servers/rendering/shader_types.cpp:212` |
| `spatial.light.VIEW` | open, #1453 | | | `servers/rendering/shader_types.cpp:213` |
| `spatial.light.SPECULAR_AMOUNT` | open, #1453 | | | `servers/rendering/shader_types.cpp:214` |
| `spatial.light.LIGHT` | open, #1453 | | | `servers/rendering/shader_types.cpp:215` |
| `spatial.light.LIGHT_COLOR` | open, #1453 | | | `servers/rendering/shader_types.cpp:216` |
| `spatial.light.LIGHT_IS_DIRECTIONAL` | open, #1453 | | | `servers/rendering/shader_types.cpp:217` |
| `spatial.light.ATTENUATION` | open, #1453 | | | `servers/rendering/shader_types.cpp:218` |
| `spatial.light.ALBEDO` | open, #1453 | | | `servers/rendering/shader_types.cpp:219` |
| `spatial.light.BACKLIGHT` | open, #1453 | | | `servers/rendering/shader_types.cpp:220` |
| `spatial.light.METALLIC` | open, #1453 | | | `servers/rendering/shader_types.cpp:221` |
| `spatial.light.ROUGHNESS` | open, #1453 | | | `servers/rendering/shader_types.cpp:222` |
| `spatial.light.SCREEN_UV` | open, #1453 | | | `servers/rendering/shader_types.cpp:226` |
| `canvas_item.global.TIME` | open, #686 | | | `servers/rendering/shader_types.cpp:264` |
| `canvas_item.constants.PI` | open, #686 | | | `servers/rendering/shader_types.cpp:265` |
| `canvas_item.constants.TAU` | open, #686 | | | `servers/rendering/shader_types.cpp:266` |
| `canvas_item.constants.E` | open, #686 | | | `servers/rendering/shader_types.cpp:267` |
| `canvas_item.vertex.MODEL_MATRIX` | open, #686 | | | `servers/rendering/shader_types.cpp:274` |
| `canvas_item.vertex.CANVAS_MATRIX` | open, #686 | | | `servers/rendering/shader_types.cpp:275` |
| `canvas_item.vertex.SCREEN_MATRIX` | open, #686 | | | `servers/rendering/shader_types.cpp:276` |
| `canvas_item.vertex.INSTANCE_CUSTOM` | open, #686 | | | `servers/rendering/shader_types.cpp:277` |
| `canvas_item.vertex.INSTANCE_ID` | open, #686 | | | `servers/rendering/shader_types.cpp:278` |
| `canvas_item.vertex.VERTEX_ID` | open, #686 | | | `servers/rendering/shader_types.cpp:279` |
| `canvas_item.vertex.AT_LIGHT_PASS` | open, #686 | | | `servers/rendering/shader_types.cpp:280` |
| `canvas_item.vertex.TEXTURE_PIXEL_SIZE` | open, #686 | | | `servers/rendering/shader_types.cpp:281` |
| `canvas_item.vertex.CUSTOM0` | open, #686 | | | `servers/rendering/shader_types.cpp:282` |
| `canvas_item.vertex.CUSTOM1` | open, #686 | | | `servers/rendering/shader_types.cpp:283` |
| `canvas_item.fragment.FRAGCOORD` | open, #686 | | | `servers/rendering/shader_types.cpp:290` |
| `canvas_item.fragment.UV` | open, #686 | | | `servers/rendering/shader_types.cpp:294` |
| `canvas_item.fragment.TEXTURE` | open, #686 | | | `servers/rendering/shader_types.cpp:296` |
| `canvas_item.fragment.TEXTURE_PIXEL_SIZE` | open, #686 | | | `servers/rendering/shader_types.cpp:297` |
| `canvas_item.fragment.NORMAL_TEXTURE` | open, #686 | | | `servers/rendering/shader_types.cpp:298` |
| `canvas_item.fragment.SPECULAR_SHININESS_TEXTURE` | open, #686 | | | `servers/rendering/shader_types.cpp:299` |
| `canvas_item.fragment.SPECULAR_SHININESS` | open, #686 | | | `servers/rendering/shader_types.cpp:300` |
| `canvas_item.fragment.SCREEN_UV` | open, #686 | | | `servers/rendering/shader_types.cpp:301` |
| `canvas_item.fragment.REGION_RECT` | open, #686 | | | `servers/rendering/shader_types.cpp:302` |
| `canvas_item.fragment.SCREEN_PIXEL_SIZE` | open, #686 | | | `servers/rendering/shader_types.cpp:303` |
| `canvas_item.fragment.POINT_COORD` | open, #686 | | | `servers/rendering/shader_types.cpp:304` |
| `canvas_item.fragment.AT_LIGHT_PASS` | open, #686 | | | `servers/rendering/shader_types.cpp:305` |
| `canvas_item.light.FRAGCOORD` | open, #686 | | | `servers/rendering/shader_types.cpp:332` |
| `canvas_item.light.NORMAL` | open, #686 | | | `servers/rendering/shader_types.cpp:333` |
| `canvas_item.light.COLOR` | open, #686 | | | `servers/rendering/shader_types.cpp:334` |
| `canvas_item.light.UV` | open, #686 | | | `servers/rendering/shader_types.cpp:335` |
| `canvas_item.light.SPECULAR_SHININESS` | open, #686 | | | `servers/rendering/shader_types.cpp:336` |
| `canvas_item.light.LIGHT_COLOR` | open, #686 | | | `servers/rendering/shader_types.cpp:337` |
| `canvas_item.light.LIGHT_POSITION` | open, #686 | | | `servers/rendering/shader_types.cpp:338` |
| `canvas_item.light.LIGHT_DIRECTION` | open, #686 | | | `servers/rendering/shader_types.cpp:339` |
| `canvas_item.light.LIGHT_ENERGY` | open, #686 | | | `servers/rendering/shader_types.cpp:340` |
| `canvas_item.light.LIGHT_IS_DIRECTIONAL` | open, #686 | | | `servers/rendering/shader_types.cpp:341` |
| `canvas_item.light.LIGHT_VERTEX` | open, #686 | | | `servers/rendering/shader_types.cpp:342` |
| `canvas_item.light.SCREEN_UV` | open, #686 | | | `servers/rendering/shader_types.cpp:345` |
| `canvas_item.light.TEXTURE` | open, #686 | | | `servers/rendering/shader_types.cpp:346` |
| `canvas_item.light.TEXTURE_PIXEL_SIZE` | open, #686 | | | `servers/rendering/shader_types.cpp:347` |
| `canvas_item.light.POINT_COORD` | open, #686 | | | `servers/rendering/shader_types.cpp:348` |
| `particles.global.TIME` | open, #1726 | | | `servers/rendering/shader_types.cpp:363` |
| `particles.constants.PI` | open, #1726 | | | `servers/rendering/shader_types.cpp:364` |
| `particles.constants.TAU` | open, #1726 | | | `servers/rendering/shader_types.cpp:365` |
| `particles.constants.E` | open, #1726 | | | `servers/rendering/shader_types.cpp:366` |
| `particles.start.LIFETIME` | open, #1726 | | | `servers/rendering/shader_types.cpp:380` |
| `particles.start.DELTA` | open, #1726 | | | `servers/rendering/shader_types.cpp:381` |
| `particles.start.NUMBER` | open, #1726 | | | `servers/rendering/shader_types.cpp:382` |
| `particles.start.INDEX` | open, #1726 | | | `servers/rendering/shader_types.cpp:383` |
| `particles.start.EMISSION_TRANSFORM` | open, #1726 | | | `servers/rendering/shader_types.cpp:384` |
| `particles.start.EMITTER_VELOCITY` | open, #1726 | | | `servers/rendering/shader_types.cpp:385` |
| `particles.start.INTERPOLATE_TO_END` | open, #1726 | | | `servers/rendering/shader_types.cpp:386` |
| `particles.start.RANDOM_SEED` | open, #1726 | | | `servers/rendering/shader_types.cpp:387` |
| `particles.start.FLAG_EMIT_POSITION` | open, #1726 | | | `servers/rendering/shader_types.cpp:388` |
| `particles.start.FLAG_EMIT_ROT_SCALE` | open, #1726 | | | `servers/rendering/shader_types.cpp:389` |
| `particles.start.FLAG_EMIT_VELOCITY` | open, #1726 | | | `servers/rendering/shader_types.cpp:390` |
| `particles.start.FLAG_EMIT_COLOR` | open, #1726 | | | `servers/rendering/shader_types.cpp:391` |
| `particles.start.FLAG_EMIT_CUSTOM` | open, #1726 | | | `servers/rendering/shader_types.cpp:392` |
| `particles.start.RESTART_POSITION` | open, #1726 | | | `servers/rendering/shader_types.cpp:393` |
| `particles.start.RESTART_ROT_SCALE` | open, #1726 | | | `servers/rendering/shader_types.cpp:394` |
| `particles.start.RESTART_VELOCITY` | open, #1726 | | | `servers/rendering/shader_types.cpp:395` |
| `particles.start.RESTART_COLOR` | open, #1726 | | | `servers/rendering/shader_types.cpp:396` |
| `particles.start.RESTART_CUSTOM` | open, #1726 | | | `servers/rendering/shader_types.cpp:397` |
| `particles.start.AMOUNT_RATIO` | open, #1726 | | | `servers/rendering/shader_types.cpp:398` |
| `particles.process.RESTART` | open, #1726 | | | `servers/rendering/shader_types.cpp:405` |
| `particles.process.LIFETIME` | open, #1726 | | | `servers/rendering/shader_types.cpp:414` |
| `particles.process.DELTA` | open, #1726 | | | `servers/rendering/shader_types.cpp:415` |
| `particles.process.NUMBER` | open, #1726 | | | `servers/rendering/shader_types.cpp:416` |
| `particles.process.INDEX` | open, #1726 | | | `servers/rendering/shader_types.cpp:417` |
| `particles.process.EMISSION_TRANSFORM` | open, #1726 | | | `servers/rendering/shader_types.cpp:418` |
| `particles.process.EMITTER_VELOCITY` | open, #1726 | | | `servers/rendering/shader_types.cpp:419` |
| `particles.process.INTERPOLATE_TO_END` | open, #1726 | | | `servers/rendering/shader_types.cpp:420` |
| `particles.process.RANDOM_SEED` | open, #1726 | | | `servers/rendering/shader_types.cpp:421` |
| `particles.process.FLAG_EMIT_POSITION` | open, #1726 | | | `servers/rendering/shader_types.cpp:422` |
| `particles.process.FLAG_EMIT_ROT_SCALE` | open, #1726 | | | `servers/rendering/shader_types.cpp:423` |
| `particles.process.FLAG_EMIT_VELOCITY` | open, #1726 | | | `servers/rendering/shader_types.cpp:424` |
| `particles.process.FLAG_EMIT_COLOR` | open, #1726 | | | `servers/rendering/shader_types.cpp:425` |
| `particles.process.FLAG_EMIT_CUSTOM` | open, #1726 | | | `servers/rendering/shader_types.cpp:426` |
| `particles.process.COLLIDED` | open, #1726 | | | `servers/rendering/shader_types.cpp:427` |
| `particles.process.COLLISION_NORMAL` | open, #1726 | | | `servers/rendering/shader_types.cpp:428` |
| `particles.process.COLLISION_DEPTH` | open, #1726 | | | `servers/rendering/shader_types.cpp:429` |
| `particles.process.ATTRACTOR_FORCE` | open, #1726 | | | `servers/rendering/shader_types.cpp:430` |
| `particles.process.AMOUNT_RATIO` | open, #1726 | | | `servers/rendering/shader_types.cpp:431` |
| `sky.global.TIME` | transpiled (`sky-time-zero`, `sky-time-fraction`, `sky-time-rolled-over`, `sky-time-cycle`, `sky-time-seek-half`, `sky-time-seek-third`, `sky-time-seek-four`, `sky-time-seek-rolled-over`, `sky-time-seek-third-rolled-over`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:456` |
| `sky.constants.PI` | transpiled (`sky-constants`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:457` |
| `sky.constants.TAU` | transpiled (`sky-constants`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:458` |
| `sky.constants.E` | transpiled (`sky-constants`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:459` |
| `sky.global.POSITION` | transpiled (`sky-position`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:460` |
| `sky.global.RADIANCE` | open, #1665 | | | `servers/rendering/shader_types.cpp:461` |
| `sky.global.AT_HALF_RES_PASS` | open, #1666 | | | `servers/rendering/shader_types.cpp:462` |
| `sky.global.AT_QUARTER_RES_PASS` | open, #1666 | | | `servers/rendering/shader_types.cpp:463` |
| `sky.global.AT_CUBEMAP_PASS` | open, #1666 | | | `servers/rendering/shader_types.cpp:464` |
| `sky.global.LIGHT0_ENABLED` | open, #1666 | | | `servers/rendering/shader_types.cpp:465` |
| `sky.global.LIGHT0_DIRECTION` | open, #1666 | | | `servers/rendering/shader_types.cpp:466` |
| `sky.global.LIGHT0_ENERGY` | open, #1666 | | | `servers/rendering/shader_types.cpp:467` |
| `sky.global.LIGHT0_COLOR` | open, #1666 | | | `servers/rendering/shader_types.cpp:468` |
| `sky.global.LIGHT0_SIZE` | open, #1666 | | | `servers/rendering/shader_types.cpp:469` |
| `sky.global.LIGHT1_ENABLED` | open, #1666 | | | `servers/rendering/shader_types.cpp:470` |
| `sky.global.LIGHT1_DIRECTION` | open, #1666 | | | `servers/rendering/shader_types.cpp:471` |
| `sky.global.LIGHT1_ENERGY` | open, #1666 | | | `servers/rendering/shader_types.cpp:472` |
| `sky.global.LIGHT1_COLOR` | open, #1666 | | | `servers/rendering/shader_types.cpp:473` |
| `sky.global.LIGHT1_SIZE` | open, #1666 | | | `servers/rendering/shader_types.cpp:474` |
| `sky.global.LIGHT2_ENABLED` | open, #1666 | | | `servers/rendering/shader_types.cpp:475` |
| `sky.global.LIGHT2_DIRECTION` | open, #1666 | | | `servers/rendering/shader_types.cpp:476` |
| `sky.global.LIGHT2_ENERGY` | open, #1666 | | | `servers/rendering/shader_types.cpp:477` |
| `sky.global.LIGHT2_COLOR` | open, #1666 | | | `servers/rendering/shader_types.cpp:478` |
| `sky.global.LIGHT2_SIZE` | open, #1666 | | | `servers/rendering/shader_types.cpp:479` |
| `sky.global.LIGHT3_ENABLED` | open, #1666 | | | `servers/rendering/shader_types.cpp:480` |
| `sky.global.LIGHT3_DIRECTION` | open, #1666 | | | `servers/rendering/shader_types.cpp:481` |
| `sky.global.LIGHT3_ENERGY` | open, #1666 | | | `servers/rendering/shader_types.cpp:482` |
| `sky.global.LIGHT3_COLOR` | open, #1666 | | | `servers/rendering/shader_types.cpp:483` |
| `sky.global.LIGHT3_SIZE` | open, #1666 | | | `servers/rendering/shader_types.cpp:484` |
| `sky.sky.EYEDIR` | transpiled (`sky-eyedir`, `sky-constants`, `sky-fog-write`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:488` |
| `sky.sky.SCREEN_UV` | transpiled (`sky-screen-uv`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:489` |
| `sky.sky.FRAGCOORD` | transpiled (`sky-fragcoord`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:490` |
| `sky.sky.SKY_COORDS` | transpiled (`sky-coords`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:491` |
| `sky.sky.HALF_RES_COLOR` | open, #1666 | | | `servers/rendering/shader_types.cpp:492` |
| `sky.sky.QUARTER_RES_COLOR` | open, #1666 | | | `servers/rendering/shader_types.cpp:493` |
| `fog.global.TIME` | open, #1783 | | | `servers/rendering/shader_types.cpp:507` |
| `fog.constants.PI` | open, #1783 | | | `servers/rendering/shader_types.cpp:508` |
| `fog.constants.TAU` | open, #1783 | | | `servers/rendering/shader_types.cpp:509` |
| `fog.constants.E` | open, #1783 | | | `servers/rendering/shader_types.cpp:510` |
| `fog.fog.WORLD_POSITION` | open, #1783 | | | `servers/rendering/shader_types.cpp:512` |
| `fog.fog.OBJECT_POSITION` | open, #1783 | | | `servers/rendering/shader_types.cpp:513` |
| `fog.fog.UVW` | open, #1783 | | | `servers/rendering/shader_types.cpp:514` |
| `fog.fog.SIZE` | open, #1783 | | | `servers/rendering/shader_types.cpp:515` |
| `fog.fog.SDF` | open, #1783 | | | `servers/rendering/shader_types.cpp:516` |

## built-in

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `spatial.vertex.VERTEX` | open, #1831 | | | `servers/rendering/shader_types.cpp:89` |
| `spatial.vertex.NORMAL` | open, #1831 | | | `servers/rendering/shader_types.cpp:90` |
| `spatial.vertex.TANGENT` | open, #1831 | | | `servers/rendering/shader_types.cpp:91` |
| `spatial.vertex.BINORMAL` | open, #1831 | | | `servers/rendering/shader_types.cpp:92` |
| `spatial.vertex.POSITION` | open, #1831 | | | `servers/rendering/shader_types.cpp:93` |
| `spatial.vertex.UV` | open, #1831 | | | `servers/rendering/shader_types.cpp:94` |
| `spatial.vertex.UV2` | open, #1831 | | | `servers/rendering/shader_types.cpp:95` |
| `spatial.vertex.COLOR` | open, #1831 | | | `servers/rendering/shader_types.cpp:96` |
| `spatial.vertex.POINT_SIZE` | open, #1831 | | | `servers/rendering/shader_types.cpp:97` |
| `spatial.vertex.Z_CLIP_SCALE` | open, #1831 | | | `servers/rendering/shader_types.cpp:98` |
| `spatial.vertex.ROUGHNESS` | open, #1831 | | | `servers/rendering/shader_types.cpp:102` |
| `spatial.vertex.PROJECTION_MATRIX` | open, #1831 | | | `servers/rendering/shader_types.cpp:117` |
| `spatial.vertex.MODELVIEW_MATRIX` | open, #1831 | | | `servers/rendering/shader_types.cpp:119` |
| `spatial.vertex.MODELVIEW_NORMAL_MATRIX` | open, #1831 | | | `servers/rendering/shader_types.cpp:120` |
| `spatial.fragment.LIGHT_VERTEX` | open, #1831 | | | `servers/rendering/shader_types.cpp:136` |
| `spatial.fragment.NORMAL` | open, #1831 | | | `servers/rendering/shader_types.cpp:139` |
| `spatial.fragment.TANGENT` | open, #1831 | | | `servers/rendering/shader_types.cpp:140` |
| `spatial.fragment.BINORMAL` | open, #1831 | | | `servers/rendering/shader_types.cpp:141` |
| `spatial.fragment.NORMAL_MAP` | open, #1831 | | | `servers/rendering/shader_types.cpp:143` |
| `spatial.fragment.NORMAL_MAP_DEPTH` | open, #1831 | | | `servers/rendering/shader_types.cpp:144` |
| `spatial.fragment.BENT_NORMAL_MAP` | open, #1831 | | | `servers/rendering/shader_types.cpp:145` |
| `spatial.fragment.ALBEDO` | open, #1831 | | | `servers/rendering/shader_types.cpp:149` |
| `spatial.fragment.PREMUL_ALPHA_FACTOR` | open, #1831 | | | `servers/rendering/shader_types.cpp:150` |
| `spatial.fragment.ALPHA` | open, #1831 | | | `servers/rendering/shader_types.cpp:151` |
| `spatial.fragment.METALLIC` | open, #1831 | | | `servers/rendering/shader_types.cpp:152` |
| `spatial.fragment.SPECULAR` | open, #1831 | | | `servers/rendering/shader_types.cpp:153` |
| `spatial.fragment.ROUGHNESS` | open, #1831 | | | `servers/rendering/shader_types.cpp:154` |
| `spatial.fragment.RIM` | open, #1831 | | | `servers/rendering/shader_types.cpp:155` |
| `spatial.fragment.RIM_TINT` | open, #1831 | | | `servers/rendering/shader_types.cpp:156` |
| `spatial.fragment.CLEARCOAT` | open, #1831 | | | `servers/rendering/shader_types.cpp:157` |
| `spatial.fragment.CLEARCOAT_ROUGHNESS` | open, #1831 | | | `servers/rendering/shader_types.cpp:158` |
| `spatial.fragment.ANISOTROPY` | open, #1831 | | | `servers/rendering/shader_types.cpp:159` |
| `spatial.fragment.ANISOTROPY_FLOW` | open, #1831 | | | `servers/rendering/shader_types.cpp:160` |
| `spatial.fragment.SSS_STRENGTH` | open, #1831 | | | `servers/rendering/shader_types.cpp:161` |
| `spatial.fragment.SSS_TRANSMITTANCE_COLOR` | open, #1831 | | | `servers/rendering/shader_types.cpp:162` |
| `spatial.fragment.SSS_TRANSMITTANCE_DEPTH` | open, #1831 | | | `servers/rendering/shader_types.cpp:163` |
| `spatial.fragment.SSS_TRANSMITTANCE_BOOST` | open, #1831 | | | `servers/rendering/shader_types.cpp:164` |
| `spatial.fragment.BACKLIGHT` | open, #1831 | | | `servers/rendering/shader_types.cpp:165` |
| `spatial.fragment.AO` | open, #1831 | | | `servers/rendering/shader_types.cpp:166` |
| `spatial.fragment.AO_LIGHT_AFFECT` | open, #1831 | | | `servers/rendering/shader_types.cpp:167` |
| `spatial.fragment.EMISSION` | open, #1831 | | | `servers/rendering/shader_types.cpp:168` |
| `spatial.fragment.DEPTH` | open, #1831 | | | `servers/rendering/shader_types.cpp:169` |
| `spatial.fragment.FOG` | open, #1831 | | | `servers/rendering/shader_types.cpp:191` |
| `spatial.fragment.RADIANCE` | open, #1831 | | | `servers/rendering/shader_types.cpp:192` |
| `spatial.fragment.IRRADIANCE` | open, #1831 | | | `servers/rendering/shader_types.cpp:193` |
| `spatial.fragment.ALPHA_SCISSOR_THRESHOLD` | open, #1831 | | | `servers/rendering/shader_types.cpp:197` |
| `spatial.fragment.ALPHA_HASH_SCALE` | open, #1831 | | | `servers/rendering/shader_types.cpp:198` |
| `spatial.fragment.ALPHA_ANTIALIASING_EDGE` | open, #1831 | | | `servers/rendering/shader_types.cpp:199` |
| `spatial.fragment.ALPHA_TEXTURE_COORDINATE` | open, #1831 | | | `servers/rendering/shader_types.cpp:200` |
| `spatial.light.DIFFUSE_LIGHT` | open, #1453 | | | `servers/rendering/shader_types.cpp:223` |
| `spatial.light.SPECULAR_LIGHT` | open, #1453 | | | `servers/rendering/shader_types.cpp:224` |
| `spatial.light.ALPHA` | open, #1453 | | | `servers/rendering/shader_types.cpp:225` |
| `canvas_item.vertex.VERTEX` | open, #686 | | | `servers/rendering/shader_types.cpp:269` |
| `canvas_item.vertex.UV` | open, #686 | | | `servers/rendering/shader_types.cpp:270` |
| `canvas_item.vertex.COLOR` | open, #686 | | | `servers/rendering/shader_types.cpp:271` |
| `canvas_item.vertex.POINT_SIZE` | open, #686 | | | `servers/rendering/shader_types.cpp:272` |
| `canvas_item.fragment.VERTEX` | open, #686 | | | `servers/rendering/shader_types.cpp:287` |
| `canvas_item.fragment.SHADOW_VERTEX` | open, #686 | | | `servers/rendering/shader_types.cpp:288` |
| `canvas_item.fragment.LIGHT_VERTEX` | open, #686 | | | `servers/rendering/shader_types.cpp:289` |
| `canvas_item.fragment.NORMAL` | open, #686 | | | `servers/rendering/shader_types.cpp:291` |
| `canvas_item.fragment.NORMAL_MAP` | open, #686 | | | `servers/rendering/shader_types.cpp:292` |
| `canvas_item.fragment.NORMAL_MAP_DEPTH` | open, #686 | | | `servers/rendering/shader_types.cpp:293` |
| `canvas_item.fragment.COLOR` | open, #686 | | | `servers/rendering/shader_types.cpp:295` |
| `canvas_item.light.LIGHT` | open, #686 | | | `servers/rendering/shader_types.cpp:343` |
| `canvas_item.light.SHADOW_MODULATE` | open, #686 | | | `servers/rendering/shader_types.cpp:344` |
| `particles.start.COLOR` | open, #1726 | | | `servers/rendering/shader_types.cpp:368` |
| `particles.start.VELOCITY` | open, #1726 | | | `servers/rendering/shader_types.cpp:369` |
| `particles.start.MASS` | open, #1726 | | | `servers/rendering/shader_types.cpp:370` |
| `particles.start.ACTIVE` | open, #1726 | | | `servers/rendering/shader_types.cpp:371` |
| `particles.start.CUSTOM` | open, #1726 | | | `servers/rendering/shader_types.cpp:372` |
| `particles.start.USERDATA1` | open, #1726 | | | `servers/rendering/shader_types.cpp:373` |
| `particles.start.USERDATA2` | open, #1726 | | | `servers/rendering/shader_types.cpp:374` |
| `particles.start.USERDATA3` | open, #1726 | | | `servers/rendering/shader_types.cpp:375` |
| `particles.start.USERDATA4` | open, #1726 | | | `servers/rendering/shader_types.cpp:376` |
| `particles.start.USERDATA5` | open, #1726 | | | `servers/rendering/shader_types.cpp:377` |
| `particles.start.USERDATA6` | open, #1726 | | | `servers/rendering/shader_types.cpp:378` |
| `particles.start.TRANSFORM` | open, #1726 | | | `servers/rendering/shader_types.cpp:379` |
| `particles.process.COLOR` | open, #1726 | | | `servers/rendering/shader_types.cpp:401` |
| `particles.process.VELOCITY` | open, #1726 | | | `servers/rendering/shader_types.cpp:402` |
| `particles.process.MASS` | open, #1726 | | | `servers/rendering/shader_types.cpp:403` |
| `particles.process.ACTIVE` | open, #1726 | | | `servers/rendering/shader_types.cpp:404` |
| `particles.process.CUSTOM` | open, #1726 | | | `servers/rendering/shader_types.cpp:406` |
| `particles.process.USERDATA1` | open, #1726 | | | `servers/rendering/shader_types.cpp:407` |
| `particles.process.USERDATA2` | open, #1726 | | | `servers/rendering/shader_types.cpp:408` |
| `particles.process.USERDATA3` | open, #1726 | | | `servers/rendering/shader_types.cpp:409` |
| `particles.process.USERDATA4` | open, #1726 | | | `servers/rendering/shader_types.cpp:410` |
| `particles.process.USERDATA5` | open, #1726 | | | `servers/rendering/shader_types.cpp:411` |
| `particles.process.USERDATA6` | open, #1726 | | | `servers/rendering/shader_types.cpp:412` |
| `particles.process.TRANSFORM` | open, #1726 | | | `servers/rendering/shader_types.cpp:413` |
| `sky.sky.COLOR` | transpiled (`sky-default`, `sky-fog`, `sky-fog-sun`, `sky-fog-energy-0`, `sky-fog-energy-3`, `sky-fog-affect-0`, `sky-fog-affect-half`, `sky-sun-coloured`, `sky-sun-below`, `sky-sun-energy-0`, `sky-camera-wide`, `head-writable/sky-color`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:486` |
| `sky.sky.ALPHA` | open, #1665 | | | `servers/rendering/shader_types.cpp:487` |
| `sky.sky.FOG` | transpiled (`sky-fog-write`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:494` |
| `fog.fog.ALBEDO` | open, #1783 | | | `servers/rendering/shader_types.cpp:517` |
| `fog.fog.DENSITY` | open, #1783 | | | `servers/rendering/shader_types.cpp:518` |
| `fog.fog.EMISSION` | open, #1783 | | | `servers/rendering/shader_types.cpp:519` |

## stage function

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `canvas_item.fragment.texture_sdf(vec2)` | open, #1785 | | | `servers/rendering/shader_types.cpp:314` |
| `canvas_item.light.texture_sdf(vec2)` | open, #1785 | | | `servers/rendering/shader_types.cpp:315` |
| `canvas_item.fragment.sdf_to_screen_uv(vec2)` | open, #1785 | | | `servers/rendering/shader_types.cpp:317` |
| `canvas_item.light.sdf_to_screen_uv(vec2)` | open, #1785 | | | `servers/rendering/shader_types.cpp:318` |
| `canvas_item.fragment.texture_sdf_normal(vec2)` | open, #1785 | | | `servers/rendering/shader_types.cpp:319` |
| `canvas_item.light.texture_sdf_normal(vec2)` | open, #1785 | | | `servers/rendering/shader_types.cpp:320` |
| `canvas_item.fragment.screen_uv_to_sdf(vec2)` | open, #1785 | | | `servers/rendering/shader_types.cpp:328` |
| `canvas_item.light.screen_uv_to_sdf(vec2)` | open, #1785 | | | `servers/rendering/shader_types.cpp:329` |
| `particles.start.emit_subparticle(mat4,vec3,vec4,vec4,uint)` | open, #1726 | | | `servers/rendering/shader_types.cpp:442` |
| `particles.process.emit_subparticle(mat4,vec3,vec4,vec4,uint)` | open, #1726 | | | `servers/rendering/shader_types.cpp:443` |

## render mode

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `spatial render_mode blend_mix` | open, #1831 | | | `servers/rendering/shader_types.cpp:233` |
| `spatial render_mode blend_add` | open, #1831 | | | `servers/rendering/shader_types.cpp:233` |
| `spatial render_mode blend_sub` | open, #1831 | | | `servers/rendering/shader_types.cpp:233` |
| `spatial render_mode blend_mul` | open, #1831 | | | `servers/rendering/shader_types.cpp:233` |
| `spatial render_mode blend_premul_alpha` | open, #1831 | | | `servers/rendering/shader_types.cpp:233` |
| `spatial render_mode depth_draw_opaque` | open, #1831 | | | `servers/rendering/shader_types.cpp:234` |
| `spatial render_mode depth_draw_always` | open, #1831 | | | `servers/rendering/shader_types.cpp:234` |
| `spatial render_mode depth_draw_never` | open, #1831 | | | `servers/rendering/shader_types.cpp:234` |
| `spatial render_mode depth_prepass_alpha` | open, #1831 | | | `servers/rendering/shader_types.cpp:235` |
| `spatial render_mode depth_test_default` | open, #1831 | | | `servers/rendering/shader_types.cpp:236` |
| `spatial render_mode depth_test_disabled` | open, #1831 | | | `servers/rendering/shader_types.cpp:236` |
| `spatial render_mode depth_test_inverted` | open, #1831 | | | `servers/rendering/shader_types.cpp:236` |
| `spatial render_mode sss_mode_skin` | open, #1782 | | | `servers/rendering/shader_types.cpp:237` |
| `spatial render_mode cull_back` | open, #1831 | | | `servers/rendering/shader_types.cpp:238` |
| `spatial render_mode cull_front` | open, #1831 | | | `servers/rendering/shader_types.cpp:238` |
| `spatial render_mode cull_disabled` | open, #1831 | | | `servers/rendering/shader_types.cpp:238` |
| `spatial render_mode unshaded` | open, #1831 | | | `servers/rendering/shader_types.cpp:239` |
| `spatial render_mode wireframe` | open, #1831 | | | `servers/rendering/shader_types.cpp:240` |
| `spatial render_mode diffuse_lambert` | open, #1453 | | | `servers/rendering/shader_types.cpp:241` |
| `spatial render_mode diffuse_lambert_wrap` | open, #1453 | | | `servers/rendering/shader_types.cpp:241` |
| `spatial render_mode diffuse_burley` | open, #1453 | | | `servers/rendering/shader_types.cpp:241` |
| `spatial render_mode diffuse_toon` | open, #1453 | | | `servers/rendering/shader_types.cpp:241` |
| `spatial render_mode specular_schlick_ggx` | open, #1453 | | | `servers/rendering/shader_types.cpp:242` |
| `spatial render_mode specular_toon` | open, #1453 | | | `servers/rendering/shader_types.cpp:242` |
| `spatial render_mode specular_disabled` | open, #1453 | | | `servers/rendering/shader_types.cpp:242` |
| `spatial render_mode skip_vertex_transform` | open, #1831 | | | `servers/rendering/shader_types.cpp:243` |
| `spatial render_mode world_vertex_coords` | open, #1831 | | | `servers/rendering/shader_types.cpp:244` |
| `spatial render_mode ensure_correct_normals` | open, #1831 | | | `servers/rendering/shader_types.cpp:245` |
| `spatial render_mode shadows_disabled` | open, #1453 | | | `servers/rendering/shader_types.cpp:246` |
| `spatial render_mode ambient_light_disabled` | open, #1453 | | | `servers/rendering/shader_types.cpp:247` |
| `spatial render_mode shadow_to_opacity` | open, #1453 | | | `servers/rendering/shader_types.cpp:248` |
| `spatial render_mode vertex_lighting` | open, #1453 | | | `servers/rendering/shader_types.cpp:249` |
| `spatial render_mode particle_trails` | open, #1831 | | | `servers/rendering/shader_types.cpp:250` |
| `spatial render_mode alpha_to_coverage` | open, #1831 | | | `servers/rendering/shader_types.cpp:251` |
| `spatial render_mode alpha_to_coverage_and_one` | open, #1831 | | | `servers/rendering/shader_types.cpp:252` |
| `spatial render_mode debug_shadow_splits` | open, #1453 | | | `servers/rendering/shader_types.cpp:253` |
| `spatial render_mode fog_disabled` | open, #1831 | | | `servers/rendering/shader_types.cpp:254` |
| `spatial render_mode specular_occlusion_disabled` | open, #1453 | | | `servers/rendering/shader_types.cpp:255` |
| `canvas_item render_mode skip_vertex_transform` | open, #686 | | | `servers/rendering/shader_types.cpp:354` |
| `canvas_item render_mode blend_mix` | open, #686 | | | `servers/rendering/shader_types.cpp:355` |
| `canvas_item render_mode blend_add` | open, #686 | | | `servers/rendering/shader_types.cpp:355` |
| `canvas_item render_mode blend_sub` | open, #686 | | | `servers/rendering/shader_types.cpp:355` |
| `canvas_item render_mode blend_mul` | open, #686 | | | `servers/rendering/shader_types.cpp:355` |
| `canvas_item render_mode blend_premul_alpha` | open, #686 | | | `servers/rendering/shader_types.cpp:355` |
| `canvas_item render_mode blend_disabled` | open, #686 | | | `servers/rendering/shader_types.cpp:355` |
| `canvas_item render_mode unshaded` | open, #686 | | | `servers/rendering/shader_types.cpp:356` |
| `canvas_item render_mode light_only` | open, #686 | | | `servers/rendering/shader_types.cpp:357` |
| `canvas_item render_mode world_vertex_coords` | open, #686 | | | `servers/rendering/shader_types.cpp:358` |
| `particles render_mode collision_use_scale` | open, #1726 | | | `servers/rendering/shader_types.cpp:448` |
| `particles render_mode disable_force` | open, #1726 | | | `servers/rendering/shader_types.cpp:449` |
| `particles render_mode disable_velocity` | open, #1726 | | | `servers/rendering/shader_types.cpp:450` |
| `particles render_mode keep_data` | open, #1726 | | | `servers/rendering/shader_types.cpp:451` |
| `sky render_mode use_half_res_pass` | open, #1666 | | | `servers/rendering/shader_types.cpp:499` |
| `sky render_mode use_quarter_res_pass` | open, #1666 | | | `servers/rendering/shader_types.cpp:500` |
| `sky render_mode disable_fog` | transpiled (`sky-disable-fog`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:501` |
| `sky render_mode use_debanding` | transpiled (`sky-debanding`) | native | untested (#1788) | `servers/rendering/shader_types.cpp:502` |

## stencil mode

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `spatial stencil_mode read` | open, #1831 | | | `servers/rendering/shader_types.cpp:256` |
| `spatial stencil_mode write` | open, #1831 | | | `servers/rendering/shader_types.cpp:257` |
| `spatial stencil_mode write_depth_fail` | open, #1831 | | | `servers/rendering/shader_types.cpp:258` |
| `spatial stencil_mode compare_always` | open, #1831 | | | `servers/rendering/shader_types.cpp:259` |
| `spatial stencil_mode compare_less` | open, #1831 | | | `servers/rendering/shader_types.cpp:259` |
| `spatial stencil_mode compare_equal` | open, #1831 | | | `servers/rendering/shader_types.cpp:259` |
| `spatial stencil_mode compare_less_or_equal` | open, #1831 | | | `servers/rendering/shader_types.cpp:259` |
| `spatial stencil_mode compare_greater` | open, #1831 | | | `servers/rendering/shader_types.cpp:259` |
| `spatial stencil_mode compare_not_equal` | open, #1831 | | | `servers/rendering/shader_types.cpp:259` |
| `spatial stencil_mode compare_greater_or_equal` | open, #1831 | | | `servers/rendering/shader_types.cpp:259` |

## preprocessor

| Instruction | State | WebGL 2 | WebGPU | Godot source |
| --- | --- | --- | --- | --- |
| `#if` | transpiled (`if-true`, `if-false`, `if-renderer`, `if-macro`, `if-function-macro`, `if-float`, `if-string`, `if-vector`, `if-not`, `if-zero-float`, `if-empty-string`, `if-empty-array`, `if-defined-bracket`, `if-defined-bare`, `if-defined-missing`, `if-defined-not`, `if-defined-two`, `if-defined-bare-then-bare`, `if-defined-bracket-then-bare`, `if-defined-space-bracket`, `if-defined-compare`, `if-defined-no-name`, `if-defined-empty-bracket`, `if-defined-macro-name`, `if-missing-condition`, `if-open-bracket`, `if-close-bracket`, `if-parse-error`, `if-unknown-name`, `if-execute-error`, `if-modulo-zero`, `if-shift-negative`, `if-format-error`, `if-error-below-root`, `if-invalid-operands`, `if-null`, `if-utility`, `if-utility-vector`, `if-utility-refused-argument`, `if-utility-argument-count`, `if-utility-void`, `if-utility-seed`, `if-unterminated`, `if-nested-skipped`, `elif-taken`, `elif-after-taken`, `elif-none`, `elif-after-taken-error`, `elif-after-taken-missing`, `elif-defined`, `elif-after-else`, `elif-third`) | native | untested (#1788) | `servers/rendering/shader_preprocessor.cpp:384` |
| `#ifdef` | transpiled (`condition-ifdef-taken`, `condition-ifdef-skipped`, `condition-nested`, `condition-skipped-garbage`, `condition-unterminated`, `condition-else-twice`, `condition-endif-text`, `condition-ifdef-text`, `condition-indented`, `error-skipped`, `include-define-across`, `include-missing-skipped`) | native | untested (#1788) | `servers/rendering/shader_preprocessor.cpp:386` |
| `#ifndef` | transpiled (`condition-ifndef`, `condition-nested`) | native | untested (#1788) | `servers/rendering/shader_preprocessor.cpp:388` |
| `#elif` | transpiled (`elif-taken`, `elif-after-taken`, `elif-none`, `elif-after-taken-error`, `elif-after-taken-missing`, `elif-defined`, `elif-unmatched`, `elif-after-else`, `elif-third`) | native | untested (#1788) | `servers/rendering/shader_preprocessor.cpp:390` |
| `#else` | transpiled (`condition-ifdef-taken`, `condition-ifdef-skipped`, `condition-ifndef`, `condition-nested`, `condition-unmatched-else`, `condition-else-twice`, `if-nested-skipped`, `elif-taken`, `elif-after-taken`, `elif-none`, `elif-after-taken-error`, `elif-after-taken-missing`, `elif-defined`, `elif-after-else`, `elif-third`) | native | untested (#1788) | `servers/rendering/shader_preprocessor.cpp:392` |
| `#endif` | transpiled (`condition-ifdef-taken`, `condition-ifdef-skipped`, `condition-ifndef`, `condition-nested`, `condition-skipped-garbage`, `condition-unmatched-endif`, `condition-else-twice`, `condition-endif-text`, `condition-ifdef-text`, `condition-indented`, `if-true`, `if-false`, `if-renderer`, `if-macro`, `if-function-macro`, `if-float`, `if-string`, `if-vector`, `if-not`, `if-zero-float`, `if-empty-string`, `if-empty-array`, `if-defined-bracket`, `if-defined-bare`, `if-defined-missing`, `if-defined-not`, `if-defined-two`, `if-defined-bare-then-bare`, `if-defined-bracket-then-bare`, `if-defined-space-bracket`, `if-defined-compare`, `if-defined-no-name`, `if-defined-empty-bracket`, `if-defined-macro-name`, `if-missing-condition`, `if-open-bracket`, `if-close-bracket`, `if-parse-error`, `if-unknown-name`, `if-execute-error`, `if-modulo-zero`, `if-shift-negative`, `if-format-error`, `if-error-below-root`, `if-invalid-operands`, `if-null`, `if-utility`, `if-utility-vector`, `if-utility-refused-argument`, `if-utility-argument-count`, `if-utility-void`, `if-utility-seed`, `if-nested-skipped`, `elif-taken`, `elif-after-taken`, `elif-none`, `elif-after-taken-error`, `elif-after-taken-missing`, `elif-defined`, `elif-after-else`, `elif-third`, `error-skipped`, `include-define-across`, `include-missing-skipped`) | native | untested (#1788) | `servers/rendering/shader_preprocessor.cpp:394` |
| `#error` | transpiled (`error-skipped`, `error-taken`) | native | untested (#1788) | `servers/rendering/shader_preprocessor.cpp:396` |
| `#define` | transpiled (`define-object`, `define-function`, `define-inside-macro`, `define-nested-arguments`, `define-concatenation`, `define-continuation`, `define-word-boundary`, `define-empty-body`, `define-built-in`, `define-redefined`, `define-argument-count`, `define-concatenation-first`, `define-invalid-name`, `define-after-code`, `define-space-after-hash`, `define-uses-49`, `define-uses-50`, `define-recursive`, `undef-redefine`, `undef-unknown`, `undef-built-in`, `undef-then-ifdef`, `condition-ifdef-taken`, `condition-ifndef`, `condition-nested`, `if-macro`, `if-function-macro`, `if-defined-bracket`, `if-defined-bare`, `if-defined-two`, `if-defined-bare-then-bare`, `if-defined-bracket-then-bare`, `if-defined-space-bracket`, `if-defined-macro-name`, `elif-defined`, `include-define-across`, `include-macro-in-include`, `include-marker-expanded`) | native | untested (#1788) | `servers/rendering/shader_preprocessor.cpp:398` |
| `#undef` | transpiled (`undef-redefine`, `undef-unknown`, `undef-built-in`, `undef-then-ifdef`) | native | untested (#1788) | `servers/rendering/shader_preprocessor.cpp:400` |
| `#include` | transpiled (`include-nested`, `include-define-across`, `include-twice`, `include-cycle`, `include-missing`, `include-missing-skipped`, `include-no-quotes`, `include-macro-in-include`, `include-marker-expanded`) | native | untested (#1788) | `servers/rendering/shader_preprocessor.cpp:402` |
| `#pragma` | transpiled (`pragma-disable`, `pragma-disable-then-directive`, `pragma-disable-keeps-macro-text`, `pragma-unknown`) | native | untested (#1788) | `servers/rendering/shader_preprocessor.cpp:404` |
| `defined` | transpiled (`if-defined-bracket`, `if-defined-bare`, `if-defined-missing`, `if-defined-not`, `if-defined-two`, `if-defined-bare-then-bare`, `if-defined-bracket-then-bare`, `if-defined-space-bracket`, `if-defined-compare`, `if-defined-no-name`, `if-defined-empty-bracket`, `if-defined-macro-name`, `elif-defined`) | native | untested (#1788) | `servers/rendering/shader_preprocessor.cpp:910` |
| `#pragma disable_preprocessor` | transpiled (`pragma-disable`, `pragma-disable-then-directive`, `pragma-disable-keeps-macro-text`) | native | untested (#1788) | `servers/rendering/shader_preprocessor.cpp:803` |
