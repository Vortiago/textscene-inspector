/**
 * The instruction table of Godot 4.6.3's shading language, read from Godot's source.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm godot:shader-language
 */

/** The Godot version whose source the table is read from, and whose rules the transpiler follows. */
export const GODOT_VERSION = '4.6.3';

/** A transpiled row's state on a target: `native`, or `lowered: ` and the name of the lowering. */
export type TargetState = string;

/** One instruction: a type, a keyword, an operator signature, a function overload or a built-in. */
export interface InstructionRow {
  readonly id: string;
  readonly family: string;
  /** Godot's `file:line` that defines it. */
  readonly source: string;
  /** The issue that transpiles it, which an error for an open row names. */
  readonly owner: string;
  /** Godot's token for a keyword. */
  readonly token?: string;
  readonly returns?: string;
  readonly args?: readonly string[];
  /** The state on WebGL 2 through three's handler. Only a transpiled row has one. */
  readonly webgl2?: TargetState;
  /** The state on WebGPURenderer. Only a transpiled row has one. */
  readonly webgpu?: TargetState;
}

/**
 * One row per line: id, family, source, owner, token, returns, args, webgl2, webgpu, tab-separated. An empty field is absent, and the
 * args are a bracketed list, so a function of no arguments has `()`.
 */
const ROWS = `
void	data type	servers/rendering/shader_language.h:210	#1825	TK_TYPE_VOID			native	native
bool	data type	servers/rendering/shader_language.h:211	#1823	TK_TYPE_BOOL			native	native
bvec2	data type	servers/rendering/shader_language.h:212	#1823	TK_TYPE_BVEC2			native	native
bvec3	data type	servers/rendering/shader_language.h:213	#1823	TK_TYPE_BVEC3			native	native
bvec4	data type	servers/rendering/shader_language.h:214	#1823	TK_TYPE_BVEC4			native	native
int	data type	servers/rendering/shader_language.h:215	#1823	TK_TYPE_INT			native	native
ivec2	data type	servers/rendering/shader_language.h:216	#1823	TK_TYPE_IVEC2			native	native
ivec3	data type	servers/rendering/shader_language.h:217	#1823	TK_TYPE_IVEC3			native	native
ivec4	data type	servers/rendering/shader_language.h:218	#1823	TK_TYPE_IVEC4			native	native
uint	data type	servers/rendering/shader_language.h:219	#1823	TK_TYPE_UINT			native	native
uvec2	data type	servers/rendering/shader_language.h:220	#1823	TK_TYPE_UVEC2			native	native
uvec3	data type	servers/rendering/shader_language.h:221	#1823	TK_TYPE_UVEC3			native	native
uvec4	data type	servers/rendering/shader_language.h:222	#1823	TK_TYPE_UVEC4			native	native
float	data type	servers/rendering/shader_language.h:223	#1823	TK_TYPE_FLOAT			native	native
vec2	data type	servers/rendering/shader_language.h:224	#1823	TK_TYPE_VEC2			native	native
vec3	data type	servers/rendering/shader_language.h:225	#1823	TK_TYPE_VEC3			native	native
vec4	data type	servers/rendering/shader_language.h:226	#1823	TK_TYPE_VEC4			native	native
mat2	data type	servers/rendering/shader_language.h:227	#1823	TK_TYPE_MAT2			native	native
mat3	data type	servers/rendering/shader_language.h:228	#1823	TK_TYPE_MAT3			native	native
mat4	data type	servers/rendering/shader_language.h:229	#1823	TK_TYPE_MAT4			native	native
sampler2D	data type	servers/rendering/shader_language.h:230	#1829	TK_TYPE_SAMPLER2D				
isampler2D	data type	servers/rendering/shader_language.h:231	#1829	TK_TYPE_ISAMPLER2D				
usampler2D	data type	servers/rendering/shader_language.h:232	#1829	TK_TYPE_USAMPLER2D				
sampler2DArray	data type	servers/rendering/shader_language.h:233	#1829	TK_TYPE_SAMPLER2DARRAY				
isampler2DArray	data type	servers/rendering/shader_language.h:234	#1829	TK_TYPE_ISAMPLER2DARRAY				
usampler2DArray	data type	servers/rendering/shader_language.h:235	#1829	TK_TYPE_USAMPLER2DARRAY				
sampler3D	data type	servers/rendering/shader_language.h:236	#1829	TK_TYPE_SAMPLER3D				
isampler3D	data type	servers/rendering/shader_language.h:237	#1829	TK_TYPE_ISAMPLER3D				
usampler3D	data type	servers/rendering/shader_language.h:238	#1829	TK_TYPE_USAMPLER3D				
samplerCube	data type	servers/rendering/shader_language.h:239	#1829	TK_TYPE_SAMPLERCUBE				
samplerCubeArray	data type	servers/rendering/shader_language.h:240	#1829	TK_TYPE_SAMPLERCUBEARRAY				
samplerExternalOES	data type	servers/rendering/shader_language.h:241	#1829	TK_TYPE_SAMPLEREXT				
struct type	data type	servers/rendering/shader_language.h:242	#1824				native	native
float literal	literal	servers/rendering/shader_language.h:59	#1823				native	native
int literal	literal	servers/rendering/shader_language.h:60	#1823				native	native
uint literal	literal	servers/rendering/shader_language.h:61	#1823				native	native
true	literal	servers/rendering/shader_language.cpp:284	#1823	TK_TRUE			native	native
false	literal	servers/rendering/shader_language.cpp:285	#1823	TK_FALSE			native	native
flat	qualifier	servers/rendering/shader_language.cpp:324	#1794	TK_INTERPOLATION_FLAT				
smooth	qualifier	servers/rendering/shader_language.cpp:325	#1794	TK_INTERPOLATION_SMOOTH				
lowp	qualifier	servers/rendering/shader_language.cpp:329	#1823	TK_PRECISION_LOW			lowered: dropped: every float is 32-bit	lowered: dropped: every float is 32-bit
mediump	qualifier	servers/rendering/shader_language.cpp:330	#1823	TK_PRECISION_MID			lowered: dropped: every float is 32-bit	lowered: dropped: every float is 32-bit
highp	qualifier	servers/rendering/shader_language.cpp:331	#1823	TK_PRECISION_HIGH			lowered: dropped: every float is 32-bit	lowered: dropped: every float is 32-bit
uniform	shader head	servers/rendering/shader_language.cpp:335	#1829	TK_UNIFORM				
group_uniforms	shader head	servers/rendering/shader_language.cpp:336	#1829	TK_UNIFORM_GROUP				
varying	shader head	servers/rendering/shader_language.cpp:337	#1794	TK_VARYING				
const	shader head	servers/rendering/shader_language.cpp:338	#1794	TK_CONST				
struct	shader head	servers/rendering/shader_language.cpp:339	#1794	TK_STRUCT				
shader_type	shader head	servers/rendering/shader_language.cpp:340	#1794	TK_SHADER_TYPE				
render_mode	shader head	servers/rendering/shader_language.cpp:341	#1794	TK_RENDER_MODE				
stencil_mode	shader head	servers/rendering/shader_language.cpp:342	#1794	TK_STENCIL_MODE				
instance	uniform	servers/rendering/shader_language.cpp:346	#1829	TK_INSTANCE				
global	uniform	servers/rendering/shader_language.cpp:347	#1829	TK_GLOBAL				
if	statement keyword	servers/rendering/shader_language.cpp:351	#1824	TK_CF_IF			native	native
else	statement keyword	servers/rendering/shader_language.cpp:352	#1824	TK_CF_ELSE			native	native
for	statement keyword	servers/rendering/shader_language.cpp:353	#1824	TK_CF_FOR			native	native
while	statement keyword	servers/rendering/shader_language.cpp:354	#1824	TK_CF_WHILE			native	native
do	statement keyword	servers/rendering/shader_language.cpp:355	#1824	TK_CF_DO			native	native
switch	statement keyword	servers/rendering/shader_language.cpp:356	#1824	TK_CF_SWITCH			native	native
case	statement keyword	servers/rendering/shader_language.cpp:357	#1824	TK_CF_CASE			native	native
default	statement keyword	servers/rendering/shader_language.cpp:358	#1824	TK_CF_DEFAULT			native	native
break	statement keyword	servers/rendering/shader_language.cpp:359	#1824	TK_CF_BREAK			native	native
continue	statement keyword	servers/rendering/shader_language.cpp:360	#1824	TK_CF_CONTINUE			native	native
return	statement keyword	servers/rendering/shader_language.cpp:361	#1823	TK_CF_RETURN			native	native
discard	statement keyword	servers/rendering/shader_language.cpp:362	#1824	TK_CF_DISCARD			native	native
in	qualifier	servers/rendering/shader_language.cpp:366	#1825	TK_ARG_IN			native	native
out	qualifier	servers/rendering/shader_language.cpp:367	#1825	TK_ARG_OUT			native	native
inout	qualifier	servers/rendering/shader_language.cpp:368	#1825	TK_ARG_INOUT			native	native
source_color	uniform hint	servers/rendering/shader_language.cpp:372	#1829	TK_HINT_SOURCE_COLOR				
color_conversion_disabled	uniform hint	servers/rendering/shader_language.cpp:373	#1829	TK_HINT_COLOR_CONVERSION_DISABLED				
hint_range	uniform hint	servers/rendering/shader_language.cpp:374	#1829	TK_HINT_RANGE				
hint_enum	uniform hint	servers/rendering/shader_language.cpp:375	#1829	TK_HINT_ENUM				
instance_index	uniform hint	servers/rendering/shader_language.cpp:376	#1829	TK_HINT_INSTANCE_INDEX				
hint_normal	uniform hint	servers/rendering/shader_language.cpp:380	#1829	TK_HINT_NORMAL_TEXTURE				
hint_default_white	uniform hint	servers/rendering/shader_language.cpp:381	#1829	TK_HINT_DEFAULT_WHITE_TEXTURE				
hint_default_black	uniform hint	servers/rendering/shader_language.cpp:382	#1829	TK_HINT_DEFAULT_BLACK_TEXTURE				
hint_default_transparent	uniform hint	servers/rendering/shader_language.cpp:383	#1829	TK_HINT_DEFAULT_TRANSPARENT_TEXTURE				
hint_anisotropy	uniform hint	servers/rendering/shader_language.cpp:384	#1829	TK_HINT_ANISOTROPY_TEXTURE				
hint_roughness_r	uniform hint	servers/rendering/shader_language.cpp:385	#1829	TK_HINT_ROUGHNESS_R				
hint_roughness_g	uniform hint	servers/rendering/shader_language.cpp:386	#1829	TK_HINT_ROUGHNESS_G				
hint_roughness_b	uniform hint	servers/rendering/shader_language.cpp:387	#1829	TK_HINT_ROUGHNESS_B				
hint_roughness_a	uniform hint	servers/rendering/shader_language.cpp:388	#1829	TK_HINT_ROUGHNESS_A				
hint_roughness_normal	uniform hint	servers/rendering/shader_language.cpp:389	#1829	TK_HINT_ROUGHNESS_NORMAL_TEXTURE				
hint_roughness_gray	uniform hint	servers/rendering/shader_language.cpp:390	#1829	TK_HINT_ROUGHNESS_GRAY				
hint_screen_texture	uniform hint	servers/rendering/shader_language.cpp:391	#1829	TK_HINT_SCREEN_TEXTURE				
hint_normal_roughness_texture	uniform hint	servers/rendering/shader_language.cpp:392	#1829	TK_HINT_NORMAL_ROUGHNESS_TEXTURE				
hint_depth_texture	uniform hint	servers/rendering/shader_language.cpp:393	#1829	TK_HINT_DEPTH_TEXTURE				
filter_nearest	sampler setting	servers/rendering/shader_language.cpp:395	#1829	TK_FILTER_NEAREST				
filter_linear	sampler setting	servers/rendering/shader_language.cpp:396	#1829	TK_FILTER_LINEAR				
filter_nearest_mipmap	sampler setting	servers/rendering/shader_language.cpp:397	#1829	TK_FILTER_NEAREST_MIPMAP				
filter_linear_mipmap	sampler setting	servers/rendering/shader_language.cpp:398	#1829	TK_FILTER_LINEAR_MIPMAP				
filter_nearest_mipmap_anisotropic	sampler setting	servers/rendering/shader_language.cpp:399	#1829	TK_FILTER_NEAREST_MIPMAP_ANISOTROPIC				
filter_linear_mipmap_anisotropic	sampler setting	servers/rendering/shader_language.cpp:400	#1829	TK_FILTER_LINEAR_MIPMAP_ANISOTROPIC				
repeat_enable	sampler setting	servers/rendering/shader_language.cpp:401	#1829	TK_REPEAT_ENABLE				
repeat_disable	sampler setting	servers/rendering/shader_language.cpp:402	#1829	TK_REPEAT_DISABLE				
OP_EQUAL(bool,bool)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(bool,bool)	native	native
OP_EQUAL(bvec2,bvec2)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(bvec2,bvec2)	lowered: all(equal(a, b))	lowered: all(equal(a, b))
OP_EQUAL(bvec3,bvec3)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(bvec3,bvec3)	lowered: all(equal(a, b))	lowered: all(equal(a, b))
OP_EQUAL(bvec4,bvec4)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(bvec4,bvec4)	lowered: all(equal(a, b))	lowered: all(equal(a, b))
OP_EQUAL(int,int)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(int,int)	native	native
OP_EQUAL(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(ivec2,ivec2)	lowered: all(equal(a, b))	lowered: all(equal(a, b))
OP_EQUAL(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(ivec3,ivec3)	lowered: all(equal(a, b))	lowered: all(equal(a, b))
OP_EQUAL(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(ivec4,ivec4)	lowered: all(equal(a, b))	lowered: all(equal(a, b))
OP_EQUAL(uint,uint)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(uint,uint)	native	native
OP_EQUAL(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(uvec2,uvec2)	lowered: all(equal(a, b))	lowered: all(equal(a, b))
OP_EQUAL(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(uvec3,uvec3)	lowered: all(equal(a, b))	lowered: all(equal(a, b))
OP_EQUAL(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(uvec4,uvec4)	lowered: all(equal(a, b))	lowered: all(equal(a, b))
OP_EQUAL(float,float)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(float,float)	native	native
OP_EQUAL(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(vec2,vec2)	lowered: all(equal(a, b))	lowered: all(equal(a, b))
OP_EQUAL(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(vec3,vec3)	lowered: all(equal(a, b))	lowered: all(equal(a, b))
OP_EQUAL(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(vec4,vec4)	lowered: all(equal(a, b))	lowered: all(equal(a, b))
OP_EQUAL(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(mat2,mat2)	lowered: column by column	lowered: column by column
OP_EQUAL(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(mat3,mat3)	lowered: column by column	lowered: column by column
OP_EQUAL(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(mat4,mat4)	lowered: column by column	lowered: column by column
OP_NOT_EQUAL(bool,bool)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(bool,bool)	native	native
OP_NOT_EQUAL(bvec2,bvec2)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(bvec2,bvec2)	lowered: any(notEqual(a, b))	lowered: any(notEqual(a, b))
OP_NOT_EQUAL(bvec3,bvec3)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(bvec3,bvec3)	lowered: any(notEqual(a, b))	lowered: any(notEqual(a, b))
OP_NOT_EQUAL(bvec4,bvec4)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(bvec4,bvec4)	lowered: any(notEqual(a, b))	lowered: any(notEqual(a, b))
OP_NOT_EQUAL(int,int)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(int,int)	native	native
OP_NOT_EQUAL(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(ivec2,ivec2)	lowered: any(notEqual(a, b))	lowered: any(notEqual(a, b))
OP_NOT_EQUAL(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(ivec3,ivec3)	lowered: any(notEqual(a, b))	lowered: any(notEqual(a, b))
OP_NOT_EQUAL(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(ivec4,ivec4)	lowered: any(notEqual(a, b))	lowered: any(notEqual(a, b))
OP_NOT_EQUAL(uint,uint)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(uint,uint)	native	native
OP_NOT_EQUAL(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(uvec2,uvec2)	lowered: any(notEqual(a, b))	lowered: any(notEqual(a, b))
OP_NOT_EQUAL(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(uvec3,uvec3)	lowered: any(notEqual(a, b))	lowered: any(notEqual(a, b))
OP_NOT_EQUAL(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(uvec4,uvec4)	lowered: any(notEqual(a, b))	lowered: any(notEqual(a, b))
OP_NOT_EQUAL(float,float)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(float,float)	native	native
OP_NOT_EQUAL(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(vec2,vec2)	lowered: any(notEqual(a, b))	lowered: any(notEqual(a, b))
OP_NOT_EQUAL(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(vec3,vec3)	lowered: any(notEqual(a, b))	lowered: any(notEqual(a, b))
OP_NOT_EQUAL(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(vec4,vec4)	lowered: any(notEqual(a, b))	lowered: any(notEqual(a, b))
OP_NOT_EQUAL(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(mat2,mat2)	lowered: column by column	lowered: column by column
OP_NOT_EQUAL(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(mat3,mat3)	lowered: column by column	lowered: column by column
OP_NOT_EQUAL(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1565	#1823		bool	(mat4,mat4)	lowered: column by column	lowered: column by column
OP_LESS(int,int)	operator	servers/rendering/shader_language.cpp:1576	#1823		bool	(int,int)	native	native
OP_LESS(uint,uint)	operator	servers/rendering/shader_language.cpp:1576	#1823		bool	(uint,uint)	native	native
OP_LESS(float,float)	operator	servers/rendering/shader_language.cpp:1576	#1823		bool	(float,float)	native	native
OP_LESS_EQUAL(int,int)	operator	servers/rendering/shader_language.cpp:1576	#1823		bool	(int,int)	native	native
OP_LESS_EQUAL(uint,uint)	operator	servers/rendering/shader_language.cpp:1576	#1823		bool	(uint,uint)	native	native
OP_LESS_EQUAL(float,float)	operator	servers/rendering/shader_language.cpp:1576	#1823		bool	(float,float)	native	native
OP_GREATER(int,int)	operator	servers/rendering/shader_language.cpp:1576	#1823		bool	(int,int)	native	native
OP_GREATER(uint,uint)	operator	servers/rendering/shader_language.cpp:1576	#1823		bool	(uint,uint)	native	native
OP_GREATER(float,float)	operator	servers/rendering/shader_language.cpp:1576	#1823		bool	(float,float)	native	native
OP_GREATER_EQUAL(int,int)	operator	servers/rendering/shader_language.cpp:1576	#1823		bool	(int,int)	native	native
OP_GREATER_EQUAL(uint,uint)	operator	servers/rendering/shader_language.cpp:1576	#1823		bool	(uint,uint)	native	native
OP_GREATER_EQUAL(float,float)	operator	servers/rendering/shader_language.cpp:1576	#1823		bool	(float,float)	native	native
OP_AND(bool,bool)	operator	servers/rendering/shader_language.cpp:1591	#1823		bool	(bool,bool)	lowered: select	lowered: select
OP_OR(bool,bool)	operator	servers/rendering/shader_language.cpp:1591	#1823		bool	(bool,bool)	lowered: select	lowered: select
OP_NOT(bool)	operator	servers/rendering/shader_language.cpp:1604	#1823		bool	(bool)	native	native
OP_NEGATE(int)	operator	servers/rendering/shader_language.cpp:1614	#1823		int	(int)	native	native
OP_NEGATE(ivec2)	operator	servers/rendering/shader_language.cpp:1614	#1823		ivec2	(ivec2)	native	native
OP_NEGATE(ivec3)	operator	servers/rendering/shader_language.cpp:1614	#1823		ivec3	(ivec3)	native	native
OP_NEGATE(ivec4)	operator	servers/rendering/shader_language.cpp:1614	#1823		ivec4	(ivec4)	native	native
OP_NEGATE(uint)	operator	servers/rendering/shader_language.cpp:1614	#1823		uint	(uint)	native	native
OP_NEGATE(uvec2)	operator	servers/rendering/shader_language.cpp:1614	#1823		uvec2	(uvec2)	native	native
OP_NEGATE(uvec3)	operator	servers/rendering/shader_language.cpp:1614	#1823		uvec3	(uvec3)	native	native
OP_NEGATE(uvec4)	operator	servers/rendering/shader_language.cpp:1614	#1823		uvec4	(uvec4)	native	native
OP_NEGATE(float)	operator	servers/rendering/shader_language.cpp:1614	#1823		float	(float)	native	native
OP_NEGATE(vec2)	operator	servers/rendering/shader_language.cpp:1614	#1823		vec2	(vec2)	native	native
OP_NEGATE(vec3)	operator	servers/rendering/shader_language.cpp:1614	#1823		vec3	(vec3)	native	native
OP_NEGATE(vec4)	operator	servers/rendering/shader_language.cpp:1614	#1823		vec4	(vec4)	native	native
OP_ADD(int,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		int	(int,int)	native	native
OP_ADD(int,ivec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec2	(int,ivec2)	native	native
OP_ADD(int,ivec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec3	(int,ivec3)	native	native
OP_ADD(int,ivec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec4	(int,ivec4)	native	native
OP_ADD(ivec2,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec2	(ivec2,int)	native	native
OP_ADD(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec2	(ivec2,ivec2)	native	native
OP_ADD(ivec3,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec3	(ivec3,int)	native	native
OP_ADD(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec3	(ivec3,ivec3)	native	native
OP_ADD(ivec4,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec4	(ivec4,int)	native	native
OP_ADD(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec4	(ivec4,ivec4)	native	native
OP_ADD(uint,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uint	(uint,uint)	native	native
OP_ADD(uint,uvec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec2	(uint,uvec2)	native	native
OP_ADD(uint,uvec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec3	(uint,uvec3)	native	native
OP_ADD(uint,uvec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec4	(uint,uvec4)	native	native
OP_ADD(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec2	(uvec2,uint)	native	native
OP_ADD(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec2	(uvec2,uvec2)	native	native
OP_ADD(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec3	(uvec3,uint)	native	native
OP_ADD(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec3	(uvec3,uvec3)	native	native
OP_ADD(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec4	(uvec4,uint)	native	native
OP_ADD(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec4	(uvec4,uvec4)	native	native
OP_ADD(float,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		float	(float,float)	native	native
OP_ADD(float,vec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec2	(float,vec2)	native	native
OP_ADD(float,vec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec3	(float,vec3)	native	native
OP_ADD(float,vec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec4	(float,vec4)	native	native
OP_ADD(float,mat2)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat2	(float,mat2)	lowered: column by column	lowered: column by column
OP_ADD(float,mat3)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat3	(float,mat3)	lowered: column by column	lowered: column by column
OP_ADD(float,mat4)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat4	(float,mat4)	lowered: column by column	lowered: column by column
OP_ADD(vec2,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec2	(vec2,float)	native	native
OP_ADD(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec2	(vec2,vec2)	native	native
OP_ADD(vec3,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec3	(vec3,float)	native	native
OP_ADD(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec3	(vec3,vec3)	native	native
OP_ADD(vec4,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec4	(vec4,float)	native	native
OP_ADD(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec4	(vec4,vec4)	native	native
OP_ADD(mat2,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat2	(mat2,float)	lowered: column by column	lowered: column by column
OP_ADD(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat2	(mat2,mat2)	native	native
OP_ADD(mat3,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat3	(mat3,float)	lowered: column by column	lowered: column by column
OP_ADD(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat3	(mat3,mat3)	native	native
OP_ADD(mat4,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat4	(mat4,float)	lowered: column by column	lowered: column by column
OP_ADD(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat4	(mat4,mat4)	native	native
OP_SUB(int,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		int	(int,int)	native	native
OP_SUB(int,ivec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec2	(int,ivec2)	native	native
OP_SUB(int,ivec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec3	(int,ivec3)	native	native
OP_SUB(int,ivec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec4	(int,ivec4)	native	native
OP_SUB(ivec2,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec2	(ivec2,int)	native	native
OP_SUB(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec2	(ivec2,ivec2)	native	native
OP_SUB(ivec3,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec3	(ivec3,int)	native	native
OP_SUB(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec3	(ivec3,ivec3)	native	native
OP_SUB(ivec4,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec4	(ivec4,int)	native	native
OP_SUB(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec4	(ivec4,ivec4)	native	native
OP_SUB(uint,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uint	(uint,uint)	native	native
OP_SUB(uint,uvec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec2	(uint,uvec2)	native	native
OP_SUB(uint,uvec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec3	(uint,uvec3)	native	native
OP_SUB(uint,uvec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec4	(uint,uvec4)	native	native
OP_SUB(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec2	(uvec2,uint)	native	native
OP_SUB(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec2	(uvec2,uvec2)	native	native
OP_SUB(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec3	(uvec3,uint)	native	native
OP_SUB(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec3	(uvec3,uvec3)	native	native
OP_SUB(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec4	(uvec4,uint)	native	native
OP_SUB(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec4	(uvec4,uvec4)	native	native
OP_SUB(float,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		float	(float,float)	native	native
OP_SUB(float,vec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec2	(float,vec2)	native	native
OP_SUB(float,vec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec3	(float,vec3)	native	native
OP_SUB(float,vec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec4	(float,vec4)	native	native
OP_SUB(float,mat2)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat2	(float,mat2)	lowered: column by column	lowered: column by column
OP_SUB(float,mat3)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat3	(float,mat3)	lowered: column by column	lowered: column by column
OP_SUB(float,mat4)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat4	(float,mat4)	lowered: column by column	lowered: column by column
OP_SUB(vec2,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec2	(vec2,float)	native	native
OP_SUB(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec2	(vec2,vec2)	native	native
OP_SUB(vec3,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec3	(vec3,float)	native	native
OP_SUB(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec3	(vec3,vec3)	native	native
OP_SUB(vec4,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec4	(vec4,float)	native	native
OP_SUB(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec4	(vec4,vec4)	native	native
OP_SUB(mat2,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat2	(mat2,float)	lowered: column by column	lowered: column by column
OP_SUB(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat2	(mat2,mat2)	native	native
OP_SUB(mat3,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat3	(mat3,float)	lowered: column by column	lowered: column by column
OP_SUB(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat3	(mat3,mat3)	native	native
OP_SUB(mat4,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat4	(mat4,float)	lowered: column by column	lowered: column by column
OP_SUB(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat4	(mat4,mat4)	native	native
OP_MUL(int,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		int	(int,int)	native	native
OP_MUL(int,ivec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec2	(int,ivec2)	native	native
OP_MUL(int,ivec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec3	(int,ivec3)	native	native
OP_MUL(int,ivec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec4	(int,ivec4)	native	native
OP_MUL(ivec2,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec2	(ivec2,int)	native	native
OP_MUL(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec2	(ivec2,ivec2)	native	native
OP_MUL(ivec3,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec3	(ivec3,int)	native	native
OP_MUL(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec3	(ivec3,ivec3)	native	native
OP_MUL(ivec4,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec4	(ivec4,int)	native	native
OP_MUL(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec4	(ivec4,ivec4)	native	native
OP_MUL(uint,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uint	(uint,uint)	native	native
OP_MUL(uint,uvec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec2	(uint,uvec2)	native	native
OP_MUL(uint,uvec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec3	(uint,uvec3)	native	native
OP_MUL(uint,uvec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec4	(uint,uvec4)	native	native
OP_MUL(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec2	(uvec2,uint)	native	native
OP_MUL(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec2	(uvec2,uvec2)	native	native
OP_MUL(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec3	(uvec3,uint)	native	native
OP_MUL(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec3	(uvec3,uvec3)	native	native
OP_MUL(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec4	(uvec4,uint)	native	native
OP_MUL(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec4	(uvec4,uvec4)	native	native
OP_MUL(float,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		float	(float,float)	native	native
OP_MUL(float,vec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec2	(float,vec2)	native	native
OP_MUL(float,vec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec3	(float,vec3)	native	native
OP_MUL(float,vec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec4	(float,vec4)	native	native
OP_MUL(float,mat2)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat2	(float,mat2)	lowered: column by column	lowered: column by column
OP_MUL(float,mat3)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat3	(float,mat3)	lowered: column by column	lowered: column by column
OP_MUL(float,mat4)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat4	(float,mat4)	lowered: column by column	lowered: column by column
OP_MUL(vec2,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec2	(vec2,float)	native	native
OP_MUL(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec2	(vec2,vec2)	native	native
OP_MUL(vec2,mat2)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec2	(vec2,mat2)	native	native
OP_MUL(vec3,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec3	(vec3,float)	native	native
OP_MUL(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec3	(vec3,vec3)	native	native
OP_MUL(vec3,mat3)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec3	(vec3,mat3)	native	native
OP_MUL(vec4,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec4	(vec4,float)	native	native
OP_MUL(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec4	(vec4,vec4)	native	native
OP_MUL(vec4,mat4)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec4	(vec4,mat4)	native	native
OP_MUL(mat2,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat2	(mat2,float)	lowered: column by column	lowered: column by column
OP_MUL(mat2,vec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec2	(mat2,vec2)	native	native
OP_MUL(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat2	(mat2,mat2)	native	native
OP_MUL(mat3,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat3	(mat3,float)	lowered: column by column	lowered: column by column
OP_MUL(mat3,vec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec3	(mat3,vec3)	native	native
OP_MUL(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat3	(mat3,mat3)	native	native
OP_MUL(mat4,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat4	(mat4,float)	lowered: column by column	lowered: column by column
OP_MUL(mat4,vec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec4	(mat4,vec4)	native	native
OP_MUL(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat4	(mat4,mat4)	native	native
OP_DIV(int,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		int	(int,int)	native	native
OP_DIV(int,ivec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec2	(int,ivec2)	native	native
OP_DIV(int,ivec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec3	(int,ivec3)	native	native
OP_DIV(int,ivec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec4	(int,ivec4)	native	native
OP_DIV(ivec2,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec2	(ivec2,int)	native	native
OP_DIV(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec2	(ivec2,ivec2)	native	native
OP_DIV(ivec3,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec3	(ivec3,int)	native	native
OP_DIV(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec3	(ivec3,ivec3)	native	native
OP_DIV(ivec4,int)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec4	(ivec4,int)	native	native
OP_DIV(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		ivec4	(ivec4,ivec4)	native	native
OP_DIV(uint,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uint	(uint,uint)	native	native
OP_DIV(uint,uvec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec2	(uint,uvec2)	native	native
OP_DIV(uint,uvec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec3	(uint,uvec3)	native	native
OP_DIV(uint,uvec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec4	(uint,uvec4)	native	native
OP_DIV(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec2	(uvec2,uint)	native	native
OP_DIV(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec2	(uvec2,uvec2)	native	native
OP_DIV(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec3	(uvec3,uint)	native	native
OP_DIV(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec3	(uvec3,uvec3)	native	native
OP_DIV(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec4	(uvec4,uint)	native	native
OP_DIV(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		uvec4	(uvec4,uvec4)	native	native
OP_DIV(float,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		float	(float,float)	native	native
OP_DIV(float,vec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec2	(float,vec2)	native	native
OP_DIV(float,vec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec3	(float,vec3)	native	native
OP_DIV(float,vec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec4	(float,vec4)	native	native
OP_DIV(float,mat2)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat2	(float,mat2)	lowered: column by column	lowered: column by column
OP_DIV(float,mat3)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat3	(float,mat3)	lowered: column by column	lowered: column by column
OP_DIV(float,mat4)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat4	(float,mat4)	lowered: column by column	lowered: column by column
OP_DIV(vec2,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec2	(vec2,float)	native	native
OP_DIV(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec2	(vec2,vec2)	native	native
OP_DIV(vec3,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec3	(vec3,float)	native	native
OP_DIV(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec3	(vec3,vec3)	native	native
OP_DIV(vec4,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec4	(vec4,float)	native	native
OP_DIV(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1627	#1823		vec4	(vec4,vec4)	native	native
OP_DIV(mat2,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat2	(mat2,float)	lowered: product with the reciprocal	lowered: product with the reciprocal
OP_DIV(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat2	(mat2,mat2)	native	native
OP_DIV(mat3,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat3	(mat3,float)	lowered: product with the reciprocal	lowered: product with the reciprocal
OP_DIV(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat3	(mat3,mat3)	native	native
OP_DIV(mat4,float)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat4	(mat4,float)	lowered: product with the reciprocal	lowered: product with the reciprocal
OP_DIV(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1627	#1823		mat4	(mat4,mat4)	native	native
OP_MOD(int,int)	operator	servers/rendering/shader_language.cpp:1693	#1823		int	(int,int)	native	native
OP_MOD(ivec2,int)	operator	servers/rendering/shader_language.cpp:1693	#1823		ivec2	(ivec2,int)	native	native
OP_MOD(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1693	#1823		ivec2	(ivec2,ivec2)	native	native
OP_MOD(ivec3,int)	operator	servers/rendering/shader_language.cpp:1693	#1823		ivec3	(ivec3,int)	native	native
OP_MOD(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1693	#1823		ivec3	(ivec3,ivec3)	native	native
OP_MOD(ivec4,int)	operator	servers/rendering/shader_language.cpp:1693	#1823		ivec4	(ivec4,int)	native	native
OP_MOD(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1693	#1823		ivec4	(ivec4,ivec4)	native	native
OP_MOD(uint,uint)	operator	servers/rendering/shader_language.cpp:1693	#1823		uint	(uint,uint)	native	native
OP_MOD(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1693	#1823		uvec2	(uvec2,uint)	native	native
OP_MOD(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1693	#1823		uvec2	(uvec2,uvec2)	native	native
OP_MOD(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1693	#1823		uvec3	(uvec3,uint)	native	native
OP_MOD(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1693	#1823		uvec3	(uvec3,uvec3)	native	native
OP_MOD(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1693	#1823		uvec4	(uvec4,uint)	native	native
OP_MOD(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1693	#1823		uvec4	(uvec4,uvec4)	native	native
OP_SHIFT_LEFT(int,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		int	(int,int)	native	native
OP_SHIFT_LEFT(ivec2,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec2	(ivec2,int)	native	native
OP_SHIFT_LEFT(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec2	(ivec2,ivec2)	native	native
OP_SHIFT_LEFT(ivec3,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec3	(ivec3,int)	native	native
OP_SHIFT_LEFT(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec3	(ivec3,ivec3)	native	native
OP_SHIFT_LEFT(ivec4,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec4	(ivec4,int)	native	native
OP_SHIFT_LEFT(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec4	(ivec4,ivec4)	native	native
OP_SHIFT_LEFT(uint,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uint	(uint,uint)	native	native
OP_SHIFT_LEFT(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec2	(uvec2,uint)	native	native
OP_SHIFT_LEFT(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec2	(uvec2,uvec2)	native	native
OP_SHIFT_LEFT(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec3	(uvec3,uint)	native	native
OP_SHIFT_LEFT(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec3	(uvec3,uvec3)	native	native
OP_SHIFT_LEFT(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec4	(uvec4,uint)	native	native
OP_SHIFT_LEFT(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec4	(uvec4,uvec4)	native	native
OP_SHIFT_RIGHT(int,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		int	(int,int)	native	native
OP_SHIFT_RIGHT(ivec2,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec2	(ivec2,int)	native	native
OP_SHIFT_RIGHT(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec2	(ivec2,ivec2)	native	native
OP_SHIFT_RIGHT(ivec3,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec3	(ivec3,int)	native	native
OP_SHIFT_RIGHT(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec3	(ivec3,ivec3)	native	native
OP_SHIFT_RIGHT(ivec4,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec4	(ivec4,int)	native	native
OP_SHIFT_RIGHT(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec4	(ivec4,ivec4)	native	native
OP_SHIFT_RIGHT(uint,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uint	(uint,uint)	native	native
OP_SHIFT_RIGHT(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec2	(uvec2,uint)	native	native
OP_SHIFT_RIGHT(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec2	(uvec2,uvec2)	native	native
OP_SHIFT_RIGHT(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec3	(uvec3,uint)	native	native
OP_SHIFT_RIGHT(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec3	(uvec3,uvec3)	native	native
OP_SHIFT_RIGHT(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec4	(uvec4,uint)	native	native
OP_SHIFT_RIGHT(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec4	(uvec4,uvec4)	native	native
OP_ASSIGN(bool,bool)	operator	servers/rendering/shader_language.cpp:1810	#1823		bool	(bool,bool)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(bvec2,bvec2)	operator	servers/rendering/shader_language.cpp:1810	#1823		bvec2	(bvec2,bvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(bvec3,bvec3)	operator	servers/rendering/shader_language.cpp:1810	#1823		bvec3	(bvec3,bvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(bvec4,bvec4)	operator	servers/rendering/shader_language.cpp:1810	#1823		bvec4	(bvec4,bvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(int,int)	operator	servers/rendering/shader_language.cpp:1810	#1823		int	(int,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1810	#1823		ivec2	(ivec2,ivec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1810	#1823		ivec3	(ivec3,ivec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1810	#1823		ivec4	(ivec4,ivec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(uint,uint)	operator	servers/rendering/shader_language.cpp:1810	#1823		uint	(uint,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1810	#1823		uvec2	(uvec2,uvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1810	#1823		uvec3	(uvec3,uvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1810	#1823		uvec4	(uvec4,uvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(float,float)	operator	servers/rendering/shader_language.cpp:1810	#1823		float	(float,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1810	#1823		vec2	(vec2,vec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1810	#1823		vec3	(vec3,vec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1810	#1823		vec4	(vec4,vec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1810	#1823		mat2	(mat2,mat2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1810	#1823		mat3	(mat3,mat3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1810	#1823		mat4	(mat4,mat4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(int,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		int	(int,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(ivec2,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec2	(ivec2,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec2	(ivec2,ivec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(ivec3,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec3	(ivec3,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec3	(ivec3,ivec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(ivec4,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec4	(ivec4,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec4	(ivec4,ivec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(uint,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uint	(uint,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec2	(uvec2,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec2	(uvec2,uvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec3	(uvec3,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec3	(uvec3,uvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec4	(uvec4,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec4	(uvec4,uvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(float,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		float	(float,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(vec2,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec2	(vec2,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec2	(vec2,vec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(vec3,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec3	(vec3,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec3	(vec3,vec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(vec4,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec4	(vec4,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec4	(vec4,vec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(mat2,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat2	(mat2,float)	lowered: written to the argument value, column by column	lowered: written to the argument value, column by column
OP_ASSIGN_ADD(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat2	(mat2,mat2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(mat3,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat3	(mat3,float)	lowered: written to the argument value, column by column	lowered: written to the argument value, column by column
OP_ASSIGN_ADD(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat3	(mat3,mat3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_ADD(mat4,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat4	(mat4,float)	lowered: written to the argument value, column by column	lowered: written to the argument value, column by column
OP_ASSIGN_ADD(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat4	(mat4,mat4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(int,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		int	(int,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(ivec2,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec2	(ivec2,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec2	(ivec2,ivec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(ivec3,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec3	(ivec3,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec3	(ivec3,ivec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(ivec4,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec4	(ivec4,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec4	(ivec4,ivec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(uint,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uint	(uint,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec2	(uvec2,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec2	(uvec2,uvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec3	(uvec3,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec3	(uvec3,uvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec4	(uvec4,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec4	(uvec4,uvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(float,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		float	(float,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(vec2,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec2	(vec2,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec2	(vec2,vec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(vec3,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec3	(vec3,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec3	(vec3,vec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(vec4,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec4	(vec4,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec4	(vec4,vec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(mat2,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat2	(mat2,float)	lowered: written to the argument value, column by column	lowered: written to the argument value, column by column
OP_ASSIGN_SUB(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat2	(mat2,mat2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(mat3,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat3	(mat3,float)	lowered: written to the argument value, column by column	lowered: written to the argument value, column by column
OP_ASSIGN_SUB(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat3	(mat3,mat3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SUB(mat4,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat4	(mat4,float)	lowered: written to the argument value, column by column	lowered: written to the argument value, column by column
OP_ASSIGN_SUB(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat4	(mat4,mat4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(int,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		int	(int,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(ivec2,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec2	(ivec2,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec2	(ivec2,ivec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(ivec3,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec3	(ivec3,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec3	(ivec3,ivec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(ivec4,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec4	(ivec4,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec4	(ivec4,ivec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(uint,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uint	(uint,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec2	(uvec2,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec2	(uvec2,uvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec3	(uvec3,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec3	(uvec3,uvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec4	(uvec4,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec4	(uvec4,uvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(float,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		float	(float,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(vec2,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec2	(vec2,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec2	(vec2,vec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(vec2,mat2)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec2	(vec2,mat2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(vec3,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec3	(vec3,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec3	(vec3,vec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(vec3,mat3)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec3	(vec3,mat3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(vec4,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec4	(vec4,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec4	(vec4,vec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(vec4,mat4)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec4	(vec4,mat4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(mat2,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat2	(mat2,float)	lowered: written to the argument value, column by column	lowered: written to the argument value, column by column
OP_ASSIGN_MUL(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat2	(mat2,mat2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(mat3,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat3	(mat3,float)	lowered: written to the argument value, column by column	lowered: written to the argument value, column by column
OP_ASSIGN_MUL(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat3	(mat3,mat3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MUL(mat4,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat4	(mat4,float)	lowered: written to the argument value, column by column	lowered: written to the argument value, column by column
OP_ASSIGN_MUL(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat4	(mat4,mat4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(int,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		int	(int,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(ivec2,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec2	(ivec2,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec2	(ivec2,ivec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(ivec3,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec3	(ivec3,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec3	(ivec3,ivec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(ivec4,int)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec4	(ivec4,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1833	#1823		ivec4	(ivec4,ivec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(uint,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uint	(uint,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec2	(uvec2,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec2	(uvec2,uvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec3	(uvec3,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec3	(uvec3,uvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec4	(uvec4,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1833	#1823		uvec4	(uvec4,uvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(float,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		float	(float,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(vec2,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec2	(vec2,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec2	(vec2,vec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(vec3,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec3	(vec3,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec3	(vec3,vec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(vec4,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec4	(vec4,float)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1833	#1823		vec4	(vec4,vec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(mat2,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat2	(mat2,float)	lowered: written to the argument value, product with the reciprocal	lowered: written to the argument value, product with the reciprocal
OP_ASSIGN_DIV(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat2	(mat2,mat2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(mat3,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat3	(mat3,float)	lowered: written to the argument value, product with the reciprocal	lowered: written to the argument value, product with the reciprocal
OP_ASSIGN_DIV(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat3	(mat3,mat3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_DIV(mat4,float)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat4	(mat4,float)	lowered: written to the argument value, product with the reciprocal	lowered: written to the argument value, product with the reciprocal
OP_ASSIGN_DIV(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1833	#1823		mat4	(mat4,mat4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MOD(int,int)	operator	servers/rendering/shader_language.cpp:1693	#1823		int	(int,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MOD(ivec2,int)	operator	servers/rendering/shader_language.cpp:1693	#1823		ivec2	(ivec2,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MOD(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1693	#1823		ivec2	(ivec2,ivec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MOD(ivec3,int)	operator	servers/rendering/shader_language.cpp:1693	#1823		ivec3	(ivec3,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MOD(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1693	#1823		ivec3	(ivec3,ivec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MOD(ivec4,int)	operator	servers/rendering/shader_language.cpp:1693	#1823		ivec4	(ivec4,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MOD(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1693	#1823		ivec4	(ivec4,ivec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MOD(uint,uint)	operator	servers/rendering/shader_language.cpp:1693	#1823		uint	(uint,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MOD(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1693	#1823		uvec2	(uvec2,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MOD(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1693	#1823		uvec2	(uvec2,uvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MOD(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1693	#1823		uvec3	(uvec3,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MOD(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1693	#1823		uvec3	(uvec3,uvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MOD(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1693	#1823		uvec4	(uvec4,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_MOD(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1693	#1823		uvec4	(uvec4,uvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_LEFT(int,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		int	(int,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_LEFT(ivec2,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec2	(ivec2,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_LEFT(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec2	(ivec2,ivec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_LEFT(ivec3,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec3	(ivec3,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_LEFT(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec3	(ivec3,ivec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_LEFT(ivec4,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec4	(ivec4,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_LEFT(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec4	(ivec4,ivec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_LEFT(uint,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uint	(uint,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_LEFT(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec2	(uvec2,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_LEFT(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec2	(uvec2,uvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_LEFT(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec3	(uvec3,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_LEFT(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec3	(uvec3,uvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_LEFT(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec4	(uvec4,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_LEFT(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec4	(uvec4,uvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_RIGHT(int,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		int	(int,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_RIGHT(ivec2,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec2	(ivec2,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_RIGHT(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec2	(ivec2,ivec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_RIGHT(ivec3,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec3	(ivec3,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_RIGHT(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec3	(ivec3,ivec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_RIGHT(ivec4,int)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec4	(ivec4,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_RIGHT(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1755	#1823		ivec4	(ivec4,ivec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_RIGHT(uint,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uint	(uint,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_RIGHT(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec2	(uvec2,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_RIGHT(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec2	(uvec2,uvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_RIGHT(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec3	(uvec3,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_RIGHT(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec3	(uvec3,uvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_RIGHT(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec4	(uvec4,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_SHIFT_RIGHT(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1755	#1823		uvec4	(uvec4,uvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_AND(int,int)	operator	servers/rendering/shader_language.cpp:1902	#1823		int	(int,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_AND(ivec2,int)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec2	(ivec2,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_AND(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec2	(ivec2,ivec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_AND(ivec3,int)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec3	(ivec3,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_AND(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec3	(ivec3,ivec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_AND(ivec4,int)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec4	(ivec4,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_AND(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec4	(ivec4,ivec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_AND(uint,uint)	operator	servers/rendering/shader_language.cpp:1902	#1823		uint	(uint,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_AND(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec2	(uvec2,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_AND(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec2	(uvec2,uvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_AND(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec3	(uvec3,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_AND(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec3	(uvec3,uvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_AND(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec4	(uvec4,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_AND(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec4	(uvec4,uvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_OR(int,int)	operator	servers/rendering/shader_language.cpp:1902	#1823		int	(int,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_OR(ivec2,int)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec2	(ivec2,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_OR(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec2	(ivec2,ivec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_OR(ivec3,int)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec3	(ivec3,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_OR(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec3	(ivec3,ivec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_OR(ivec4,int)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec4	(ivec4,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_OR(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec4	(ivec4,ivec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_OR(uint,uint)	operator	servers/rendering/shader_language.cpp:1902	#1823		uint	(uint,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_OR(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec2	(uvec2,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_OR(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec2	(uvec2,uvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_OR(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec3	(uvec3,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_OR(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec3	(uvec3,uvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_OR(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec4	(uvec4,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_OR(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec4	(uvec4,uvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_XOR(int,int)	operator	servers/rendering/shader_language.cpp:1902	#1823		int	(int,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_XOR(ivec2,int)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec2	(ivec2,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_XOR(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec2	(ivec2,ivec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_XOR(ivec3,int)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec3	(ivec3,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_XOR(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec3	(ivec3,ivec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_XOR(ivec4,int)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec4	(ivec4,int)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_XOR(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec4	(ivec4,ivec4)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_XOR(uint,uint)	operator	servers/rendering/shader_language.cpp:1902	#1823		uint	(uint,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_XOR(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec2	(uvec2,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_XOR(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec2	(uvec2,uvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_XOR(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec3	(uvec3,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_XOR(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec3	(uvec3,uvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_XOR(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec4	(uvec4,uint)	lowered: written to the argument value	lowered: written to the argument value
OP_ASSIGN_BIT_XOR(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec4	(uvec4,uvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_BIT_AND(int,int)	operator	servers/rendering/shader_language.cpp:1902	#1823		int	(int,int)	native	native
OP_BIT_AND(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec2	(ivec2,ivec2)	native	native
OP_BIT_AND(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec3	(ivec3,ivec3)	native	native
OP_BIT_AND(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec4	(ivec4,ivec4)	native	native
OP_BIT_AND(uint,uint)	operator	servers/rendering/shader_language.cpp:1902	#1823		uint	(uint,uint)	native	native
OP_BIT_AND(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec2	(uvec2,uvec2)	native	native
OP_BIT_AND(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec3	(uvec3,uvec3)	native	native
OP_BIT_AND(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec4	(uvec4,uvec4)	native	native
OP_BIT_OR(int,int)	operator	servers/rendering/shader_language.cpp:1902	#1823		int	(int,int)	native	native
OP_BIT_OR(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec2	(ivec2,ivec2)	native	native
OP_BIT_OR(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec3	(ivec3,ivec3)	native	native
OP_BIT_OR(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec4	(ivec4,ivec4)	native	native
OP_BIT_OR(uint,uint)	operator	servers/rendering/shader_language.cpp:1902	#1823		uint	(uint,uint)	native	native
OP_BIT_OR(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec2	(uvec2,uvec2)	native	native
OP_BIT_OR(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec3	(uvec3,uvec3)	native	native
OP_BIT_OR(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec4	(uvec4,uvec4)	native	native
OP_BIT_XOR(int,int)	operator	servers/rendering/shader_language.cpp:1902	#1823		int	(int,int)	native	native
OP_BIT_XOR(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec2	(ivec2,ivec2)	native	native
OP_BIT_XOR(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec3	(ivec3,ivec3)	native	native
OP_BIT_XOR(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1902	#1823		ivec4	(ivec4,ivec4)	native	native
OP_BIT_XOR(uint,uint)	operator	servers/rendering/shader_language.cpp:1902	#1823		uint	(uint,uint)	native	native
OP_BIT_XOR(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec2	(uvec2,uvec2)	native	native
OP_BIT_XOR(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec3	(uvec3,uvec3)	native	native
OP_BIT_XOR(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1902	#1823		uvec4	(uvec4,uvec4)	native	native
OP_BIT_INVERT(int)	operator	servers/rendering/shader_language.cpp:1981	#1823		int	(int)	native	native
OP_BIT_INVERT(ivec2)	operator	servers/rendering/shader_language.cpp:1981	#1823		ivec2	(ivec2)	native	native
OP_BIT_INVERT(ivec3)	operator	servers/rendering/shader_language.cpp:1981	#1823		ivec3	(ivec3)	native	native
OP_BIT_INVERT(ivec4)	operator	servers/rendering/shader_language.cpp:1981	#1823		ivec4	(ivec4)	native	native
OP_BIT_INVERT(uint)	operator	servers/rendering/shader_language.cpp:1981	#1823		uint	(uint)	native	native
OP_BIT_INVERT(uvec2)	operator	servers/rendering/shader_language.cpp:1981	#1823		uvec2	(uvec2)	native	native
OP_BIT_INVERT(uvec3)	operator	servers/rendering/shader_language.cpp:1981	#1823		uvec3	(uvec3)	native	native
OP_BIT_INVERT(uvec4)	operator	servers/rendering/shader_language.cpp:1981	#1823		uvec4	(uvec4)	native	native
OP_INCREMENT(int)	operator	servers/rendering/shader_language.cpp:1614	#1823		int	(int)	lowered: written to the argument value	lowered: written to the argument value
OP_INCREMENT(ivec2)	operator	servers/rendering/shader_language.cpp:1614	#1823		ivec2	(ivec2)	lowered: written to the argument value	lowered: written to the argument value
OP_INCREMENT(ivec3)	operator	servers/rendering/shader_language.cpp:1614	#1823		ivec3	(ivec3)	lowered: written to the argument value	lowered: written to the argument value
OP_INCREMENT(ivec4)	operator	servers/rendering/shader_language.cpp:1614	#1823		ivec4	(ivec4)	lowered: written to the argument value	lowered: written to the argument value
OP_INCREMENT(uint)	operator	servers/rendering/shader_language.cpp:1614	#1823		uint	(uint)	lowered: written to the argument value	lowered: written to the argument value
OP_INCREMENT(uvec2)	operator	servers/rendering/shader_language.cpp:1614	#1823		uvec2	(uvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_INCREMENT(uvec3)	operator	servers/rendering/shader_language.cpp:1614	#1823		uvec3	(uvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_INCREMENT(uvec4)	operator	servers/rendering/shader_language.cpp:1614	#1823		uvec4	(uvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_INCREMENT(float)	operator	servers/rendering/shader_language.cpp:1614	#1823		float	(float)	lowered: written to the argument value	lowered: written to the argument value
OP_INCREMENT(vec2)	operator	servers/rendering/shader_language.cpp:1614	#1823		vec2	(vec2)	lowered: written to the argument value	lowered: written to the argument value
OP_INCREMENT(vec3)	operator	servers/rendering/shader_language.cpp:1614	#1823		vec3	(vec3)	lowered: written to the argument value	lowered: written to the argument value
OP_INCREMENT(vec4)	operator	servers/rendering/shader_language.cpp:1614	#1823		vec4	(vec4)	lowered: written to the argument value	lowered: written to the argument value
OP_DECREMENT(int)	operator	servers/rendering/shader_language.cpp:1614	#1823		int	(int)	lowered: written to the argument value	lowered: written to the argument value
OP_DECREMENT(ivec2)	operator	servers/rendering/shader_language.cpp:1614	#1823		ivec2	(ivec2)	lowered: written to the argument value	lowered: written to the argument value
OP_DECREMENT(ivec3)	operator	servers/rendering/shader_language.cpp:1614	#1823		ivec3	(ivec3)	lowered: written to the argument value	lowered: written to the argument value
OP_DECREMENT(ivec4)	operator	servers/rendering/shader_language.cpp:1614	#1823		ivec4	(ivec4)	lowered: written to the argument value	lowered: written to the argument value
OP_DECREMENT(uint)	operator	servers/rendering/shader_language.cpp:1614	#1823		uint	(uint)	lowered: written to the argument value	lowered: written to the argument value
OP_DECREMENT(uvec2)	operator	servers/rendering/shader_language.cpp:1614	#1823		uvec2	(uvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_DECREMENT(uvec3)	operator	servers/rendering/shader_language.cpp:1614	#1823		uvec3	(uvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_DECREMENT(uvec4)	operator	servers/rendering/shader_language.cpp:1614	#1823		uvec4	(uvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_DECREMENT(float)	operator	servers/rendering/shader_language.cpp:1614	#1823		float	(float)	lowered: written to the argument value	lowered: written to the argument value
OP_DECREMENT(vec2)	operator	servers/rendering/shader_language.cpp:1614	#1823		vec2	(vec2)	lowered: written to the argument value	lowered: written to the argument value
OP_DECREMENT(vec3)	operator	servers/rendering/shader_language.cpp:1614	#1823		vec3	(vec3)	lowered: written to the argument value	lowered: written to the argument value
OP_DECREMENT(vec4)	operator	servers/rendering/shader_language.cpp:1614	#1823		vec4	(vec4)	lowered: written to the argument value	lowered: written to the argument value
OP_SELECT_IF(bool,bool,bool)	operator	servers/rendering/shader_language.cpp:1990	#1823		bool	(bool,bool,bool)	native	native
OP_SELECT_IF(bool,bvec2,bvec2)	operator	servers/rendering/shader_language.cpp:1990	#1823		bvec2	(bool,bvec2,bvec2)	native	native
OP_SELECT_IF(bool,bvec3,bvec3)	operator	servers/rendering/shader_language.cpp:1990	#1823		bvec3	(bool,bvec3,bvec3)	native	native
OP_SELECT_IF(bool,bvec4,bvec4)	operator	servers/rendering/shader_language.cpp:1990	#1823		bvec4	(bool,bvec4,bvec4)	native	native
OP_SELECT_IF(bool,int,int)	operator	servers/rendering/shader_language.cpp:1990	#1823		int	(bool,int,int)	native	native
OP_SELECT_IF(bool,ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1990	#1823		ivec2	(bool,ivec2,ivec2)	native	native
OP_SELECT_IF(bool,ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1990	#1823		ivec3	(bool,ivec3,ivec3)	native	native
OP_SELECT_IF(bool,ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1990	#1823		ivec4	(bool,ivec4,ivec4)	native	native
OP_SELECT_IF(bool,uint,uint)	operator	servers/rendering/shader_language.cpp:1990	#1823		uint	(bool,uint,uint)	native	native
OP_SELECT_IF(bool,uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1990	#1823		uvec2	(bool,uvec2,uvec2)	native	native
OP_SELECT_IF(bool,uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1990	#1823		uvec3	(bool,uvec3,uvec3)	native	native
OP_SELECT_IF(bool,uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1990	#1823		uvec4	(bool,uvec4,uvec4)	native	native
OP_SELECT_IF(bool,float,float)	operator	servers/rendering/shader_language.cpp:1990	#1823		float	(bool,float,float)	native	native
OP_SELECT_IF(bool,vec2,vec2)	operator	servers/rendering/shader_language.cpp:1990	#1823		vec2	(bool,vec2,vec2)	native	native
OP_SELECT_IF(bool,vec3,vec3)	operator	servers/rendering/shader_language.cpp:1990	#1823		vec3	(bool,vec3,vec3)	native	native
OP_SELECT_IF(bool,vec4,vec4)	operator	servers/rendering/shader_language.cpp:1990	#1823		vec4	(bool,vec4,vec4)	native	native
OP_SELECT_IF(bool,mat2,mat2)	operator	servers/rendering/shader_language.cpp:1990	#1823		mat2	(bool,mat2,mat2)	native	native
OP_SELECT_IF(bool,mat3,mat3)	operator	servers/rendering/shader_language.cpp:1990	#1823		mat3	(bool,mat3,mat3)	native	native
OP_SELECT_IF(bool,mat4,mat4)	operator	servers/rendering/shader_language.cpp:1990	#1823		mat4	(bool,mat4,mat4)	native	native
OP_SELECT_ELSE	operator	servers/rendering/shader_language.cpp:1558	#1823				native	native
OP_POST_INCREMENT(int)	operator	servers/rendering/shader_language.cpp:1614	#1823		int	(int)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_INCREMENT(ivec2)	operator	servers/rendering/shader_language.cpp:1614	#1823		ivec2	(ivec2)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_INCREMENT(ivec3)	operator	servers/rendering/shader_language.cpp:1614	#1823		ivec3	(ivec3)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_INCREMENT(ivec4)	operator	servers/rendering/shader_language.cpp:1614	#1823		ivec4	(ivec4)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_INCREMENT(uint)	operator	servers/rendering/shader_language.cpp:1614	#1823		uint	(uint)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_INCREMENT(uvec2)	operator	servers/rendering/shader_language.cpp:1614	#1823		uvec2	(uvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_INCREMENT(uvec3)	operator	servers/rendering/shader_language.cpp:1614	#1823		uvec3	(uvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_INCREMENT(uvec4)	operator	servers/rendering/shader_language.cpp:1614	#1823		uvec4	(uvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_INCREMENT(float)	operator	servers/rendering/shader_language.cpp:1614	#1823		float	(float)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_INCREMENT(vec2)	operator	servers/rendering/shader_language.cpp:1614	#1823		vec2	(vec2)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_INCREMENT(vec3)	operator	servers/rendering/shader_language.cpp:1614	#1823		vec3	(vec3)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_INCREMENT(vec4)	operator	servers/rendering/shader_language.cpp:1614	#1823		vec4	(vec4)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_DECREMENT(int)	operator	servers/rendering/shader_language.cpp:1614	#1823		int	(int)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_DECREMENT(ivec2)	operator	servers/rendering/shader_language.cpp:1614	#1823		ivec2	(ivec2)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_DECREMENT(ivec3)	operator	servers/rendering/shader_language.cpp:1614	#1823		ivec3	(ivec3)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_DECREMENT(ivec4)	operator	servers/rendering/shader_language.cpp:1614	#1823		ivec4	(ivec4)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_DECREMENT(uint)	operator	servers/rendering/shader_language.cpp:1614	#1823		uint	(uint)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_DECREMENT(uvec2)	operator	servers/rendering/shader_language.cpp:1614	#1823		uvec2	(uvec2)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_DECREMENT(uvec3)	operator	servers/rendering/shader_language.cpp:1614	#1823		uvec3	(uvec3)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_DECREMENT(uvec4)	operator	servers/rendering/shader_language.cpp:1614	#1823		uvec4	(uvec4)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_DECREMENT(float)	operator	servers/rendering/shader_language.cpp:1614	#1823		float	(float)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_DECREMENT(vec2)	operator	servers/rendering/shader_language.cpp:1614	#1823		vec2	(vec2)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_DECREMENT(vec3)	operator	servers/rendering/shader_language.cpp:1614	#1823		vec3	(vec3)	lowered: written to the argument value	lowered: written to the argument value
OP_POST_DECREMENT(vec4)	operator	servers/rendering/shader_language.cpp:1614	#1823		vec4	(vec4)	lowered: written to the argument value	lowered: written to the argument value
OP_CALL	operator	servers/rendering/shader_language.cpp:1558	#1825				native	native
OP_CONSTRUCT	operator	servers/rendering/shader_language.cpp:1558	#1823				native	native
OP_STRUCT	operator	servers/rendering/shader_language.cpp:1558	#1824				native	native
OP_INDEX	operator	servers/rendering/shader_language.cpp:1558	#1823				native	native
OP_EMPTY	operator	servers/rendering/shader_language.cpp:1558	#1823				native	native
FLOW_OP_IF	statement	servers/rendering/shader_language.h:307	#1824				native	native
FLOW_OP_RETURN	statement	servers/rendering/shader_language.h:308	#1823				native	native
FLOW_OP_FOR	statement	servers/rendering/shader_language.h:309	#1824				native	native
FLOW_OP_WHILE	statement	servers/rendering/shader_language.h:310	#1824				native	native
FLOW_OP_DO	statement	servers/rendering/shader_language.h:311	#1824				native	native
FLOW_OP_BREAK	statement	servers/rendering/shader_language.h:312	#1824				native	native
FLOW_OP_SWITCH	statement	servers/rendering/shader_language.h:313	#1824				native	native
FLOW_OP_CASE	statement	servers/rendering/shader_language.h:314	#1824				native	native
FLOW_OP_DEFAULT	statement	servers/rendering/shader_language.h:315	#1824				native	native
FLOW_OP_CONTINUE	statement	servers/rendering/shader_language.h:316	#1824				native	native
FLOW_OP_DISCARD	statement	servers/rendering/shader_language.h:317	#1824				native	native
NODE_TYPE_SHADER	tree node	servers/rendering/shader_language.h:373	#1794					
NODE_TYPE_FUNCTION	tree node	servers/rendering/shader_language.h:374	#1794					
NODE_TYPE_BLOCK	tree node	servers/rendering/shader_language.h:375	#1824				native	native
NODE_TYPE_VARIABLE	tree node	servers/rendering/shader_language.h:376	#1823				native	native
NODE_TYPE_VARIABLE_DECLARATION	tree node	servers/rendering/shader_language.h:377	#1824				native	native
NODE_TYPE_CONSTANT	tree node	servers/rendering/shader_language.h:378	#1823				native	native
NODE_TYPE_OPERATOR	tree node	servers/rendering/shader_language.h:379	#1823				native	native
NODE_TYPE_CONTROL_FLOW	tree node	servers/rendering/shader_language.h:380	#1824				native	native
NODE_TYPE_MEMBER	tree node	servers/rendering/shader_language.h:381	#1823				native	native
NODE_TYPE_ARRAY	tree node	servers/rendering/shader_language.h:382	#1824				native	native
NODE_TYPE_ARRAY_CONSTRUCT	tree node	servers/rendering/shader_language.h:383	#1824				native	native
NODE_TYPE_STRUCT	tree node	servers/rendering/shader_language.h:384	#1824				native	native
bvec2(bool)	constructor	servers/rendering/shader_language.cpp:2422	#1823		bvec2	(bool)	native	native
bvec2(bool,bool)	constructor	servers/rendering/shader_language.cpp:2423	#1823		bvec2	(bool,bool)	native	native
bvec3(bool)	constructor	servers/rendering/shader_language.cpp:2424	#1823		bvec3	(bool)	native	native
bvec3(bool,bool,bool)	constructor	servers/rendering/shader_language.cpp:2425	#1823		bvec3	(bool,bool,bool)	native	native
bvec3(bvec2,bool)	constructor	servers/rendering/shader_language.cpp:2426	#1823		bvec3	(bvec2,bool)	native	native
bvec3(bool,bvec2)	constructor	servers/rendering/shader_language.cpp:2427	#1823		bvec3	(bool,bvec2)	native	native
bvec4(bool)	constructor	servers/rendering/shader_language.cpp:2428	#1823		bvec4	(bool)	native	native
bvec4(bool,bool,bool,bool)	constructor	servers/rendering/shader_language.cpp:2429	#1823		bvec4	(bool,bool,bool,bool)	native	native
bvec4(bool,bvec2,bool)	constructor	servers/rendering/shader_language.cpp:2430	#1823		bvec4	(bool,bvec2,bool)	native	native
bvec4(bvec2,bool,bool)	constructor	servers/rendering/shader_language.cpp:2431	#1823		bvec4	(bvec2,bool,bool)	native	native
bvec4(bool,bool,bvec2)	constructor	servers/rendering/shader_language.cpp:2432	#1823		bvec4	(bool,bool,bvec2)	native	native
bvec4(bool,bvec3)	constructor	servers/rendering/shader_language.cpp:2433	#1823		bvec4	(bool,bvec3)	native	native
bvec4(bvec3,bool)	constructor	servers/rendering/shader_language.cpp:2434	#1823		bvec4	(bvec3,bool)	native	native
bvec4(bvec2,bvec2)	constructor	servers/rendering/shader_language.cpp:2435	#1823		bvec4	(bvec2,bvec2)	native	native
vec2(float)	constructor	servers/rendering/shader_language.cpp:2437	#1823		vec2	(float)	native	native
vec2(float,float)	constructor	servers/rendering/shader_language.cpp:2438	#1823		vec2	(float,float)	native	native
vec3(float)	constructor	servers/rendering/shader_language.cpp:2439	#1823		vec3	(float)	native	native
vec3(float,float,float)	constructor	servers/rendering/shader_language.cpp:2440	#1823		vec3	(float,float,float)	native	native
vec3(vec2,float)	constructor	servers/rendering/shader_language.cpp:2441	#1823		vec3	(vec2,float)	native	native
vec3(float,vec2)	constructor	servers/rendering/shader_language.cpp:2442	#1823		vec3	(float,vec2)	native	native
vec4(float)	constructor	servers/rendering/shader_language.cpp:2443	#1823		vec4	(float)	native	native
vec4(float,float,float,float)	constructor	servers/rendering/shader_language.cpp:2444	#1823		vec4	(float,float,float,float)	native	native
vec4(float,vec2,float)	constructor	servers/rendering/shader_language.cpp:2445	#1823		vec4	(float,vec2,float)	native	native
vec4(vec2,float,float)	constructor	servers/rendering/shader_language.cpp:2446	#1823		vec4	(vec2,float,float)	native	native
vec4(float,float,vec2)	constructor	servers/rendering/shader_language.cpp:2447	#1823		vec4	(float,float,vec2)	native	native
vec4(float,vec3)	constructor	servers/rendering/shader_language.cpp:2448	#1823		vec4	(float,vec3)	native	native
vec4(vec3,float)	constructor	servers/rendering/shader_language.cpp:2449	#1823		vec4	(vec3,float)	native	native
vec4(vec2,vec2)	constructor	servers/rendering/shader_language.cpp:2450	#1823		vec4	(vec2,vec2)	native	native
ivec2(int)	constructor	servers/rendering/shader_language.cpp:2452	#1823		ivec2	(int)	native	native
ivec2(int,int)	constructor	servers/rendering/shader_language.cpp:2453	#1823		ivec2	(int,int)	native	native
ivec3(int)	constructor	servers/rendering/shader_language.cpp:2454	#1823		ivec3	(int)	native	native
ivec3(int,int,int)	constructor	servers/rendering/shader_language.cpp:2455	#1823		ivec3	(int,int,int)	native	native
ivec3(ivec2,int)	constructor	servers/rendering/shader_language.cpp:2456	#1823		ivec3	(ivec2,int)	native	native
ivec3(int,ivec2)	constructor	servers/rendering/shader_language.cpp:2457	#1823		ivec3	(int,ivec2)	native	native
ivec4(int)	constructor	servers/rendering/shader_language.cpp:2458	#1823		ivec4	(int)	native	native
ivec4(int,int,int,int)	constructor	servers/rendering/shader_language.cpp:2459	#1823		ivec4	(int,int,int,int)	native	native
ivec4(int,ivec2,int)	constructor	servers/rendering/shader_language.cpp:2460	#1823		ivec4	(int,ivec2,int)	native	native
ivec4(ivec2,int,int)	constructor	servers/rendering/shader_language.cpp:2461	#1823		ivec4	(ivec2,int,int)	native	native
ivec4(int,int,ivec2)	constructor	servers/rendering/shader_language.cpp:2462	#1823		ivec4	(int,int,ivec2)	native	native
ivec4(int,ivec3)	constructor	servers/rendering/shader_language.cpp:2463	#1823		ivec4	(int,ivec3)	native	native
ivec4(ivec3,int)	constructor	servers/rendering/shader_language.cpp:2464	#1823		ivec4	(ivec3,int)	native	native
ivec4(ivec2,ivec2)	constructor	servers/rendering/shader_language.cpp:2465	#1823		ivec4	(ivec2,ivec2)	native	native
uvec2(uint)	constructor	servers/rendering/shader_language.cpp:2467	#1823		uvec2	(uint)	native	native
uvec2(uint,uint)	constructor	servers/rendering/shader_language.cpp:2468	#1823		uvec2	(uint,uint)	native	native
uvec3(uint)	constructor	servers/rendering/shader_language.cpp:2469	#1823		uvec3	(uint)	native	native
uvec3(uint,uint,uint)	constructor	servers/rendering/shader_language.cpp:2470	#1823		uvec3	(uint,uint,uint)	native	native
uvec3(uvec2,uint)	constructor	servers/rendering/shader_language.cpp:2471	#1823		uvec3	(uvec2,uint)	native	native
uvec3(uint,uvec2)	constructor	servers/rendering/shader_language.cpp:2472	#1823		uvec3	(uint,uvec2)	native	native
uvec4(uint)	constructor	servers/rendering/shader_language.cpp:2473	#1823		uvec4	(uint)	native	native
uvec4(uint,uint,uint,uint)	constructor	servers/rendering/shader_language.cpp:2474	#1823		uvec4	(uint,uint,uint,uint)	native	native
uvec4(uint,uvec2,uint)	constructor	servers/rendering/shader_language.cpp:2475	#1823		uvec4	(uint,uvec2,uint)	native	native
uvec4(uvec2,uint,uint)	constructor	servers/rendering/shader_language.cpp:2476	#1823		uvec4	(uvec2,uint,uint)	native	native
uvec4(uint,uint,uvec2)	constructor	servers/rendering/shader_language.cpp:2477	#1823		uvec4	(uint,uint,uvec2)	native	native
uvec4(uint,uvec3)	constructor	servers/rendering/shader_language.cpp:2478	#1823		uvec4	(uint,uvec3)	native	native
uvec4(uvec3,uint)	constructor	servers/rendering/shader_language.cpp:2479	#1823		uvec4	(uvec3,uint)	native	native
uvec4(uvec2,uvec2)	constructor	servers/rendering/shader_language.cpp:2480	#1823		uvec4	(uvec2,uvec2)	native	native
mat2(vec2,vec2)	constructor	servers/rendering/shader_language.cpp:2482	#1823		mat2	(vec2,vec2)	native	native
mat3(vec3,vec3,vec3)	constructor	servers/rendering/shader_language.cpp:2483	#1823		mat3	(vec3,vec3,vec3)	native	native
mat4(vec4,vec4,vec4,vec4)	constructor	servers/rendering/shader_language.cpp:2484	#1823		mat4	(vec4,vec4,vec4,vec4)	native	native
mat2(float)	constructor	servers/rendering/shader_language.cpp:2486	#1823		mat2	(float)	lowered: diagonal of columns	lowered: diagonal of columns
mat3(float)	constructor	servers/rendering/shader_language.cpp:2487	#1823		mat3	(float)	lowered: diagonal of columns	lowered: diagonal of columns
mat4(float)	constructor	servers/rendering/shader_language.cpp:2488	#1823		mat4	(float)	lowered: diagonal of columns	lowered: diagonal of columns
int(bool)	function	servers/rendering/shader_language.cpp:2492	#1823		int	(bool)	native	native
int(int)	function	servers/rendering/shader_language.cpp:2493	#1823		int	(int)	native	native
int(uint)	function	servers/rendering/shader_language.cpp:2494	#1823		int	(uint)	native	native
int(float)	function	servers/rendering/shader_language.cpp:2495	#1823		int	(float)	native	native
float(bool)	function	servers/rendering/shader_language.cpp:2497	#1823		float	(bool)	native	native
float(int)	function	servers/rendering/shader_language.cpp:2498	#1823		float	(int)	native	native
float(uint)	function	servers/rendering/shader_language.cpp:2499	#1823		float	(uint)	native	native
float(float)	function	servers/rendering/shader_language.cpp:2500	#1823		float	(float)	native	native
uint(bool)	function	servers/rendering/shader_language.cpp:2502	#1823		uint	(bool)	native	native
uint(int)	function	servers/rendering/shader_language.cpp:2503	#1823		uint	(int)	native	native
uint(uint)	function	servers/rendering/shader_language.cpp:2504	#1823		uint	(uint)	native	native
uint(float)	function	servers/rendering/shader_language.cpp:2505	#1823		uint	(float)	native	native
bool(bool)	function	servers/rendering/shader_language.cpp:2507	#1823		bool	(bool)	native	native
bool(int)	function	servers/rendering/shader_language.cpp:2508	#1823		bool	(int)	native	native
bool(uint)	function	servers/rendering/shader_language.cpp:2509	#1823		bool	(uint)	native	native
bool(float)	function	servers/rendering/shader_language.cpp:2510	#1823		bool	(float)	native	native
ivec2(bvec2)	function	servers/rendering/shader_language.cpp:2514	#1826		ivec2	(bvec2)		
ivec2(ivec2)	function	servers/rendering/shader_language.cpp:2515	#1826		ivec2	(ivec2)		
ivec2(uvec2)	function	servers/rendering/shader_language.cpp:2516	#1826		ivec2	(uvec2)		
ivec2(vec2)	function	servers/rendering/shader_language.cpp:2517	#1826		ivec2	(vec2)		
vec2(bvec2)	function	servers/rendering/shader_language.cpp:2519	#1826		vec2	(bvec2)		
vec2(ivec2)	function	servers/rendering/shader_language.cpp:2520	#1826		vec2	(ivec2)		
vec2(uvec2)	function	servers/rendering/shader_language.cpp:2521	#1826		vec2	(uvec2)		
vec2(vec2)	function	servers/rendering/shader_language.cpp:2522	#1826		vec2	(vec2)		
uvec2(bvec2)	function	servers/rendering/shader_language.cpp:2524	#1826		uvec2	(bvec2)		
uvec2(ivec2)	function	servers/rendering/shader_language.cpp:2525	#1826		uvec2	(ivec2)		
uvec2(uvec2)	function	servers/rendering/shader_language.cpp:2526	#1826		uvec2	(uvec2)		
uvec2(vec2)	function	servers/rendering/shader_language.cpp:2527	#1826		uvec2	(vec2)		
bvec2(bvec2)	function	servers/rendering/shader_language.cpp:2529	#1826		bvec2	(bvec2)		
bvec2(ivec2)	function	servers/rendering/shader_language.cpp:2530	#1826		bvec2	(ivec2)		
bvec2(uvec2)	function	servers/rendering/shader_language.cpp:2531	#1826		bvec2	(uvec2)		
bvec2(vec2)	function	servers/rendering/shader_language.cpp:2532	#1826		bvec2	(vec2)		
ivec3(bvec3)	function	servers/rendering/shader_language.cpp:2534	#1826		ivec3	(bvec3)		
ivec3(ivec3)	function	servers/rendering/shader_language.cpp:2535	#1826		ivec3	(ivec3)		
ivec3(uvec3)	function	servers/rendering/shader_language.cpp:2536	#1826		ivec3	(uvec3)		
ivec3(vec3)	function	servers/rendering/shader_language.cpp:2537	#1826		ivec3	(vec3)		
vec3(bvec3)	function	servers/rendering/shader_language.cpp:2539	#1826		vec3	(bvec3)		
vec3(ivec3)	function	servers/rendering/shader_language.cpp:2540	#1826		vec3	(ivec3)		
vec3(uvec3)	function	servers/rendering/shader_language.cpp:2541	#1826		vec3	(uvec3)		
vec3(vec3)	function	servers/rendering/shader_language.cpp:2542	#1826		vec3	(vec3)		
uvec3(bvec3)	function	servers/rendering/shader_language.cpp:2544	#1826		uvec3	(bvec3)		
uvec3(ivec3)	function	servers/rendering/shader_language.cpp:2545	#1826		uvec3	(ivec3)		
uvec3(uvec3)	function	servers/rendering/shader_language.cpp:2546	#1826		uvec3	(uvec3)		
uvec3(vec3)	function	servers/rendering/shader_language.cpp:2547	#1826		uvec3	(vec3)		
bvec3(bvec3)	function	servers/rendering/shader_language.cpp:2549	#1826		bvec3	(bvec3)		
bvec3(ivec3)	function	servers/rendering/shader_language.cpp:2550	#1826		bvec3	(ivec3)		
bvec3(uvec3)	function	servers/rendering/shader_language.cpp:2551	#1826		bvec3	(uvec3)		
bvec3(vec3)	function	servers/rendering/shader_language.cpp:2552	#1826		bvec3	(vec3)		
ivec4(bvec4)	function	servers/rendering/shader_language.cpp:2554	#1826		ivec4	(bvec4)		
ivec4(ivec4)	function	servers/rendering/shader_language.cpp:2555	#1826		ivec4	(ivec4)		
ivec4(uvec4)	function	servers/rendering/shader_language.cpp:2556	#1826		ivec4	(uvec4)		
ivec4(vec4)	function	servers/rendering/shader_language.cpp:2557	#1826		ivec4	(vec4)		
vec4(bvec4)	function	servers/rendering/shader_language.cpp:2559	#1826		vec4	(bvec4)		
vec4(ivec4)	function	servers/rendering/shader_language.cpp:2560	#1826		vec4	(ivec4)		
vec4(uvec4)	function	servers/rendering/shader_language.cpp:2561	#1826		vec4	(uvec4)		
vec4(vec4)	function	servers/rendering/shader_language.cpp:2562	#1826		vec4	(vec4)		
uvec4(bvec4)	function	servers/rendering/shader_language.cpp:2564	#1826		uvec4	(bvec4)		
uvec4(ivec4)	function	servers/rendering/shader_language.cpp:2565	#1826		uvec4	(ivec4)		
uvec4(uvec4)	function	servers/rendering/shader_language.cpp:2566	#1826		uvec4	(uvec4)		
uvec4(vec4)	function	servers/rendering/shader_language.cpp:2567	#1826		uvec4	(vec4)		
bvec4(bvec4)	function	servers/rendering/shader_language.cpp:2569	#1826		bvec4	(bvec4)		
bvec4(ivec4)	function	servers/rendering/shader_language.cpp:2570	#1826		bvec4	(ivec4)		
bvec4(uvec4)	function	servers/rendering/shader_language.cpp:2571	#1826		bvec4	(uvec4)		
bvec4(vec4)	function	servers/rendering/shader_language.cpp:2572	#1826		bvec4	(vec4)		
mat2(mat3)	function	servers/rendering/shader_language.cpp:2576	#1826		mat2	(mat3)		
mat2(mat4)	function	servers/rendering/shader_language.cpp:2577	#1826		mat2	(mat4)		
mat3(mat2)	function	servers/rendering/shader_language.cpp:2578	#1826		mat3	(mat2)		
mat3(mat4)	function	servers/rendering/shader_language.cpp:2579	#1826		mat3	(mat4)		
mat4(mat2)	function	servers/rendering/shader_language.cpp:2580	#1826		mat4	(mat2)		
mat4(mat3)	function	servers/rendering/shader_language.cpp:2581	#1826		mat4	(mat3)		
radians(float)	function	servers/rendering/shader_language.cpp:2586	#1826		float	(float)		
radians(vec2)	function	servers/rendering/shader_language.cpp:2587	#1826		vec2	(vec2)		
radians(vec3)	function	servers/rendering/shader_language.cpp:2588	#1826		vec3	(vec3)		
radians(vec4)	function	servers/rendering/shader_language.cpp:2589	#1826		vec4	(vec4)		
degrees(float)	function	servers/rendering/shader_language.cpp:2593	#1826		float	(float)		
degrees(vec2)	function	servers/rendering/shader_language.cpp:2594	#1826		vec2	(vec2)		
degrees(vec3)	function	servers/rendering/shader_language.cpp:2595	#1826		vec3	(vec3)		
degrees(vec4)	function	servers/rendering/shader_language.cpp:2596	#1826		vec4	(vec4)		
sin(float)	function	servers/rendering/shader_language.cpp:2600	#1826		float	(float)		
sin(vec2)	function	servers/rendering/shader_language.cpp:2601	#1826		vec2	(vec2)		
sin(vec3)	function	servers/rendering/shader_language.cpp:2602	#1826		vec3	(vec3)		
sin(vec4)	function	servers/rendering/shader_language.cpp:2603	#1826		vec4	(vec4)		
cos(float)	function	servers/rendering/shader_language.cpp:2607	#1826		float	(float)		
cos(vec2)	function	servers/rendering/shader_language.cpp:2608	#1826		vec2	(vec2)		
cos(vec3)	function	servers/rendering/shader_language.cpp:2609	#1826		vec3	(vec3)		
cos(vec4)	function	servers/rendering/shader_language.cpp:2610	#1826		vec4	(vec4)		
tan(float)	function	servers/rendering/shader_language.cpp:2614	#1826		float	(float)		
tan(vec2)	function	servers/rendering/shader_language.cpp:2615	#1826		vec2	(vec2)		
tan(vec3)	function	servers/rendering/shader_language.cpp:2616	#1826		vec3	(vec3)		
tan(vec4)	function	servers/rendering/shader_language.cpp:2617	#1826		vec4	(vec4)		
asin(float)	function	servers/rendering/shader_language.cpp:2621	#1826		float	(float)		
asin(vec2)	function	servers/rendering/shader_language.cpp:2622	#1826		vec2	(vec2)		
asin(vec3)	function	servers/rendering/shader_language.cpp:2623	#1826		vec3	(vec3)		
asin(vec4)	function	servers/rendering/shader_language.cpp:2624	#1826		vec4	(vec4)		
acos(float)	function	servers/rendering/shader_language.cpp:2628	#1826		float	(float)		
acos(vec2)	function	servers/rendering/shader_language.cpp:2629	#1826		vec2	(vec2)		
acos(vec3)	function	servers/rendering/shader_language.cpp:2630	#1826		vec3	(vec3)		
acos(vec4)	function	servers/rendering/shader_language.cpp:2631	#1826		vec4	(vec4)		
atan(float)	function	servers/rendering/shader_language.cpp:2635	#1826		float	(float)		
atan(vec2)	function	servers/rendering/shader_language.cpp:2636	#1826		vec2	(vec2)		
atan(vec3)	function	servers/rendering/shader_language.cpp:2637	#1826		vec3	(vec3)		
atan(vec4)	function	servers/rendering/shader_language.cpp:2638	#1826		vec4	(vec4)		
atan(float,float)	function	servers/rendering/shader_language.cpp:2639	#1826		float	(float,float)		
atan(vec2,vec2)	function	servers/rendering/shader_language.cpp:2640	#1826		vec2	(vec2,vec2)		
atan(vec3,vec3)	function	servers/rendering/shader_language.cpp:2641	#1826		vec3	(vec3,vec3)		
atan(vec4,vec4)	function	servers/rendering/shader_language.cpp:2642	#1826		vec4	(vec4,vec4)		
sinh(float)	function	servers/rendering/shader_language.cpp:2646	#1826		float	(float)		
sinh(vec2)	function	servers/rendering/shader_language.cpp:2647	#1826		vec2	(vec2)		
sinh(vec3)	function	servers/rendering/shader_language.cpp:2648	#1826		vec3	(vec3)		
sinh(vec4)	function	servers/rendering/shader_language.cpp:2649	#1826		vec4	(vec4)		
cosh(float)	function	servers/rendering/shader_language.cpp:2653	#1826		float	(float)		
cosh(vec2)	function	servers/rendering/shader_language.cpp:2654	#1826		vec2	(vec2)		
cosh(vec3)	function	servers/rendering/shader_language.cpp:2655	#1826		vec3	(vec3)		
cosh(vec4)	function	servers/rendering/shader_language.cpp:2656	#1826		vec4	(vec4)		
tanh(float)	function	servers/rendering/shader_language.cpp:2660	#1826		float	(float)		
tanh(vec2)	function	servers/rendering/shader_language.cpp:2661	#1826		vec2	(vec2)		
tanh(vec3)	function	servers/rendering/shader_language.cpp:2662	#1826		vec3	(vec3)		
tanh(vec4)	function	servers/rendering/shader_language.cpp:2663	#1826		vec4	(vec4)		
asinh(float)	function	servers/rendering/shader_language.cpp:2667	#1826		float	(float)		
asinh(vec2)	function	servers/rendering/shader_language.cpp:2668	#1826		vec2	(vec2)		
asinh(vec3)	function	servers/rendering/shader_language.cpp:2669	#1826		vec3	(vec3)		
asinh(vec4)	function	servers/rendering/shader_language.cpp:2670	#1826		vec4	(vec4)		
acosh(float)	function	servers/rendering/shader_language.cpp:2674	#1826		float	(float)		
acosh(vec2)	function	servers/rendering/shader_language.cpp:2675	#1826		vec2	(vec2)		
acosh(vec3)	function	servers/rendering/shader_language.cpp:2676	#1826		vec3	(vec3)		
acosh(vec4)	function	servers/rendering/shader_language.cpp:2677	#1826		vec4	(vec4)		
atanh(float)	function	servers/rendering/shader_language.cpp:2681	#1826		float	(float)		
atanh(vec2)	function	servers/rendering/shader_language.cpp:2682	#1826		vec2	(vec2)		
atanh(vec3)	function	servers/rendering/shader_language.cpp:2683	#1826		vec3	(vec3)		
atanh(vec4)	function	servers/rendering/shader_language.cpp:2684	#1826		vec4	(vec4)		
pow(float,float)	function	servers/rendering/shader_language.cpp:2689	#1826		float	(float,float)		
pow(vec2,vec2)	function	servers/rendering/shader_language.cpp:2690	#1826		vec2	(vec2,vec2)		
pow(vec3,vec3)	function	servers/rendering/shader_language.cpp:2691	#1826		vec3	(vec3,vec3)		
pow(vec4,vec4)	function	servers/rendering/shader_language.cpp:2692	#1826		vec4	(vec4,vec4)		
exp(float)	function	servers/rendering/shader_language.cpp:2696	#1826		float	(float)		
exp(vec2)	function	servers/rendering/shader_language.cpp:2697	#1826		vec2	(vec2)		
exp(vec3)	function	servers/rendering/shader_language.cpp:2698	#1826		vec3	(vec3)		
exp(vec4)	function	servers/rendering/shader_language.cpp:2699	#1826		vec4	(vec4)		
log(float)	function	servers/rendering/shader_language.cpp:2703	#1826		float	(float)		
log(vec2)	function	servers/rendering/shader_language.cpp:2704	#1826		vec2	(vec2)		
log(vec3)	function	servers/rendering/shader_language.cpp:2705	#1826		vec3	(vec3)		
log(vec4)	function	servers/rendering/shader_language.cpp:2706	#1826		vec4	(vec4)		
exp2(float)	function	servers/rendering/shader_language.cpp:2710	#1826		float	(float)		
exp2(vec2)	function	servers/rendering/shader_language.cpp:2711	#1826		vec2	(vec2)		
exp2(vec3)	function	servers/rendering/shader_language.cpp:2712	#1826		vec3	(vec3)		
exp2(vec4)	function	servers/rendering/shader_language.cpp:2713	#1826		vec4	(vec4)		
log2(float)	function	servers/rendering/shader_language.cpp:2717	#1826		float	(float)		
log2(vec2)	function	servers/rendering/shader_language.cpp:2718	#1826		vec2	(vec2)		
log2(vec3)	function	servers/rendering/shader_language.cpp:2719	#1826		vec3	(vec3)		
log2(vec4)	function	servers/rendering/shader_language.cpp:2720	#1826		vec4	(vec4)		
sqrt(float)	function	servers/rendering/shader_language.cpp:2724	#1826		float	(float)		
sqrt(vec2)	function	servers/rendering/shader_language.cpp:2725	#1826		vec2	(vec2)		
sqrt(vec3)	function	servers/rendering/shader_language.cpp:2726	#1826		vec3	(vec3)		
sqrt(vec4)	function	servers/rendering/shader_language.cpp:2727	#1826		vec4	(vec4)		
inversesqrt(float)	function	servers/rendering/shader_language.cpp:2731	#1826		float	(float)		
inversesqrt(vec2)	function	servers/rendering/shader_language.cpp:2732	#1826		vec2	(vec2)		
inversesqrt(vec3)	function	servers/rendering/shader_language.cpp:2733	#1826		vec3	(vec3)		
inversesqrt(vec4)	function	servers/rendering/shader_language.cpp:2734	#1826		vec4	(vec4)		
abs(float)	function	servers/rendering/shader_language.cpp:2739	#1826		float	(float)		
abs(vec2)	function	servers/rendering/shader_language.cpp:2740	#1826		vec2	(vec2)		
abs(vec3)	function	servers/rendering/shader_language.cpp:2741	#1826		vec3	(vec3)		
abs(vec4)	function	servers/rendering/shader_language.cpp:2742	#1826		vec4	(vec4)		
abs(int)	function	servers/rendering/shader_language.cpp:2744	#1826		int	(int)		
abs(ivec2)	function	servers/rendering/shader_language.cpp:2745	#1826		ivec2	(ivec2)		
abs(ivec3)	function	servers/rendering/shader_language.cpp:2746	#1826		ivec3	(ivec3)		
abs(ivec4)	function	servers/rendering/shader_language.cpp:2747	#1826		ivec4	(ivec4)		
sign(float)	function	servers/rendering/shader_language.cpp:2751	#1826		float	(float)		
sign(vec2)	function	servers/rendering/shader_language.cpp:2752	#1826		vec2	(vec2)		
sign(vec3)	function	servers/rendering/shader_language.cpp:2753	#1826		vec3	(vec3)		
sign(vec4)	function	servers/rendering/shader_language.cpp:2754	#1826		vec4	(vec4)		
sign(int)	function	servers/rendering/shader_language.cpp:2756	#1826		int	(int)		
sign(ivec2)	function	servers/rendering/shader_language.cpp:2757	#1826		ivec2	(ivec2)		
sign(ivec3)	function	servers/rendering/shader_language.cpp:2758	#1826		ivec3	(ivec3)		
sign(ivec4)	function	servers/rendering/shader_language.cpp:2759	#1826		ivec4	(ivec4)		
floor(float)	function	servers/rendering/shader_language.cpp:2763	#1826		float	(float)		
floor(vec2)	function	servers/rendering/shader_language.cpp:2764	#1826		vec2	(vec2)		
floor(vec3)	function	servers/rendering/shader_language.cpp:2765	#1826		vec3	(vec3)		
floor(vec4)	function	servers/rendering/shader_language.cpp:2766	#1826		vec4	(vec4)		
trunc(float)	function	servers/rendering/shader_language.cpp:2770	#1826		float	(float)		
trunc(vec2)	function	servers/rendering/shader_language.cpp:2771	#1826		vec2	(vec2)		
trunc(vec3)	function	servers/rendering/shader_language.cpp:2772	#1826		vec3	(vec3)		
trunc(vec4)	function	servers/rendering/shader_language.cpp:2773	#1826		vec4	(vec4)		
round(float)	function	servers/rendering/shader_language.cpp:2777	#1826		float	(float)		
round(vec2)	function	servers/rendering/shader_language.cpp:2778	#1826		vec2	(vec2)		
round(vec3)	function	servers/rendering/shader_language.cpp:2779	#1826		vec3	(vec3)		
round(vec4)	function	servers/rendering/shader_language.cpp:2780	#1826		vec4	(vec4)		
roundEven(float)	function	servers/rendering/shader_language.cpp:2784	#1826		float	(float)		
roundEven(vec2)	function	servers/rendering/shader_language.cpp:2785	#1826		vec2	(vec2)		
roundEven(vec3)	function	servers/rendering/shader_language.cpp:2786	#1826		vec3	(vec3)		
roundEven(vec4)	function	servers/rendering/shader_language.cpp:2787	#1826		vec4	(vec4)		
ceil(float)	function	servers/rendering/shader_language.cpp:2791	#1826		float	(float)		
ceil(vec2)	function	servers/rendering/shader_language.cpp:2792	#1826		vec2	(vec2)		
ceil(vec3)	function	servers/rendering/shader_language.cpp:2793	#1826		vec3	(vec3)		
ceil(vec4)	function	servers/rendering/shader_language.cpp:2794	#1826		vec4	(vec4)		
fract(float)	function	servers/rendering/shader_language.cpp:2798	#1826		float	(float)		
fract(vec2)	function	servers/rendering/shader_language.cpp:2799	#1826		vec2	(vec2)		
fract(vec3)	function	servers/rendering/shader_language.cpp:2800	#1826		vec3	(vec3)		
fract(vec4)	function	servers/rendering/shader_language.cpp:2801	#1826		vec4	(vec4)		
mod(float,float)	function	servers/rendering/shader_language.cpp:2805	#1826		float	(float,float)		
mod(vec2,vec2)	function	servers/rendering/shader_language.cpp:2806	#1826		vec2	(vec2,vec2)		
mod(vec2,float)	function	servers/rendering/shader_language.cpp:2807	#1826		vec2	(vec2,float)		
mod(vec3,vec3)	function	servers/rendering/shader_language.cpp:2808	#1826		vec3	(vec3,vec3)		
mod(vec3,float)	function	servers/rendering/shader_language.cpp:2809	#1826		vec3	(vec3,float)		
mod(vec4,vec4)	function	servers/rendering/shader_language.cpp:2810	#1826		vec4	(vec4,vec4)		
mod(vec4,float)	function	servers/rendering/shader_language.cpp:2811	#1826		vec4	(vec4,float)		
modf(float,float)	function	servers/rendering/shader_language.cpp:2815	#1826		float	(float,float)		
modf(vec2,vec2)	function	servers/rendering/shader_language.cpp:2816	#1826		vec2	(vec2,vec2)		
modf(vec3,vec3)	function	servers/rendering/shader_language.cpp:2817	#1826		vec3	(vec3,vec3)		
modf(vec4,vec4)	function	servers/rendering/shader_language.cpp:2818	#1826		vec4	(vec4,vec4)		
min(float,float)	function	servers/rendering/shader_language.cpp:2822	#1826		float	(float,float)		
min(vec2,vec2)	function	servers/rendering/shader_language.cpp:2823	#1826		vec2	(vec2,vec2)		
min(vec2,float)	function	servers/rendering/shader_language.cpp:2824	#1826		vec2	(vec2,float)		
min(vec3,vec3)	function	servers/rendering/shader_language.cpp:2825	#1826		vec3	(vec3,vec3)		
min(vec3,float)	function	servers/rendering/shader_language.cpp:2826	#1826		vec3	(vec3,float)		
min(vec4,vec4)	function	servers/rendering/shader_language.cpp:2827	#1826		vec4	(vec4,vec4)		
min(vec4,float)	function	servers/rendering/shader_language.cpp:2828	#1826		vec4	(vec4,float)		
min(int,int)	function	servers/rendering/shader_language.cpp:2830	#1826		int	(int,int)		
min(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:2831	#1826		ivec2	(ivec2,ivec2)		
min(ivec2,int)	function	servers/rendering/shader_language.cpp:2832	#1826		ivec2	(ivec2,int)		
min(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:2833	#1826		ivec3	(ivec3,ivec3)		
min(ivec3,int)	function	servers/rendering/shader_language.cpp:2834	#1826		ivec3	(ivec3,int)		
min(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:2835	#1826		ivec4	(ivec4,ivec4)		
min(ivec4,int)	function	servers/rendering/shader_language.cpp:2836	#1826		ivec4	(ivec4,int)		
min(uint,uint)	function	servers/rendering/shader_language.cpp:2838	#1826		uint	(uint,uint)		
min(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:2839	#1826		uvec2	(uvec2,uvec2)		
min(uvec2,uint)	function	servers/rendering/shader_language.cpp:2840	#1826		uvec2	(uvec2,uint)		
min(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:2841	#1826		uvec3	(uvec3,uvec3)		
min(uvec3,uint)	function	servers/rendering/shader_language.cpp:2842	#1826		uvec3	(uvec3,uint)		
min(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:2843	#1826		uvec4	(uvec4,uvec4)		
min(uvec4,uint)	function	servers/rendering/shader_language.cpp:2844	#1826		uvec4	(uvec4,uint)		
max(float,float)	function	servers/rendering/shader_language.cpp:2848	#1826		float	(float,float)		
max(vec2,vec2)	function	servers/rendering/shader_language.cpp:2849	#1826		vec2	(vec2,vec2)		
max(vec2,float)	function	servers/rendering/shader_language.cpp:2850	#1826		vec2	(vec2,float)		
max(vec3,vec3)	function	servers/rendering/shader_language.cpp:2851	#1826		vec3	(vec3,vec3)		
max(vec3,float)	function	servers/rendering/shader_language.cpp:2852	#1826		vec3	(vec3,float)		
max(vec4,vec4)	function	servers/rendering/shader_language.cpp:2853	#1826		vec4	(vec4,vec4)		
max(vec4,float)	function	servers/rendering/shader_language.cpp:2854	#1826		vec4	(vec4,float)		
max(int,int)	function	servers/rendering/shader_language.cpp:2856	#1826		int	(int,int)		
max(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:2857	#1826		ivec2	(ivec2,ivec2)		
max(ivec2,int)	function	servers/rendering/shader_language.cpp:2858	#1826		ivec2	(ivec2,int)		
max(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:2859	#1826		ivec3	(ivec3,ivec3)		
max(ivec3,int)	function	servers/rendering/shader_language.cpp:2860	#1826		ivec3	(ivec3,int)		
max(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:2861	#1826		ivec4	(ivec4,ivec4)		
max(ivec4,int)	function	servers/rendering/shader_language.cpp:2862	#1826		ivec4	(ivec4,int)		
max(uint,uint)	function	servers/rendering/shader_language.cpp:2864	#1826		uint	(uint,uint)		
max(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:2865	#1826		uvec2	(uvec2,uvec2)		
max(uvec2,uint)	function	servers/rendering/shader_language.cpp:2866	#1826		uvec2	(uvec2,uint)		
max(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:2867	#1826		uvec3	(uvec3,uvec3)		
max(uvec3,uint)	function	servers/rendering/shader_language.cpp:2868	#1826		uvec3	(uvec3,uint)		
max(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:2869	#1826		uvec4	(uvec4,uvec4)		
max(uvec4,uint)	function	servers/rendering/shader_language.cpp:2870	#1826		uvec4	(uvec4,uint)		
clamp(float,float,float)	function	servers/rendering/shader_language.cpp:2874	#1826		float	(float,float,float)		
clamp(vec2,vec2,vec2)	function	servers/rendering/shader_language.cpp:2875	#1826		vec2	(vec2,vec2,vec2)		
clamp(vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:2876	#1826		vec3	(vec3,vec3,vec3)		
clamp(vec4,vec4,vec4)	function	servers/rendering/shader_language.cpp:2877	#1826		vec4	(vec4,vec4,vec4)		
clamp(vec2,float,float)	function	servers/rendering/shader_language.cpp:2878	#1826		vec2	(vec2,float,float)		
clamp(vec3,float,float)	function	servers/rendering/shader_language.cpp:2879	#1826		vec3	(vec3,float,float)		
clamp(vec4,float,float)	function	servers/rendering/shader_language.cpp:2880	#1826		vec4	(vec4,float,float)		
clamp(int,int,int)	function	servers/rendering/shader_language.cpp:2882	#1826		int	(int,int,int)		
clamp(ivec2,ivec2,ivec2)	function	servers/rendering/shader_language.cpp:2883	#1826		ivec2	(ivec2,ivec2,ivec2)		
clamp(ivec3,ivec3,ivec3)	function	servers/rendering/shader_language.cpp:2884	#1826		ivec3	(ivec3,ivec3,ivec3)		
clamp(ivec4,ivec4,ivec4)	function	servers/rendering/shader_language.cpp:2885	#1826		ivec4	(ivec4,ivec4,ivec4)		
clamp(ivec2,int,int)	function	servers/rendering/shader_language.cpp:2886	#1826		ivec2	(ivec2,int,int)		
clamp(ivec3,int,int)	function	servers/rendering/shader_language.cpp:2887	#1826		ivec3	(ivec3,int,int)		
clamp(ivec4,int,int)	function	servers/rendering/shader_language.cpp:2888	#1826		ivec4	(ivec4,int,int)		
clamp(uint,uint,uint)	function	servers/rendering/shader_language.cpp:2890	#1826		uint	(uint,uint,uint)		
clamp(uvec2,uvec2,uvec2)	function	servers/rendering/shader_language.cpp:2891	#1826		uvec2	(uvec2,uvec2,uvec2)		
clamp(uvec3,uvec3,uvec3)	function	servers/rendering/shader_language.cpp:2892	#1826		uvec3	(uvec3,uvec3,uvec3)		
clamp(uvec4,uvec4,uvec4)	function	servers/rendering/shader_language.cpp:2893	#1826		uvec4	(uvec4,uvec4,uvec4)		
clamp(uvec2,uint,uint)	function	servers/rendering/shader_language.cpp:2894	#1826		uvec2	(uvec2,uint,uint)		
clamp(uvec3,uint,uint)	function	servers/rendering/shader_language.cpp:2895	#1826		uvec3	(uvec3,uint,uint)		
clamp(uvec4,uint,uint)	function	servers/rendering/shader_language.cpp:2896	#1826		uvec4	(uvec4,uint,uint)		
mix(float,float,float)	function	servers/rendering/shader_language.cpp:2900	#1826		float	(float,float,float)		
mix(vec2,vec2,float)	function	servers/rendering/shader_language.cpp:2901	#1826		vec2	(vec2,vec2,float)		
mix(vec2,vec2,bvec2)	function	servers/rendering/shader_language.cpp:2902	#1826		vec2	(vec2,vec2,bvec2)		
mix(vec2,vec2,vec2)	function	servers/rendering/shader_language.cpp:2903	#1826		vec2	(vec2,vec2,vec2)		
mix(vec3,vec3,float)	function	servers/rendering/shader_language.cpp:2904	#1826		vec3	(vec3,vec3,float)		
mix(vec3,vec3,bvec3)	function	servers/rendering/shader_language.cpp:2905	#1826		vec3	(vec3,vec3,bvec3)		
mix(vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:2906	#1826		vec3	(vec3,vec3,vec3)		
mix(vec4,vec4,float)	function	servers/rendering/shader_language.cpp:2907	#1826		vec4	(vec4,vec4,float)		
mix(vec4,vec4,bvec4)	function	servers/rendering/shader_language.cpp:2908	#1826		vec4	(vec4,vec4,bvec4)		
mix(vec4,vec4,vec4)	function	servers/rendering/shader_language.cpp:2909	#1826		vec4	(vec4,vec4,vec4)		
step(float,float)	function	servers/rendering/shader_language.cpp:2913	#1826		float	(float,float)		
step(vec2,vec2)	function	servers/rendering/shader_language.cpp:2914	#1826		vec2	(vec2,vec2)		
step(vec3,vec3)	function	servers/rendering/shader_language.cpp:2915	#1826		vec3	(vec3,vec3)		
step(vec4,vec4)	function	servers/rendering/shader_language.cpp:2916	#1826		vec4	(vec4,vec4)		
step(float,vec2)	function	servers/rendering/shader_language.cpp:2917	#1826		vec2	(float,vec2)		
step(float,vec3)	function	servers/rendering/shader_language.cpp:2918	#1826		vec3	(float,vec3)		
step(float,vec4)	function	servers/rendering/shader_language.cpp:2919	#1826		vec4	(float,vec4)		
smoothstep(float,float,float)	function	servers/rendering/shader_language.cpp:2923	#1826		float	(float,float,float)		
smoothstep(vec2,vec2,vec2)	function	servers/rendering/shader_language.cpp:2924	#1826		vec2	(vec2,vec2,vec2)		
smoothstep(vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:2925	#1826		vec3	(vec3,vec3,vec3)		
smoothstep(vec4,vec4,vec4)	function	servers/rendering/shader_language.cpp:2926	#1826		vec4	(vec4,vec4,vec4)		
smoothstep(float,float,vec2)	function	servers/rendering/shader_language.cpp:2927	#1826		vec2	(float,float,vec2)		
smoothstep(float,float,vec3)	function	servers/rendering/shader_language.cpp:2928	#1826		vec3	(float,float,vec3)		
smoothstep(float,float,vec4)	function	servers/rendering/shader_language.cpp:2929	#1826		vec4	(float,float,vec4)		
isnan(float)	function	servers/rendering/shader_language.cpp:2933	#1826		bool	(float)		
isnan(vec2)	function	servers/rendering/shader_language.cpp:2934	#1826		bvec2	(vec2)		
isnan(vec3)	function	servers/rendering/shader_language.cpp:2935	#1826		bvec3	(vec3)		
isnan(vec4)	function	servers/rendering/shader_language.cpp:2936	#1826		bvec4	(vec4)		
isinf(float)	function	servers/rendering/shader_language.cpp:2940	#1826		bool	(float)		
isinf(vec2)	function	servers/rendering/shader_language.cpp:2941	#1826		bvec2	(vec2)		
isinf(vec3)	function	servers/rendering/shader_language.cpp:2942	#1826		bvec3	(vec3)		
isinf(vec4)	function	servers/rendering/shader_language.cpp:2943	#1826		bvec4	(vec4)		
floatBitsToInt(float)	function	servers/rendering/shader_language.cpp:2947	#1827		int	(float)		
floatBitsToInt(vec2)	function	servers/rendering/shader_language.cpp:2948	#1827		ivec2	(vec2)		
floatBitsToInt(vec3)	function	servers/rendering/shader_language.cpp:2949	#1827		ivec3	(vec3)		
floatBitsToInt(vec4)	function	servers/rendering/shader_language.cpp:2950	#1827		ivec4	(vec4)		
floatBitsToUint(float)	function	servers/rendering/shader_language.cpp:2954	#1827		uint	(float)		
floatBitsToUint(vec2)	function	servers/rendering/shader_language.cpp:2955	#1827		uvec2	(vec2)		
floatBitsToUint(vec3)	function	servers/rendering/shader_language.cpp:2956	#1827		uvec3	(vec3)		
floatBitsToUint(vec4)	function	servers/rendering/shader_language.cpp:2957	#1827		uvec4	(vec4)		
intBitsToFloat(int)	function	servers/rendering/shader_language.cpp:2961	#1827		float	(int)		
intBitsToFloat(ivec2)	function	servers/rendering/shader_language.cpp:2962	#1827		vec2	(ivec2)		
intBitsToFloat(ivec3)	function	servers/rendering/shader_language.cpp:2963	#1827		vec3	(ivec3)		
intBitsToFloat(ivec4)	function	servers/rendering/shader_language.cpp:2964	#1827		vec4	(ivec4)		
uintBitsToFloat(uint)	function	servers/rendering/shader_language.cpp:2968	#1827		float	(uint)		
uintBitsToFloat(uvec2)	function	servers/rendering/shader_language.cpp:2969	#1827		vec2	(uvec2)		
uintBitsToFloat(uvec3)	function	servers/rendering/shader_language.cpp:2970	#1827		vec3	(uvec3)		
uintBitsToFloat(uvec4)	function	servers/rendering/shader_language.cpp:2971	#1827		vec4	(uvec4)		
length(float)	function	servers/rendering/shader_language.cpp:2976	#1826		float	(float)		
length(vec2)	function	servers/rendering/shader_language.cpp:2977	#1826		float	(vec2)		
length(vec3)	function	servers/rendering/shader_language.cpp:2978	#1826		float	(vec3)		
length(vec4)	function	servers/rendering/shader_language.cpp:2979	#1826		float	(vec4)		
distance(float,float)	function	servers/rendering/shader_language.cpp:2983	#1826		float	(float,float)		
distance(vec2,vec2)	function	servers/rendering/shader_language.cpp:2984	#1826		float	(vec2,vec2)		
distance(vec3,vec3)	function	servers/rendering/shader_language.cpp:2985	#1826		float	(vec3,vec3)		
distance(vec4,vec4)	function	servers/rendering/shader_language.cpp:2986	#1826		float	(vec4,vec4)		
dot(float,float)	function	servers/rendering/shader_language.cpp:2990	#1826		float	(float,float)		
dot(vec2,vec2)	function	servers/rendering/shader_language.cpp:2991	#1826		float	(vec2,vec2)		
dot(vec3,vec3)	function	servers/rendering/shader_language.cpp:2992	#1826		float	(vec3,vec3)		
dot(vec4,vec4)	function	servers/rendering/shader_language.cpp:2993	#1826		float	(vec4,vec4)		
cross(vec3,vec3)	function	servers/rendering/shader_language.cpp:2997	#1826		vec3	(vec3,vec3)		
normalize(float)	function	servers/rendering/shader_language.cpp:3001	#1826		float	(float)		
normalize(vec2)	function	servers/rendering/shader_language.cpp:3002	#1826		vec2	(vec2)		
normalize(vec3)	function	servers/rendering/shader_language.cpp:3003	#1826		vec3	(vec3)		
normalize(vec4)	function	servers/rendering/shader_language.cpp:3004	#1826		vec4	(vec4)		
reflect(vec2,vec2)	function	servers/rendering/shader_language.cpp:3008	#1826		vec2	(vec2,vec2)		
reflect(vec3,vec3)	function	servers/rendering/shader_language.cpp:3009	#1826		vec3	(vec3,vec3)		
reflect(vec4,vec4)	function	servers/rendering/shader_language.cpp:3010	#1826		vec4	(vec4,vec4)		
refract(vec2,vec2,float)	function	servers/rendering/shader_language.cpp:3014	#1826		vec2	(vec2,vec2,float)		
refract(vec3,vec3,float)	function	servers/rendering/shader_language.cpp:3015	#1826		vec3	(vec3,vec3,float)		
refract(vec4,vec4,float)	function	servers/rendering/shader_language.cpp:3016	#1826		vec4	(vec4,vec4,float)		
faceforward(vec2,vec2,vec2)	function	servers/rendering/shader_language.cpp:3020	#1826		vec2	(vec2,vec2,vec2)		
faceforward(vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:3021	#1826		vec3	(vec3,vec3,vec3)		
faceforward(vec4,vec4,vec4)	function	servers/rendering/shader_language.cpp:3022	#1826		vec4	(vec4,vec4,vec4)		
matrixCompMult(mat2,mat2)	function	servers/rendering/shader_language.cpp:3026	#1826		mat2	(mat2,mat2)		
matrixCompMult(mat3,mat3)	function	servers/rendering/shader_language.cpp:3027	#1826		mat3	(mat3,mat3)		
matrixCompMult(mat4,mat4)	function	servers/rendering/shader_language.cpp:3028	#1826		mat4	(mat4,mat4)		
outerProduct(vec2,vec2)	function	servers/rendering/shader_language.cpp:3032	#1826		mat2	(vec2,vec2)		
outerProduct(vec3,vec3)	function	servers/rendering/shader_language.cpp:3033	#1826		mat3	(vec3,vec3)		
outerProduct(vec4,vec4)	function	servers/rendering/shader_language.cpp:3034	#1826		mat4	(vec4,vec4)		
transpose(mat2)	function	servers/rendering/shader_language.cpp:3038	#1826		mat2	(mat2)		
transpose(mat3)	function	servers/rendering/shader_language.cpp:3039	#1826		mat3	(mat3)		
transpose(mat4)	function	servers/rendering/shader_language.cpp:3040	#1826		mat4	(mat4)		
determinant(mat2)	function	servers/rendering/shader_language.cpp:3044	#1826		float	(mat2)		
determinant(mat3)	function	servers/rendering/shader_language.cpp:3045	#1826		float	(mat3)		
determinant(mat4)	function	servers/rendering/shader_language.cpp:3046	#1826		float	(mat4)		
inverse(mat2)	function	servers/rendering/shader_language.cpp:3050	#1826		mat2	(mat2)		
inverse(mat3)	function	servers/rendering/shader_language.cpp:3051	#1826		mat3	(mat3)		
inverse(mat4)	function	servers/rendering/shader_language.cpp:3052	#1826		mat4	(mat4)		
lessThan(vec2,vec2)	function	servers/rendering/shader_language.cpp:3056	#1826		bvec2	(vec2,vec2)		
lessThan(vec3,vec3)	function	servers/rendering/shader_language.cpp:3057	#1826		bvec3	(vec3,vec3)		
lessThan(vec4,vec4)	function	servers/rendering/shader_language.cpp:3058	#1826		bvec4	(vec4,vec4)		
lessThan(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:3060	#1826		bvec2	(ivec2,ivec2)		
lessThan(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:3061	#1826		bvec3	(ivec3,ivec3)		
lessThan(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:3062	#1826		bvec4	(ivec4,ivec4)		
lessThan(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:3064	#1826		bvec3	(uvec3,uvec3)		
lessThan(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:3065	#1826		bvec4	(uvec4,uvec4)		
lessThan(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:3066	#1826		bvec2	(uvec2,uvec2)		
greaterThan(vec2,vec2)	function	servers/rendering/shader_language.cpp:3070	#1826		bvec2	(vec2,vec2)		
greaterThan(vec3,vec3)	function	servers/rendering/shader_language.cpp:3071	#1826		bvec3	(vec3,vec3)		
greaterThan(vec4,vec4)	function	servers/rendering/shader_language.cpp:3072	#1826		bvec4	(vec4,vec4)		
greaterThan(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:3074	#1826		bvec2	(ivec2,ivec2)		
greaterThan(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:3075	#1826		bvec3	(ivec3,ivec3)		
greaterThan(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:3076	#1826		bvec4	(ivec4,ivec4)		
greaterThan(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:3078	#1826		bvec2	(uvec2,uvec2)		
greaterThan(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:3079	#1826		bvec3	(uvec3,uvec3)		
greaterThan(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:3080	#1826		bvec4	(uvec4,uvec4)		
lessThanEqual(vec2,vec2)	function	servers/rendering/shader_language.cpp:3084	#1826		bvec2	(vec2,vec2)		
lessThanEqual(vec3,vec3)	function	servers/rendering/shader_language.cpp:3085	#1826		bvec3	(vec3,vec3)		
lessThanEqual(vec4,vec4)	function	servers/rendering/shader_language.cpp:3086	#1826		bvec4	(vec4,vec4)		
lessThanEqual(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:3088	#1826		bvec2	(ivec2,ivec2)		
lessThanEqual(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:3089	#1826		bvec3	(ivec3,ivec3)		
lessThanEqual(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:3090	#1826		bvec4	(ivec4,ivec4)		
lessThanEqual(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:3092	#1826		bvec2	(uvec2,uvec2)		
lessThanEqual(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:3093	#1826		bvec3	(uvec3,uvec3)		
lessThanEqual(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:3094	#1826		bvec4	(uvec4,uvec4)		
greaterThanEqual(vec2,vec2)	function	servers/rendering/shader_language.cpp:3098	#1826		bvec2	(vec2,vec2)		
greaterThanEqual(vec3,vec3)	function	servers/rendering/shader_language.cpp:3099	#1826		bvec3	(vec3,vec3)		
greaterThanEqual(vec4,vec4)	function	servers/rendering/shader_language.cpp:3100	#1826		bvec4	(vec4,vec4)		
greaterThanEqual(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:3102	#1826		bvec2	(ivec2,ivec2)		
greaterThanEqual(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:3103	#1826		bvec3	(ivec3,ivec3)		
greaterThanEqual(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:3104	#1826		bvec4	(ivec4,ivec4)		
greaterThanEqual(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:3106	#1826		bvec2	(uvec2,uvec2)		
greaterThanEqual(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:3107	#1826		bvec3	(uvec3,uvec3)		
greaterThanEqual(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:3108	#1826		bvec4	(uvec4,uvec4)		
equal(vec2,vec2)	function	servers/rendering/shader_language.cpp:3112	#1826		bvec2	(vec2,vec2)		
equal(vec3,vec3)	function	servers/rendering/shader_language.cpp:3113	#1826		bvec3	(vec3,vec3)		
equal(vec4,vec4)	function	servers/rendering/shader_language.cpp:3114	#1826		bvec4	(vec4,vec4)		
equal(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:3116	#1826		bvec2	(ivec2,ivec2)		
equal(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:3117	#1826		bvec3	(ivec3,ivec3)		
equal(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:3118	#1826		bvec4	(ivec4,ivec4)		
equal(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:3120	#1826		bvec2	(uvec2,uvec2)		
equal(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:3121	#1826		bvec3	(uvec3,uvec3)		
equal(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:3122	#1826		bvec4	(uvec4,uvec4)		
equal(bvec2,bvec2)	function	servers/rendering/shader_language.cpp:3124	#1826		bvec2	(bvec2,bvec2)		
equal(bvec3,bvec3)	function	servers/rendering/shader_language.cpp:3125	#1826		bvec3	(bvec3,bvec3)		
equal(bvec4,bvec4)	function	servers/rendering/shader_language.cpp:3126	#1826		bvec4	(bvec4,bvec4)		
notEqual(vec2,vec2)	function	servers/rendering/shader_language.cpp:3130	#1826		bvec2	(vec2,vec2)		
notEqual(vec3,vec3)	function	servers/rendering/shader_language.cpp:3131	#1826		bvec3	(vec3,vec3)		
notEqual(vec4,vec4)	function	servers/rendering/shader_language.cpp:3132	#1826		bvec4	(vec4,vec4)		
notEqual(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:3134	#1826		bvec2	(ivec2,ivec2)		
notEqual(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:3135	#1826		bvec3	(ivec3,ivec3)		
notEqual(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:3136	#1826		bvec4	(ivec4,ivec4)		
notEqual(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:3138	#1826		bvec2	(uvec2,uvec2)		
notEqual(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:3139	#1826		bvec3	(uvec3,uvec3)		
notEqual(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:3140	#1826		bvec4	(uvec4,uvec4)		
notEqual(bvec2,bvec2)	function	servers/rendering/shader_language.cpp:3142	#1826		bvec2	(bvec2,bvec2)		
notEqual(bvec3,bvec3)	function	servers/rendering/shader_language.cpp:3143	#1826		bvec3	(bvec3,bvec3)		
notEqual(bvec4,bvec4)	function	servers/rendering/shader_language.cpp:3144	#1826		bvec4	(bvec4,bvec4)		
any(bvec2)	function	servers/rendering/shader_language.cpp:3148	#1826		bool	(bvec2)		
any(bvec3)	function	servers/rendering/shader_language.cpp:3149	#1826		bool	(bvec3)		
any(bvec4)	function	servers/rendering/shader_language.cpp:3150	#1826		bool	(bvec4)		
all(bvec2)	function	servers/rendering/shader_language.cpp:3154	#1826		bool	(bvec2)		
all(bvec3)	function	servers/rendering/shader_language.cpp:3155	#1826		bool	(bvec3)		
all(bvec4)	function	servers/rendering/shader_language.cpp:3156	#1826		bool	(bvec4)		
not(bvec2)	function	servers/rendering/shader_language.cpp:3160	#1826		bvec2	(bvec2)		
not(bvec3)	function	servers/rendering/shader_language.cpp:3161	#1826		bvec3	(bvec3)		
not(bvec4)	function	servers/rendering/shader_language.cpp:3162	#1826		bvec4	(bvec4)		
textureSize(sampler2D,int)	function	servers/rendering/shader_language.cpp:3167	#1829		ivec2	(sampler2D,int)		
textureSize(isampler2D,int)	function	servers/rendering/shader_language.cpp:3168	#1829		ivec2	(isampler2D,int)		
textureSize(usampler2D,int)	function	servers/rendering/shader_language.cpp:3169	#1829		ivec2	(usampler2D,int)		
textureSize(sampler2DArray,int)	function	servers/rendering/shader_language.cpp:3170	#1829		ivec3	(sampler2DArray,int)		
textureSize(isampler2DArray,int)	function	servers/rendering/shader_language.cpp:3171	#1829		ivec3	(isampler2DArray,int)		
textureSize(usampler2DArray,int)	function	servers/rendering/shader_language.cpp:3172	#1829		ivec3	(usampler2DArray,int)		
textureSize(sampler3D,int)	function	servers/rendering/shader_language.cpp:3173	#1829		ivec3	(sampler3D,int)		
textureSize(isampler3D,int)	function	servers/rendering/shader_language.cpp:3174	#1829		ivec3	(isampler3D,int)		
textureSize(usampler3D,int)	function	servers/rendering/shader_language.cpp:3175	#1829		ivec3	(usampler3D,int)		
textureSize(samplerCube,int)	function	servers/rendering/shader_language.cpp:3176	#1829		ivec2	(samplerCube,int)		
textureSize(samplerCubeArray,int)	function	servers/rendering/shader_language.cpp:3177	#1829		ivec2	(samplerCubeArray,int)		
texture(sampler2D,vec2)	function	servers/rendering/shader_language.cpp:3181	#1829		vec4	(sampler2D,vec2)		
texture(sampler2D,vec2,float)	function	servers/rendering/shader_language.cpp:3182	#1829		vec4	(sampler2D,vec2,float)		
texture(usampler2D,vec2)	function	servers/rendering/shader_language.cpp:3183	#1829		uvec4	(usampler2D,vec2)		
texture(usampler2D,vec2,float)	function	servers/rendering/shader_language.cpp:3184	#1829		uvec4	(usampler2D,vec2,float)		
texture(isampler2D,vec2)	function	servers/rendering/shader_language.cpp:3185	#1829		ivec4	(isampler2D,vec2)		
texture(isampler2D,vec2,float)	function	servers/rendering/shader_language.cpp:3186	#1829		ivec4	(isampler2D,vec2,float)		
texture(sampler2DArray,vec3)	function	servers/rendering/shader_language.cpp:3187	#1829		vec4	(sampler2DArray,vec3)		
texture(sampler2DArray,vec3,float)	function	servers/rendering/shader_language.cpp:3188	#1829		vec4	(sampler2DArray,vec3,float)		
texture(usampler2DArray,vec3)	function	servers/rendering/shader_language.cpp:3189	#1829		uvec4	(usampler2DArray,vec3)		
texture(usampler2DArray,vec3,float)	function	servers/rendering/shader_language.cpp:3190	#1829		uvec4	(usampler2DArray,vec3,float)		
texture(isampler2DArray,vec3)	function	servers/rendering/shader_language.cpp:3191	#1829		ivec4	(isampler2DArray,vec3)		
texture(isampler2DArray,vec3,float)	function	servers/rendering/shader_language.cpp:3192	#1829		ivec4	(isampler2DArray,vec3,float)		
texture(sampler3D,vec3)	function	servers/rendering/shader_language.cpp:3193	#1829		vec4	(sampler3D,vec3)		
texture(sampler3D,vec3,float)	function	servers/rendering/shader_language.cpp:3194	#1829		vec4	(sampler3D,vec3,float)		
texture(usampler3D,vec3)	function	servers/rendering/shader_language.cpp:3195	#1829		uvec4	(usampler3D,vec3)		
texture(usampler3D,vec3,float)	function	servers/rendering/shader_language.cpp:3196	#1829		uvec4	(usampler3D,vec3,float)		
texture(isampler3D,vec3)	function	servers/rendering/shader_language.cpp:3197	#1829		ivec4	(isampler3D,vec3)		
texture(isampler3D,vec3,float)	function	servers/rendering/shader_language.cpp:3198	#1829		ivec4	(isampler3D,vec3,float)		
texture(samplerCube,vec3)	function	servers/rendering/shader_language.cpp:3199	#1829		vec4	(samplerCube,vec3)		
texture(samplerCube,vec3,float)	function	servers/rendering/shader_language.cpp:3200	#1829		vec4	(samplerCube,vec3,float)		
texture(samplerCubeArray,vec4)	function	servers/rendering/shader_language.cpp:3201	#1829		vec4	(samplerCubeArray,vec4)		
texture(samplerCubeArray,vec4,float)	function	servers/rendering/shader_language.cpp:3202	#1829		vec4	(samplerCubeArray,vec4,float)		
texture(samplerExternalOES,vec2)	function	servers/rendering/shader_language.cpp:3203	#1829		vec4	(samplerExternalOES,vec2)		
texture(samplerExternalOES,vec2,float)	function	servers/rendering/shader_language.cpp:3204	#1829		vec4	(samplerExternalOES,vec2,float)		
textureProj(sampler2D,vec3)	function	servers/rendering/shader_language.cpp:3208	#1829		vec4	(sampler2D,vec3)		
textureProj(sampler2D,vec4)	function	servers/rendering/shader_language.cpp:3209	#1829		vec4	(sampler2D,vec4)		
textureProj(sampler2D,vec3,float)	function	servers/rendering/shader_language.cpp:3210	#1829		vec4	(sampler2D,vec3,float)		
textureProj(sampler2D,vec4,float)	function	servers/rendering/shader_language.cpp:3211	#1829		vec4	(sampler2D,vec4,float)		
textureProj(isampler2D,vec3)	function	servers/rendering/shader_language.cpp:3212	#1829		ivec4	(isampler2D,vec3)		
textureProj(isampler2D,vec4)	function	servers/rendering/shader_language.cpp:3213	#1829		ivec4	(isampler2D,vec4)		
textureProj(isampler2D,vec3,float)	function	servers/rendering/shader_language.cpp:3214	#1829		ivec4	(isampler2D,vec3,float)		
textureProj(isampler2D,vec4,float)	function	servers/rendering/shader_language.cpp:3215	#1829		ivec4	(isampler2D,vec4,float)		
textureProj(usampler2D,vec3)	function	servers/rendering/shader_language.cpp:3216	#1829		uvec4	(usampler2D,vec3)		
textureProj(usampler2D,vec4)	function	servers/rendering/shader_language.cpp:3217	#1829		uvec4	(usampler2D,vec4)		
textureProj(usampler2D,vec3,float)	function	servers/rendering/shader_language.cpp:3218	#1829		uvec4	(usampler2D,vec3,float)		
textureProj(usampler2D,vec4,float)	function	servers/rendering/shader_language.cpp:3219	#1829		uvec4	(usampler2D,vec4,float)		
textureProj(sampler3D,vec4)	function	servers/rendering/shader_language.cpp:3220	#1829		vec4	(sampler3D,vec4)		
textureProj(sampler3D,vec4,float)	function	servers/rendering/shader_language.cpp:3221	#1829		vec4	(sampler3D,vec4,float)		
textureProj(isampler3D,vec4)	function	servers/rendering/shader_language.cpp:3222	#1829		ivec4	(isampler3D,vec4)		
textureProj(isampler3D,vec4,float)	function	servers/rendering/shader_language.cpp:3223	#1829		ivec4	(isampler3D,vec4,float)		
textureProj(usampler3D,vec4)	function	servers/rendering/shader_language.cpp:3224	#1829		uvec4	(usampler3D,vec4)		
textureProj(usampler3D,vec4,float)	function	servers/rendering/shader_language.cpp:3225	#1829		uvec4	(usampler3D,vec4,float)		
textureLod(sampler2D,vec2,float)	function	servers/rendering/shader_language.cpp:3229	#1829		vec4	(sampler2D,vec2,float)		
textureLod(isampler2D,vec2,float)	function	servers/rendering/shader_language.cpp:3230	#1829		ivec4	(isampler2D,vec2,float)		
textureLod(usampler2D,vec2,float)	function	servers/rendering/shader_language.cpp:3231	#1829		uvec4	(usampler2D,vec2,float)		
textureLod(sampler2DArray,vec3,float)	function	servers/rendering/shader_language.cpp:3232	#1829		vec4	(sampler2DArray,vec3,float)		
textureLod(isampler2DArray,vec3,float)	function	servers/rendering/shader_language.cpp:3233	#1829		ivec4	(isampler2DArray,vec3,float)		
textureLod(usampler2DArray,vec3,float)	function	servers/rendering/shader_language.cpp:3234	#1829		uvec4	(usampler2DArray,vec3,float)		
textureLod(sampler3D,vec3,float)	function	servers/rendering/shader_language.cpp:3235	#1829		vec4	(sampler3D,vec3,float)		
textureLod(isampler3D,vec3,float)	function	servers/rendering/shader_language.cpp:3236	#1829		ivec4	(isampler3D,vec3,float)		
textureLod(usampler3D,vec3,float)	function	servers/rendering/shader_language.cpp:3237	#1829		uvec4	(usampler3D,vec3,float)		
textureLod(samplerCube,vec3,float)	function	servers/rendering/shader_language.cpp:3238	#1829		vec4	(samplerCube,vec3,float)		
textureLod(samplerCubeArray,vec4,float)	function	servers/rendering/shader_language.cpp:3239	#1829		vec4	(samplerCubeArray,vec4,float)		
texelFetch(sampler2D,ivec2,int)	function	servers/rendering/shader_language.cpp:3243	#1829		vec4	(sampler2D,ivec2,int)		
texelFetch(isampler2D,ivec2,int)	function	servers/rendering/shader_language.cpp:3244	#1829		ivec4	(isampler2D,ivec2,int)		
texelFetch(usampler2D,ivec2,int)	function	servers/rendering/shader_language.cpp:3245	#1829		uvec4	(usampler2D,ivec2,int)		
texelFetch(sampler2DArray,ivec3,int)	function	servers/rendering/shader_language.cpp:3246	#1829		vec4	(sampler2DArray,ivec3,int)		
texelFetch(isampler2DArray,ivec3,int)	function	servers/rendering/shader_language.cpp:3247	#1829		ivec4	(isampler2DArray,ivec3,int)		
texelFetch(usampler2DArray,ivec3,int)	function	servers/rendering/shader_language.cpp:3248	#1829		uvec4	(usampler2DArray,ivec3,int)		
texelFetch(sampler3D,ivec3,int)	function	servers/rendering/shader_language.cpp:3249	#1829		vec4	(sampler3D,ivec3,int)		
texelFetch(isampler3D,ivec3,int)	function	servers/rendering/shader_language.cpp:3250	#1829		ivec4	(isampler3D,ivec3,int)		
texelFetch(usampler3D,ivec3,int)	function	servers/rendering/shader_language.cpp:3251	#1829		uvec4	(usampler3D,ivec3,int)		
textureProjLod(sampler2D,vec3,float)	function	servers/rendering/shader_language.cpp:3255	#1829		vec4	(sampler2D,vec3,float)		
textureProjLod(sampler2D,vec4,float)	function	servers/rendering/shader_language.cpp:3256	#1829		vec4	(sampler2D,vec4,float)		
textureProjLod(isampler2D,vec3,float)	function	servers/rendering/shader_language.cpp:3257	#1829		ivec4	(isampler2D,vec3,float)		
textureProjLod(isampler2D,vec4,float)	function	servers/rendering/shader_language.cpp:3258	#1829		ivec4	(isampler2D,vec4,float)		
textureProjLod(usampler2D,vec3,float)	function	servers/rendering/shader_language.cpp:3259	#1829		uvec4	(usampler2D,vec3,float)		
textureProjLod(usampler2D,vec4,float)	function	servers/rendering/shader_language.cpp:3260	#1829		uvec4	(usampler2D,vec4,float)		
textureProjLod(sampler3D,vec4,float)	function	servers/rendering/shader_language.cpp:3261	#1829		vec4	(sampler3D,vec4,float)		
textureProjLod(isampler3D,vec4,float)	function	servers/rendering/shader_language.cpp:3262	#1829		ivec4	(isampler3D,vec4,float)		
textureProjLod(usampler3D,vec4,float)	function	servers/rendering/shader_language.cpp:3263	#1829		uvec4	(usampler3D,vec4,float)		
textureGrad(sampler2D,vec2,vec2,vec2)	function	servers/rendering/shader_language.cpp:3267	#1829		vec4	(sampler2D,vec2,vec2,vec2)		
textureGrad(isampler2D,vec2,vec2,vec2)	function	servers/rendering/shader_language.cpp:3268	#1829		ivec4	(isampler2D,vec2,vec2,vec2)		
textureGrad(usampler2D,vec2,vec2,vec2)	function	servers/rendering/shader_language.cpp:3269	#1829		uvec4	(usampler2D,vec2,vec2,vec2)		
textureGrad(sampler2DArray,vec3,vec2,vec2)	function	servers/rendering/shader_language.cpp:3270	#1829		vec4	(sampler2DArray,vec3,vec2,vec2)		
textureGrad(isampler2DArray,vec3,vec2,vec2)	function	servers/rendering/shader_language.cpp:3271	#1829		ivec4	(isampler2DArray,vec3,vec2,vec2)		
textureGrad(usampler2DArray,vec3,vec2,vec2)	function	servers/rendering/shader_language.cpp:3272	#1829		uvec4	(usampler2DArray,vec3,vec2,vec2)		
textureGrad(sampler3D,vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:3273	#1829		vec4	(sampler3D,vec3,vec3,vec3)		
textureGrad(isampler3D,vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:3274	#1829		ivec4	(isampler3D,vec3,vec3,vec3)		
textureGrad(usampler3D,vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:3275	#1829		uvec4	(usampler3D,vec3,vec3,vec3)		
textureGrad(samplerCube,vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:3276	#1829		vec4	(samplerCube,vec3,vec3,vec3)		
textureGrad(samplerCubeArray,vec4,vec3,vec3)	function	servers/rendering/shader_language.cpp:3277	#1829		vec4	(samplerCubeArray,vec4,vec3,vec3)		
textureProjGrad(sampler2D,vec3,vec2,vec2)	function	servers/rendering/shader_language.cpp:3281	#1829		vec4	(sampler2D,vec3,vec2,vec2)		
textureProjGrad(sampler2D,vec4,vec2,vec2)	function	servers/rendering/shader_language.cpp:3282	#1829		vec4	(sampler2D,vec4,vec2,vec2)		
textureProjGrad(isampler2D,vec3,vec2,vec2)	function	servers/rendering/shader_language.cpp:3283	#1829		ivec4	(isampler2D,vec3,vec2,vec2)		
textureProjGrad(isampler2D,vec4,vec2,vec2)	function	servers/rendering/shader_language.cpp:3284	#1829		ivec4	(isampler2D,vec4,vec2,vec2)		
textureProjGrad(usampler2D,vec3,vec2,vec2)	function	servers/rendering/shader_language.cpp:3285	#1829		uvec4	(usampler2D,vec3,vec2,vec2)		
textureProjGrad(usampler2D,vec4,vec2,vec2)	function	servers/rendering/shader_language.cpp:3286	#1829		uvec4	(usampler2D,vec4,vec2,vec2)		
textureProjGrad(sampler3D,vec4,vec3,vec3)	function	servers/rendering/shader_language.cpp:3287	#1829		vec4	(sampler3D,vec4,vec3,vec3)		
textureProjGrad(isampler3D,vec4,vec3,vec3)	function	servers/rendering/shader_language.cpp:3288	#1829		ivec4	(isampler3D,vec4,vec3,vec3)		
textureProjGrad(usampler3D,vec4,vec3,vec3)	function	servers/rendering/shader_language.cpp:3289	#1829		uvec4	(usampler3D,vec4,vec3,vec3)		
textureGather(sampler2D,vec2)	function	servers/rendering/shader_language.cpp:3293	#1829		vec4	(sampler2D,vec2)		
textureGather(isampler2D,vec2)	function	servers/rendering/shader_language.cpp:3294	#1829		ivec4	(isampler2D,vec2)		
textureGather(usampler2D,vec2)	function	servers/rendering/shader_language.cpp:3295	#1829		uvec4	(usampler2D,vec2)		
textureGather(sampler2D,vec2,int)	function	servers/rendering/shader_language.cpp:3296	#1829		vec4	(sampler2D,vec2,int)		
textureGather(isampler2D,vec2,int)	function	servers/rendering/shader_language.cpp:3297	#1829		ivec4	(isampler2D,vec2,int)		
textureGather(usampler2D,vec2,int)	function	servers/rendering/shader_language.cpp:3298	#1829		uvec4	(usampler2D,vec2,int)		
textureGather(sampler2DArray,vec3)	function	servers/rendering/shader_language.cpp:3299	#1829		vec4	(sampler2DArray,vec3)		
textureGather(isampler2DArray,vec3)	function	servers/rendering/shader_language.cpp:3300	#1829		ivec4	(isampler2DArray,vec3)		
textureGather(usampler2DArray,vec3)	function	servers/rendering/shader_language.cpp:3301	#1829		uvec4	(usampler2DArray,vec3)		
textureGather(sampler2DArray,vec3,int)	function	servers/rendering/shader_language.cpp:3302	#1829		vec4	(sampler2DArray,vec3,int)		
textureGather(isampler2DArray,vec3,int)	function	servers/rendering/shader_language.cpp:3303	#1829		ivec4	(isampler2DArray,vec3,int)		
textureGather(usampler2DArray,vec3,int)	function	servers/rendering/shader_language.cpp:3304	#1829		uvec4	(usampler2DArray,vec3,int)		
textureGather(samplerCube,vec3)	function	servers/rendering/shader_language.cpp:3305	#1829		vec4	(samplerCube,vec3)		
textureGather(samplerCube,vec3,int)	function	servers/rendering/shader_language.cpp:3306	#1829		vec4	(samplerCube,vec3,int)		
textureQueryLod(sampler2D,vec2)	function (high_end)	servers/rendering/shader_language.cpp:3310	#1829		vec2	(sampler2D,vec2)		
textureQueryLod(isampler2D,vec2)	function (high_end)	servers/rendering/shader_language.cpp:3311	#1829		vec2	(isampler2D,vec2)		
textureQueryLod(usampler2D,vec2)	function (high_end)	servers/rendering/shader_language.cpp:3312	#1829		vec2	(usampler2D,vec2)		
textureQueryLod(sampler2DArray,vec2)	function (high_end)	servers/rendering/shader_language.cpp:3313	#1829		vec2	(sampler2DArray,vec2)		
textureQueryLod(isampler2DArray,vec2)	function (high_end)	servers/rendering/shader_language.cpp:3314	#1829		vec2	(isampler2DArray,vec2)		
textureQueryLod(usampler2DArray,vec2)	function (high_end)	servers/rendering/shader_language.cpp:3315	#1829		vec2	(usampler2DArray,vec2)		
textureQueryLod(sampler3D,vec3)	function (high_end)	servers/rendering/shader_language.cpp:3316	#1829		vec2	(sampler3D,vec3)		
textureQueryLod(isampler3D,vec3)	function (high_end)	servers/rendering/shader_language.cpp:3317	#1829		vec2	(isampler3D,vec3)		
textureQueryLod(usampler3D,vec3)	function (high_end)	servers/rendering/shader_language.cpp:3318	#1829		vec2	(usampler3D,vec3)		
textureQueryLod(samplerCube,vec3)	function (high_end)	servers/rendering/shader_language.cpp:3319	#1829		vec2	(samplerCube,vec3)		
textureQueryLevels(sampler2D)	function (high_end)	servers/rendering/shader_language.cpp:3323	#1829		int	(sampler2D)		
textureQueryLevels(isampler2D)	function (high_end)	servers/rendering/shader_language.cpp:3324	#1829		int	(isampler2D)		
textureQueryLevels(usampler2D)	function (high_end)	servers/rendering/shader_language.cpp:3325	#1829		int	(usampler2D)		
textureQueryLevels(sampler2DArray)	function (high_end)	servers/rendering/shader_language.cpp:3326	#1829		int	(sampler2DArray)		
textureQueryLevels(isampler2DArray)	function (high_end)	servers/rendering/shader_language.cpp:3327	#1829		int	(isampler2DArray)		
textureQueryLevels(usampler2DArray)	function (high_end)	servers/rendering/shader_language.cpp:3328	#1829		int	(usampler2DArray)		
textureQueryLevels(sampler3D)	function (high_end)	servers/rendering/shader_language.cpp:3329	#1829		int	(sampler3D)		
textureQueryLevels(isampler3D)	function (high_end)	servers/rendering/shader_language.cpp:3330	#1829		int	(isampler3D)		
textureQueryLevels(usampler3D)	function (high_end)	servers/rendering/shader_language.cpp:3331	#1829		int	(usampler3D)		
textureQueryLevels(samplerCube)	function (high_end)	servers/rendering/shader_language.cpp:3332	#1829		int	(samplerCube)		
dFdx(float)	function	servers/rendering/shader_language.cpp:3336	#1827		float	(float)		
dFdx(vec2)	function	servers/rendering/shader_language.cpp:3337	#1827		vec2	(vec2)		
dFdx(vec3)	function	servers/rendering/shader_language.cpp:3338	#1827		vec3	(vec3)		
dFdx(vec4)	function	servers/rendering/shader_language.cpp:3339	#1827		vec4	(vec4)		
dFdxCoarse(float)	function (high_end)	servers/rendering/shader_language.cpp:3343	#1827		float	(float)		
dFdxCoarse(vec2)	function (high_end)	servers/rendering/shader_language.cpp:3344	#1827		vec2	(vec2)		
dFdxCoarse(vec3)	function (high_end)	servers/rendering/shader_language.cpp:3345	#1827		vec3	(vec3)		
dFdxCoarse(vec4)	function (high_end)	servers/rendering/shader_language.cpp:3346	#1827		vec4	(vec4)		
dFdxFine(float)	function (high_end)	servers/rendering/shader_language.cpp:3350	#1827		float	(float)		
dFdxFine(vec2)	function (high_end)	servers/rendering/shader_language.cpp:3351	#1827		vec2	(vec2)		
dFdxFine(vec3)	function (high_end)	servers/rendering/shader_language.cpp:3352	#1827		vec3	(vec3)		
dFdxFine(vec4)	function (high_end)	servers/rendering/shader_language.cpp:3353	#1827		vec4	(vec4)		
dFdy(float)	function	servers/rendering/shader_language.cpp:3357	#1827		float	(float)		
dFdy(vec2)	function	servers/rendering/shader_language.cpp:3358	#1827		vec2	(vec2)		
dFdy(vec3)	function	servers/rendering/shader_language.cpp:3359	#1827		vec3	(vec3)		
dFdy(vec4)	function	servers/rendering/shader_language.cpp:3360	#1827		vec4	(vec4)		
dFdyCoarse(float)	function (high_end)	servers/rendering/shader_language.cpp:3364	#1827		float	(float)		
dFdyCoarse(vec2)	function (high_end)	servers/rendering/shader_language.cpp:3365	#1827		vec2	(vec2)		
dFdyCoarse(vec3)	function (high_end)	servers/rendering/shader_language.cpp:3366	#1827		vec3	(vec3)		
dFdyCoarse(vec4)	function (high_end)	servers/rendering/shader_language.cpp:3367	#1827		vec4	(vec4)		
dFdyFine(float)	function (high_end)	servers/rendering/shader_language.cpp:3371	#1827		float	(float)		
dFdyFine(vec2)	function (high_end)	servers/rendering/shader_language.cpp:3372	#1827		vec2	(vec2)		
dFdyFine(vec3)	function (high_end)	servers/rendering/shader_language.cpp:3373	#1827		vec3	(vec3)		
dFdyFine(vec4)	function (high_end)	servers/rendering/shader_language.cpp:3374	#1827		vec4	(vec4)		
fwidth(float)	function	servers/rendering/shader_language.cpp:3378	#1827		float	(float)		
fwidth(vec2)	function	servers/rendering/shader_language.cpp:3379	#1827		vec2	(vec2)		
fwidth(vec3)	function	servers/rendering/shader_language.cpp:3380	#1827		vec3	(vec3)		
fwidth(vec4)	function	servers/rendering/shader_language.cpp:3381	#1827		vec4	(vec4)		
fwidthCoarse(float)	function (high_end)	servers/rendering/shader_language.cpp:3385	#1827		float	(float)		
fwidthCoarse(vec2)	function (high_end)	servers/rendering/shader_language.cpp:3386	#1827		vec2	(vec2)		
fwidthCoarse(vec3)	function (high_end)	servers/rendering/shader_language.cpp:3387	#1827		vec3	(vec3)		
fwidthCoarse(vec4)	function (high_end)	servers/rendering/shader_language.cpp:3388	#1827		vec4	(vec4)		
fwidthFine(float)	function (high_end)	servers/rendering/shader_language.cpp:3392	#1827		float	(float)		
fwidthFine(vec2)	function (high_end)	servers/rendering/shader_language.cpp:3393	#1827		vec2	(vec2)		
fwidthFine(vec3)	function (high_end)	servers/rendering/shader_language.cpp:3394	#1827		vec3	(vec3)		
fwidthFine(vec4)	function (high_end)	servers/rendering/shader_language.cpp:3395	#1827		vec4	(vec4)		
length[array]()	function	servers/rendering/shader_language.cpp:3400	#1824		int	()	native	native
fma(float,float,float)	function (high_end)	servers/rendering/shader_language.cpp:3405	#1827		float	(float,float,float)		
fma(vec2,vec2,vec2)	function (high_end)	servers/rendering/shader_language.cpp:3406	#1827		vec2	(vec2,vec2,vec2)		
fma(vec3,vec3,vec3)	function (high_end)	servers/rendering/shader_language.cpp:3407	#1827		vec3	(vec3,vec3,vec3)		
fma(vec4,vec4,vec4)	function (high_end)	servers/rendering/shader_language.cpp:3408	#1827		vec4	(vec4,vec4,vec4)		
packHalf2x16(vec2)	function	servers/rendering/shader_language.cpp:3412	#1827		uint	(vec2)		
packUnorm2x16(vec2)	function	servers/rendering/shader_language.cpp:3413	#1827		uint	(vec2)		
packSnorm2x16(vec2)	function	servers/rendering/shader_language.cpp:3414	#1827		uint	(vec2)		
packUnorm4x8(vec4)	function	servers/rendering/shader_language.cpp:3415	#1827		uint	(vec4)		
packSnorm4x8(vec4)	function	servers/rendering/shader_language.cpp:3416	#1827		uint	(vec4)		
unpackHalf2x16(uint)	function	servers/rendering/shader_language.cpp:3418	#1827		vec2	(uint)		
unpackUnorm2x16(uint)	function	servers/rendering/shader_language.cpp:3419	#1827		vec2	(uint)		
unpackSnorm2x16(uint)	function	servers/rendering/shader_language.cpp:3420	#1827		vec2	(uint)		
unpackUnorm4x8(uint)	function	servers/rendering/shader_language.cpp:3421	#1827		vec4	(uint)		
unpackSnorm4x8(uint)	function	servers/rendering/shader_language.cpp:3422	#1827		vec4	(uint)		
bitfieldExtract(int,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3426	#1827		int	(int,int,int)		
bitfieldExtract(ivec2,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3427	#1827		ivec2	(ivec2,int,int)		
bitfieldExtract(ivec3,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3428	#1827		ivec3	(ivec3,int,int)		
bitfieldExtract(ivec4,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3429	#1827		ivec4	(ivec4,int,int)		
bitfieldExtract(uint,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3431	#1827		uint	(uint,int,int)		
bitfieldExtract(uvec2,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3432	#1827		uvec2	(uvec2,int,int)		
bitfieldExtract(uvec3,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3433	#1827		uvec3	(uvec3,int,int)		
bitfieldExtract(uvec4,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3434	#1827		uvec4	(uvec4,int,int)		
bitfieldInsert(int,int,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3438	#1827		int	(int,int,int,int)		
bitfieldInsert(ivec2,ivec2,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3439	#1827		ivec2	(ivec2,ivec2,int,int)		
bitfieldInsert(ivec3,ivec3,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3440	#1827		ivec3	(ivec3,ivec3,int,int)		
bitfieldInsert(ivec4,ivec4,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3441	#1827		ivec4	(ivec4,ivec4,int,int)		
bitfieldInsert(uint,uint,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3443	#1827		uint	(uint,uint,int,int)		
bitfieldInsert(uvec2,uvec2,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3444	#1827		uvec2	(uvec2,uvec2,int,int)		
bitfieldInsert(uvec3,uvec3,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3445	#1827		uvec3	(uvec3,uvec3,int,int)		
bitfieldInsert(uvec4,uvec4,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3446	#1827		uvec4	(uvec4,uvec4,int,int)		
bitfieldReverse(int)	function (high_end)	servers/rendering/shader_language.cpp:3450	#1827		int	(int)		
bitfieldReverse(ivec2)	function (high_end)	servers/rendering/shader_language.cpp:3451	#1827		ivec2	(ivec2)		
bitfieldReverse(ivec3)	function (high_end)	servers/rendering/shader_language.cpp:3452	#1827		ivec3	(ivec3)		
bitfieldReverse(ivec4)	function (high_end)	servers/rendering/shader_language.cpp:3453	#1827		ivec4	(ivec4)		
bitfieldReverse(uint)	function (high_end)	servers/rendering/shader_language.cpp:3455	#1827		uint	(uint)		
bitfieldReverse(uvec2)	function (high_end)	servers/rendering/shader_language.cpp:3456	#1827		uvec2	(uvec2)		
bitfieldReverse(uvec3)	function (high_end)	servers/rendering/shader_language.cpp:3457	#1827		uvec3	(uvec3)		
bitfieldReverse(uvec4)	function (high_end)	servers/rendering/shader_language.cpp:3458	#1827		uvec4	(uvec4)		
bitCount(int)	function (high_end)	servers/rendering/shader_language.cpp:3462	#1827		int	(int)		
bitCount(ivec2)	function (high_end)	servers/rendering/shader_language.cpp:3463	#1827		ivec2	(ivec2)		
bitCount(ivec3)	function (high_end)	servers/rendering/shader_language.cpp:3464	#1827		ivec3	(ivec3)		
bitCount(ivec4)	function (high_end)	servers/rendering/shader_language.cpp:3465	#1827		ivec4	(ivec4)		
bitCount(uint)	function (high_end)	servers/rendering/shader_language.cpp:3467	#1827		uint	(uint)		
bitCount(uvec2)	function (high_end)	servers/rendering/shader_language.cpp:3468	#1827		uvec2	(uvec2)		
bitCount(uvec3)	function (high_end)	servers/rendering/shader_language.cpp:3469	#1827		uvec3	(uvec3)		
bitCount(uvec4)	function (high_end)	servers/rendering/shader_language.cpp:3470	#1827		uvec4	(uvec4)		
findLSB(int)	function (high_end)	servers/rendering/shader_language.cpp:3474	#1827		int	(int)		
findLSB(ivec2)	function (high_end)	servers/rendering/shader_language.cpp:3475	#1827		ivec2	(ivec2)		
findLSB(ivec3)	function (high_end)	servers/rendering/shader_language.cpp:3476	#1827		ivec3	(ivec3)		
findLSB(ivec4)	function (high_end)	servers/rendering/shader_language.cpp:3477	#1827		ivec4	(ivec4)		
findLSB(uint)	function (high_end)	servers/rendering/shader_language.cpp:3479	#1827		uint	(uint)		
findLSB(uvec2)	function (high_end)	servers/rendering/shader_language.cpp:3480	#1827		uvec2	(uvec2)		
findLSB(uvec3)	function (high_end)	servers/rendering/shader_language.cpp:3481	#1827		uvec3	(uvec3)		
findLSB(uvec4)	function (high_end)	servers/rendering/shader_language.cpp:3482	#1827		uvec4	(uvec4)		
findMSB(int)	function (high_end)	servers/rendering/shader_language.cpp:3486	#1827		int	(int)		
findMSB(ivec2)	function (high_end)	servers/rendering/shader_language.cpp:3487	#1827		ivec2	(ivec2)		
findMSB(ivec3)	function (high_end)	servers/rendering/shader_language.cpp:3488	#1827		ivec3	(ivec3)		
findMSB(ivec4)	function (high_end)	servers/rendering/shader_language.cpp:3489	#1827		ivec4	(ivec4)		
findMSB(uint)	function (high_end)	servers/rendering/shader_language.cpp:3491	#1827		uint	(uint)		
findMSB(uvec2)	function (high_end)	servers/rendering/shader_language.cpp:3492	#1827		uvec2	(uvec2)		
findMSB(uvec3)	function (high_end)	servers/rendering/shader_language.cpp:3493	#1827		uvec3	(uvec3)		
findMSB(uvec4)	function (high_end)	servers/rendering/shader_language.cpp:3494	#1827		uvec4	(uvec4)		
umulExtended(uint,uint,uint,uint)	function (high_end)	servers/rendering/shader_language.cpp:3498	#1827		void	(uint,uint,uint,uint)		
umulExtended(uvec2,uvec2,uvec2,uvec2)	function (high_end)	servers/rendering/shader_language.cpp:3499	#1827		void	(uvec2,uvec2,uvec2,uvec2)		
umulExtended(uvec3,uvec3,uvec3,uvec3)	function (high_end)	servers/rendering/shader_language.cpp:3500	#1827		void	(uvec3,uvec3,uvec3,uvec3)		
umulExtended(uvec4,uvec4,uvec4,uvec4)	function (high_end)	servers/rendering/shader_language.cpp:3501	#1827		void	(uvec4,uvec4,uvec4,uvec4)		
imulExtended(int,int,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3505	#1827		void	(int,int,int,int)		
imulExtended(ivec2,ivec2,ivec2,ivec2)	function (high_end)	servers/rendering/shader_language.cpp:3506	#1827		void	(ivec2,ivec2,ivec2,ivec2)		
imulExtended(ivec3,ivec3,ivec3,ivec3)	function (high_end)	servers/rendering/shader_language.cpp:3507	#1827		void	(ivec3,ivec3,ivec3,ivec3)		
imulExtended(ivec4,ivec4,ivec4,ivec4)	function (high_end)	servers/rendering/shader_language.cpp:3508	#1827		void	(ivec4,ivec4,ivec4,ivec4)		
uaddCarry(uint,uint,uint)	function (high_end)	servers/rendering/shader_language.cpp:3512	#1827		uint	(uint,uint,uint)		
uaddCarry(uvec2,uvec2,uvec2)	function (high_end)	servers/rendering/shader_language.cpp:3513	#1827		uvec2	(uvec2,uvec2,uvec2)		
uaddCarry(uvec3,uvec3,uvec3)	function (high_end)	servers/rendering/shader_language.cpp:3514	#1827		uvec3	(uvec3,uvec3,uvec3)		
uaddCarry(uvec4,uvec4,uvec4)	function (high_end)	servers/rendering/shader_language.cpp:3515	#1827		uvec4	(uvec4,uvec4,uvec4)		
usubBorrow(uint,uint,uint)	function (high_end)	servers/rendering/shader_language.cpp:3519	#1827		uint	(uint,uint,uint)		
usubBorrow(uvec2,uvec2,uvec2)	function (high_end)	servers/rendering/shader_language.cpp:3520	#1827		uvec2	(uvec2,uvec2,uvec2)		
usubBorrow(uvec3,uvec3,uvec3)	function (high_end)	servers/rendering/shader_language.cpp:3521	#1827		uvec3	(uvec3,uvec3,uvec3)		
usubBorrow(uvec4,uvec4,uvec4)	function (high_end)	servers/rendering/shader_language.cpp:3522	#1827		uvec4	(uvec4,uvec4,uvec4)		
ldexp(float,int)	function (high_end)	servers/rendering/shader_language.cpp:3526	#1827		float	(float,int)		
ldexp(vec2,ivec2)	function (high_end)	servers/rendering/shader_language.cpp:3527	#1827		vec2	(vec2,ivec2)		
ldexp(vec3,ivec3)	function (high_end)	servers/rendering/shader_language.cpp:3528	#1827		vec3	(vec3,ivec3)		
ldexp(vec4,ivec4)	function (high_end)	servers/rendering/shader_language.cpp:3529	#1827		vec4	(vec4,ivec4)		
frexp(float,int)	function (high_end)	servers/rendering/shader_language.cpp:3533	#1827		float	(float,int)		
frexp(vec2,ivec2)	function (high_end)	servers/rendering/shader_language.cpp:3534	#1827		vec2	(vec2,ivec2)		
frexp(vec3,ivec3)	function (high_end)	servers/rendering/shader_language.cpp:3535	#1827		vec3	(vec3,ivec3)		
frexp(vec4,ivec4)	function (high_end)	servers/rendering/shader_language.cpp:3536	#1827		vec4	(vec4,ivec4)		
bvec2.xy	swizzle	servers/rendering/shader_language.cpp:6877	#1823				native	native
bvec2.rg	swizzle	servers/rendering/shader_language.cpp:6877	#1823				native	native
bvec2.st	swizzle	servers/rendering/shader_language.cpp:6877	#1823				native	native
ivec2.xy	swizzle	servers/rendering/shader_language.cpp:6877	#1823				native	native
ivec2.rg	swizzle	servers/rendering/shader_language.cpp:6877	#1823				native	native
ivec2.st	swizzle	servers/rendering/shader_language.cpp:6877	#1823				native	native
uvec2.xy	swizzle	servers/rendering/shader_language.cpp:6877	#1823				native	native
uvec2.rg	swizzle	servers/rendering/shader_language.cpp:6877	#1823				native	native
uvec2.st	swizzle	servers/rendering/shader_language.cpp:6877	#1823				native	native
vec2.xy	swizzle	servers/rendering/shader_language.cpp:6877	#1823				native	native
vec2.rg	swizzle	servers/rendering/shader_language.cpp:6877	#1823				native	native
vec2.st	swizzle	servers/rendering/shader_language.cpp:6877	#1823				native	native
bvec3.xyz	swizzle	servers/rendering/shader_language.cpp:6941	#1823				native	native
bvec3.rgb	swizzle	servers/rendering/shader_language.cpp:6941	#1823				native	native
bvec3.stp	swizzle	servers/rendering/shader_language.cpp:6941	#1823				native	native
ivec3.xyz	swizzle	servers/rendering/shader_language.cpp:6941	#1823				native	native
ivec3.rgb	swizzle	servers/rendering/shader_language.cpp:6941	#1823				native	native
ivec3.stp	swizzle	servers/rendering/shader_language.cpp:6941	#1823				native	native
uvec3.xyz	swizzle	servers/rendering/shader_language.cpp:6941	#1823				native	native
uvec3.rgb	swizzle	servers/rendering/shader_language.cpp:6941	#1823				native	native
uvec3.stp	swizzle	servers/rendering/shader_language.cpp:6941	#1823				native	native
vec3.xyz	swizzle	servers/rendering/shader_language.cpp:6941	#1823				native	native
vec3.rgb	swizzle	servers/rendering/shader_language.cpp:6941	#1823				native	native
vec3.stp	swizzle	servers/rendering/shader_language.cpp:6941	#1823				native	native
bvec4.xyzw	swizzle	servers/rendering/shader_language.cpp:7008	#1823				native	native
bvec4.rgba	swizzle	servers/rendering/shader_language.cpp:7008	#1823				native	native
bvec4.stpq	swizzle	servers/rendering/shader_language.cpp:7008	#1823				native	native
ivec4.xyzw	swizzle	servers/rendering/shader_language.cpp:7008	#1823				native	native
ivec4.rgba	swizzle	servers/rendering/shader_language.cpp:7008	#1823				native	native
ivec4.stpq	swizzle	servers/rendering/shader_language.cpp:7008	#1823				native	native
uvec4.xyzw	swizzle	servers/rendering/shader_language.cpp:7008	#1823				native	native
uvec4.rgba	swizzle	servers/rendering/shader_language.cpp:7008	#1823				native	native
uvec4.stpq	swizzle	servers/rendering/shader_language.cpp:7008	#1823				native	native
vec4.xyzw	swizzle	servers/rendering/shader_language.cpp:7008	#1823				native	native
vec4.rgba	swizzle	servers/rendering/shader_language.cpp:7008	#1823				native	native
vec4.stpq	swizzle	servers/rendering/shader_language.cpp:7008	#1823				native	native
shader_type spatial	shader head	servers/rendering/shader_types.cpp:523	#1794					
shader_type canvas_item	shader head	servers/rendering/shader_types.cpp:524	#1794					
shader_type particles	shader head	servers/rendering/shader_types.cpp:525	#1794					
shader_type sky	shader head	servers/rendering/shader_types.cpp:526	#1794					
shader_type fog	shader head	servers/rendering/shader_types.cpp:527	#1794					
spatial.global.TIME	built-in (read only)	servers/rendering/shader_types.cpp:79	#1794		float			
spatial.global.EXPOSURE	built-in (read only)	servers/rendering/shader_types.cpp:80	#1794		float			
spatial.global.IN_SHADOW_PASS	built-in (read only)	servers/rendering/shader_types.cpp:81	#1794		bool			
spatial.constants.PI	built-in (read only)	servers/rendering/shader_types.cpp:82	#1794		float			
spatial.constants.TAU	built-in (read only)	servers/rendering/shader_types.cpp:83	#1794		float			
spatial.constants.E	built-in (read only)	servers/rendering/shader_types.cpp:84	#1794		float			
spatial.constants.OUTPUT_IS_SRGB	built-in (read only)	servers/rendering/shader_types.cpp:85	#1794		bool			
spatial.constants.CLIP_SPACE_FAR	built-in (read only)	servers/rendering/shader_types.cpp:86	#1794		float			
spatial.constants.IS_MULTIVIEW	built-in (read only)	servers/rendering/shader_types.cpp:87	#1794		bool			
spatial.vertex.VERTEX	built-in	servers/rendering/shader_types.cpp:89	#1794		vec3			
spatial.vertex.NORMAL	built-in	servers/rendering/shader_types.cpp:90	#1794		vec3			
spatial.vertex.TANGENT	built-in	servers/rendering/shader_types.cpp:91	#1794		vec3			
spatial.vertex.BINORMAL	built-in	servers/rendering/shader_types.cpp:92	#1794		vec3			
spatial.vertex.POSITION	built-in	servers/rendering/shader_types.cpp:93	#1794		vec4			
spatial.vertex.UV	built-in	servers/rendering/shader_types.cpp:94	#1794		vec2			
spatial.vertex.UV2	built-in	servers/rendering/shader_types.cpp:95	#1794		vec2			
spatial.vertex.COLOR	built-in	servers/rendering/shader_types.cpp:96	#1794		vec4			
spatial.vertex.POINT_SIZE	built-in	servers/rendering/shader_types.cpp:97	#1794		float			
spatial.vertex.Z_CLIP_SCALE	built-in	servers/rendering/shader_types.cpp:98	#1794		float			
spatial.vertex.INSTANCE_ID	built-in (read only)	servers/rendering/shader_types.cpp:99	#1794		int			
spatial.vertex.INSTANCE_CUSTOM	built-in (read only)	servers/rendering/shader_types.cpp:100	#1794		vec4			
spatial.vertex.VERTEX_ID	built-in (read only)	servers/rendering/shader_types.cpp:101	#1794		int			
spatial.vertex.ROUGHNESS	built-in	servers/rendering/shader_types.cpp:102	#1794		float			
spatial.vertex.BONE_INDICES	built-in (read only)	servers/rendering/shader_types.cpp:103	#1794		uvec4			
spatial.vertex.BONE_WEIGHTS	built-in (read only)	servers/rendering/shader_types.cpp:104	#1794		vec4			
spatial.vertex.CUSTOM0	built-in (read only)	servers/rendering/shader_types.cpp:105	#1794		vec4			
spatial.vertex.CUSTOM1	built-in (read only)	servers/rendering/shader_types.cpp:106	#1794		vec4			
spatial.vertex.CUSTOM2	built-in (read only)	servers/rendering/shader_types.cpp:107	#1794		vec4			
spatial.vertex.CUSTOM3	built-in (read only)	servers/rendering/shader_types.cpp:108	#1794		vec4			
spatial.vertex.MODEL_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:113	#1794		mat4			
spatial.vertex.MODEL_NORMAL_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:114	#1794		mat3			
spatial.vertex.VIEW_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:115	#1794		mat4			
spatial.vertex.INV_VIEW_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:116	#1794		mat4			
spatial.vertex.PROJECTION_MATRIX	built-in	servers/rendering/shader_types.cpp:117	#1794		mat4			
spatial.vertex.INV_PROJECTION_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:118	#1794		mat4			
spatial.vertex.MODELVIEW_MATRIX	built-in	servers/rendering/shader_types.cpp:119	#1794		mat4			
spatial.vertex.MODELVIEW_NORMAL_MATRIX	built-in	servers/rendering/shader_types.cpp:120	#1794		mat3			
spatial.vertex.VIEWPORT_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:121	#1794		vec2			
spatial.vertex.MAIN_CAM_INV_VIEW_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:122	#1794		mat4			
spatial.vertex.NODE_POSITION_WORLD	built-in (read only)	servers/rendering/shader_types.cpp:124	#1794		vec3			
spatial.vertex.CAMERA_POSITION_WORLD	built-in (read only)	servers/rendering/shader_types.cpp:125	#1794		vec3			
spatial.vertex.CAMERA_DIRECTION_WORLD	built-in (read only)	servers/rendering/shader_types.cpp:126	#1794		vec3			
spatial.vertex.CAMERA_VISIBLE_LAYERS	built-in (read only)	servers/rendering/shader_types.cpp:127	#1794		uint			
spatial.vertex.NODE_POSITION_VIEW	built-in (read only)	servers/rendering/shader_types.cpp:128	#1794		vec3			
spatial.vertex.VIEW_INDEX	built-in (read only)	servers/rendering/shader_types.cpp:130	#1794		int			
spatial.vertex.VIEW_MONO_LEFT	built-in (read only)	servers/rendering/shader_types.cpp:131	#1794		int			
spatial.vertex.VIEW_RIGHT	built-in (read only)	servers/rendering/shader_types.cpp:132	#1794		int			
spatial.vertex.EYE_OFFSET	built-in (read only)	servers/rendering/shader_types.cpp:133	#1794		vec3			
spatial.fragment.VERTEX	built-in (read only)	servers/rendering/shader_types.cpp:135	#1794		vec3			
spatial.fragment.LIGHT_VERTEX	built-in	servers/rendering/shader_types.cpp:136	#1794		vec3			
spatial.fragment.FRAGCOORD	built-in (read only)	servers/rendering/shader_types.cpp:137	#1794		vec4			
spatial.fragment.FRONT_FACING	built-in (read only)	servers/rendering/shader_types.cpp:138	#1794		bool			
spatial.fragment.NORMAL	built-in	servers/rendering/shader_types.cpp:139	#1794		vec3			
spatial.fragment.TANGENT	built-in	servers/rendering/shader_types.cpp:140	#1794		vec3			
spatial.fragment.BINORMAL	built-in	servers/rendering/shader_types.cpp:141	#1794		vec3			
spatial.fragment.VIEW	built-in (read only)	servers/rendering/shader_types.cpp:142	#1794		vec3			
spatial.fragment.NORMAL_MAP	built-in	servers/rendering/shader_types.cpp:143	#1794		vec3			
spatial.fragment.NORMAL_MAP_DEPTH	built-in	servers/rendering/shader_types.cpp:144	#1794		float			
spatial.fragment.BENT_NORMAL_MAP	built-in	servers/rendering/shader_types.cpp:145	#1794		vec3			
spatial.fragment.UV	built-in (read only)	servers/rendering/shader_types.cpp:146	#1794		vec2			
spatial.fragment.UV2	built-in (read only)	servers/rendering/shader_types.cpp:147	#1794		vec2			
spatial.fragment.COLOR	built-in (read only)	servers/rendering/shader_types.cpp:148	#1794		vec4			
spatial.fragment.ALBEDO	built-in	servers/rendering/shader_types.cpp:149	#1794		vec3			
spatial.fragment.PREMUL_ALPHA_FACTOR	built-in	servers/rendering/shader_types.cpp:150	#1794		float			
spatial.fragment.ALPHA	built-in	servers/rendering/shader_types.cpp:151	#1794		float			
spatial.fragment.METALLIC	built-in	servers/rendering/shader_types.cpp:152	#1794		float			
spatial.fragment.SPECULAR	built-in	servers/rendering/shader_types.cpp:153	#1794		float			
spatial.fragment.ROUGHNESS	built-in	servers/rendering/shader_types.cpp:154	#1794		float			
spatial.fragment.RIM	built-in	servers/rendering/shader_types.cpp:155	#1794		float			
spatial.fragment.RIM_TINT	built-in	servers/rendering/shader_types.cpp:156	#1794		float			
spatial.fragment.CLEARCOAT	built-in	servers/rendering/shader_types.cpp:157	#1794		float			
spatial.fragment.CLEARCOAT_ROUGHNESS	built-in	servers/rendering/shader_types.cpp:158	#1794		float			
spatial.fragment.ANISOTROPY	built-in	servers/rendering/shader_types.cpp:159	#1794		float			
spatial.fragment.ANISOTROPY_FLOW	built-in	servers/rendering/shader_types.cpp:160	#1794		vec2			
spatial.fragment.SSS_STRENGTH	built-in	servers/rendering/shader_types.cpp:161	#1794		float			
spatial.fragment.SSS_TRANSMITTANCE_COLOR	built-in	servers/rendering/shader_types.cpp:162	#1794		vec4			
spatial.fragment.SSS_TRANSMITTANCE_DEPTH	built-in	servers/rendering/shader_types.cpp:163	#1794		float			
spatial.fragment.SSS_TRANSMITTANCE_BOOST	built-in	servers/rendering/shader_types.cpp:164	#1794		float			
spatial.fragment.BACKLIGHT	built-in	servers/rendering/shader_types.cpp:165	#1794		vec3			
spatial.fragment.AO	built-in	servers/rendering/shader_types.cpp:166	#1794		float			
spatial.fragment.AO_LIGHT_AFFECT	built-in	servers/rendering/shader_types.cpp:167	#1794		float			
spatial.fragment.EMISSION	built-in	servers/rendering/shader_types.cpp:168	#1794		vec3			
spatial.fragment.DEPTH	built-in	servers/rendering/shader_types.cpp:169	#1794		float			
spatial.fragment.SCREEN_UV	built-in (read only)	servers/rendering/shader_types.cpp:170	#1794		vec2			
spatial.fragment.POINT_COORD	built-in (read only)	servers/rendering/shader_types.cpp:171	#1794		vec2			
spatial.fragment.NODE_POSITION_WORLD	built-in (read only)	servers/rendering/shader_types.cpp:173	#1794		vec3			
spatial.fragment.CAMERA_POSITION_WORLD	built-in (read only)	servers/rendering/shader_types.cpp:174	#1794		vec3			
spatial.fragment.CAMERA_DIRECTION_WORLD	built-in (read only)	servers/rendering/shader_types.cpp:175	#1794		vec3			
spatial.fragment.CAMERA_VISIBLE_LAYERS	built-in (read only)	servers/rendering/shader_types.cpp:176	#1794		uint			
spatial.fragment.NODE_POSITION_VIEW	built-in (read only)	servers/rendering/shader_types.cpp:177	#1794		vec3			
spatial.fragment.VIEW_INDEX	built-in (read only)	servers/rendering/shader_types.cpp:179	#1794		int			
spatial.fragment.VIEW_MONO_LEFT	built-in (read only)	servers/rendering/shader_types.cpp:180	#1794		int			
spatial.fragment.VIEW_RIGHT	built-in (read only)	servers/rendering/shader_types.cpp:181	#1794		int			
spatial.fragment.EYE_OFFSET	built-in (read only)	servers/rendering/shader_types.cpp:182	#1794		vec3			
spatial.fragment.MODEL_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:184	#1794		mat4			
spatial.fragment.MODEL_NORMAL_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:185	#1794		mat3			
spatial.fragment.VIEW_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:186	#1794		mat4			
spatial.fragment.INV_VIEW_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:187	#1794		mat4			
spatial.fragment.PROJECTION_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:188	#1794		mat4			
spatial.fragment.INV_PROJECTION_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:189	#1794		mat4			
spatial.fragment.VIEWPORT_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:190	#1794		vec2			
spatial.fragment.FOG	built-in	servers/rendering/shader_types.cpp:191	#1794		vec4			
spatial.fragment.RADIANCE	built-in	servers/rendering/shader_types.cpp:192	#1794		vec4			
spatial.fragment.IRRADIANCE	built-in	servers/rendering/shader_types.cpp:193	#1794		vec4			
spatial.fragment.ALPHA_SCISSOR_THRESHOLD	built-in	servers/rendering/shader_types.cpp:197	#1794		float			
spatial.fragment.ALPHA_HASH_SCALE	built-in	servers/rendering/shader_types.cpp:198	#1794		float			
spatial.fragment.ALPHA_ANTIALIASING_EDGE	built-in	servers/rendering/shader_types.cpp:199	#1794		float			
spatial.fragment.ALPHA_TEXTURE_COORDINATE	built-in	servers/rendering/shader_types.cpp:200	#1794		vec2			
spatial.light.MODEL_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:202	#1794		mat4			
spatial.light.VIEW_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:203	#1794		mat4			
spatial.light.INV_VIEW_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:204	#1794		mat4			
spatial.light.PROJECTION_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:205	#1794		mat4			
spatial.light.INV_PROJECTION_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:206	#1794		mat4			
spatial.light.VIEWPORT_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:207	#1794		vec2			
spatial.light.FRAGCOORD	built-in (read only)	servers/rendering/shader_types.cpp:209	#1794		vec4			
spatial.light.NORMAL	built-in (read only)	servers/rendering/shader_types.cpp:210	#1794		vec3			
spatial.light.UV	built-in (read only)	servers/rendering/shader_types.cpp:211	#1794		vec2			
spatial.light.UV2	built-in (read only)	servers/rendering/shader_types.cpp:212	#1794		vec2			
spatial.light.VIEW	built-in (read only)	servers/rendering/shader_types.cpp:213	#1794		vec3			
spatial.light.SPECULAR_AMOUNT	built-in (read only)	servers/rendering/shader_types.cpp:214	#1794		float			
spatial.light.LIGHT	built-in (read only)	servers/rendering/shader_types.cpp:215	#1794		vec3			
spatial.light.LIGHT_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:216	#1794		vec3			
spatial.light.LIGHT_IS_DIRECTIONAL	built-in (read only)	servers/rendering/shader_types.cpp:217	#1794		bool			
spatial.light.ATTENUATION	built-in (read only)	servers/rendering/shader_types.cpp:218	#1794		float			
spatial.light.ALBEDO	built-in (read only)	servers/rendering/shader_types.cpp:219	#1794		vec3			
spatial.light.BACKLIGHT	built-in (read only)	servers/rendering/shader_types.cpp:220	#1794		vec3			
spatial.light.METALLIC	built-in (read only)	servers/rendering/shader_types.cpp:221	#1794		float			
spatial.light.ROUGHNESS	built-in (read only)	servers/rendering/shader_types.cpp:222	#1794		float			
spatial.light.DIFFUSE_LIGHT	built-in	servers/rendering/shader_types.cpp:223	#1794		vec3			
spatial.light.SPECULAR_LIGHT	built-in	servers/rendering/shader_types.cpp:224	#1794		vec3			
spatial.light.ALPHA	built-in	servers/rendering/shader_types.cpp:225	#1794		float			
spatial.light.SCREEN_UV	built-in (read only)	servers/rendering/shader_types.cpp:226	#1794		vec2			
canvas_item.global.TIME	built-in (read only)	servers/rendering/shader_types.cpp:264	#1794		float			
canvas_item.constants.PI	built-in (read only)	servers/rendering/shader_types.cpp:265	#1794		float			
canvas_item.constants.TAU	built-in (read only)	servers/rendering/shader_types.cpp:266	#1794		float			
canvas_item.constants.E	built-in (read only)	servers/rendering/shader_types.cpp:267	#1794		float			
canvas_item.vertex.VERTEX	built-in	servers/rendering/shader_types.cpp:269	#1794		vec2			
canvas_item.vertex.UV	built-in	servers/rendering/shader_types.cpp:270	#1794		vec2			
canvas_item.vertex.COLOR	built-in	servers/rendering/shader_types.cpp:271	#1794		vec4			
canvas_item.vertex.POINT_SIZE	built-in	servers/rendering/shader_types.cpp:272	#1794		float			
canvas_item.vertex.MODEL_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:274	#1794		mat4			
canvas_item.vertex.CANVAS_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:275	#1794		mat4			
canvas_item.vertex.SCREEN_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:276	#1794		mat4			
canvas_item.vertex.INSTANCE_CUSTOM	built-in (read only)	servers/rendering/shader_types.cpp:277	#1794		vec4			
canvas_item.vertex.INSTANCE_ID	built-in (read only)	servers/rendering/shader_types.cpp:278	#1794		int			
canvas_item.vertex.VERTEX_ID	built-in (read only)	servers/rendering/shader_types.cpp:279	#1794		int			
canvas_item.vertex.AT_LIGHT_PASS	built-in (read only)	servers/rendering/shader_types.cpp:280	#1794		bool			
canvas_item.vertex.TEXTURE_PIXEL_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:281	#1794		vec2			
canvas_item.vertex.CUSTOM0	built-in (read only)	servers/rendering/shader_types.cpp:282	#1794		vec4			
canvas_item.vertex.CUSTOM1	built-in (read only)	servers/rendering/shader_types.cpp:283	#1794		vec4			
canvas_item.fragment.VERTEX	built-in	servers/rendering/shader_types.cpp:287	#1794		vec2			
canvas_item.fragment.SHADOW_VERTEX	built-in	servers/rendering/shader_types.cpp:288	#1794		vec2			
canvas_item.fragment.LIGHT_VERTEX	built-in	servers/rendering/shader_types.cpp:289	#1794		vec3			
canvas_item.fragment.FRAGCOORD	built-in (read only)	servers/rendering/shader_types.cpp:290	#1794		vec4			
canvas_item.fragment.NORMAL	built-in	servers/rendering/shader_types.cpp:291	#1794		vec3			
canvas_item.fragment.NORMAL_MAP	built-in	servers/rendering/shader_types.cpp:292	#1794		vec3			
canvas_item.fragment.NORMAL_MAP_DEPTH	built-in	servers/rendering/shader_types.cpp:293	#1794		float			
canvas_item.fragment.UV	built-in (read only)	servers/rendering/shader_types.cpp:294	#1794		vec2			
canvas_item.fragment.COLOR	built-in	servers/rendering/shader_types.cpp:295	#1794		vec4			
canvas_item.fragment.TEXTURE	built-in (read only)	servers/rendering/shader_types.cpp:296	#1794		sampler2D			
canvas_item.fragment.TEXTURE_PIXEL_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:297	#1794		vec2			
canvas_item.fragment.NORMAL_TEXTURE	built-in (read only)	servers/rendering/shader_types.cpp:298	#1794		sampler2D			
canvas_item.fragment.SPECULAR_SHININESS_TEXTURE	built-in (read only)	servers/rendering/shader_types.cpp:299	#1794		sampler2D			
canvas_item.fragment.SPECULAR_SHININESS	built-in (read only)	servers/rendering/shader_types.cpp:300	#1794		vec4			
canvas_item.fragment.SCREEN_UV	built-in (read only)	servers/rendering/shader_types.cpp:301	#1794		vec2			
canvas_item.fragment.REGION_RECT	built-in (read only)	servers/rendering/shader_types.cpp:302	#1794		vec4			
canvas_item.fragment.SCREEN_PIXEL_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:303	#1794		vec2			
canvas_item.fragment.POINT_COORD	built-in (read only)	servers/rendering/shader_types.cpp:304	#1794		vec2			
canvas_item.fragment.AT_LIGHT_PASS	built-in (read only)	servers/rendering/shader_types.cpp:305	#1794		bool			
canvas_item.light.FRAGCOORD	built-in (read only)	servers/rendering/shader_types.cpp:332	#1794		vec4			
canvas_item.light.NORMAL	built-in (read only)	servers/rendering/shader_types.cpp:333	#1794		vec3			
canvas_item.light.COLOR	built-in (read only)	servers/rendering/shader_types.cpp:334	#1794		vec4			
canvas_item.light.UV	built-in (read only)	servers/rendering/shader_types.cpp:335	#1794		vec2			
canvas_item.light.SPECULAR_SHININESS	built-in (read only)	servers/rendering/shader_types.cpp:336	#1794		vec4			
canvas_item.light.LIGHT_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:337	#1794		vec4			
canvas_item.light.LIGHT_POSITION	built-in (read only)	servers/rendering/shader_types.cpp:338	#1794		vec3			
canvas_item.light.LIGHT_DIRECTION	built-in (read only)	servers/rendering/shader_types.cpp:339	#1794		vec3			
canvas_item.light.LIGHT_ENERGY	built-in (read only)	servers/rendering/shader_types.cpp:340	#1794		float			
canvas_item.light.LIGHT_IS_DIRECTIONAL	built-in (read only)	servers/rendering/shader_types.cpp:341	#1794		bool			
canvas_item.light.LIGHT_VERTEX	built-in (read only)	servers/rendering/shader_types.cpp:342	#1794		vec3			
canvas_item.light.LIGHT	built-in	servers/rendering/shader_types.cpp:343	#1794		vec4			
canvas_item.light.SHADOW_MODULATE	built-in	servers/rendering/shader_types.cpp:344	#1794		vec4			
canvas_item.light.SCREEN_UV	built-in (read only)	servers/rendering/shader_types.cpp:345	#1794		vec2			
canvas_item.light.TEXTURE	built-in (read only)	servers/rendering/shader_types.cpp:346	#1794		sampler2D			
canvas_item.light.TEXTURE_PIXEL_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:347	#1794		vec2			
canvas_item.light.POINT_COORD	built-in (read only)	servers/rendering/shader_types.cpp:348	#1794		vec2			
particles.global.TIME	built-in (read only)	servers/rendering/shader_types.cpp:363	#1794		float			
particles.constants.PI	built-in (read only)	servers/rendering/shader_types.cpp:364	#1794		float			
particles.constants.TAU	built-in (read only)	servers/rendering/shader_types.cpp:365	#1794		float			
particles.constants.E	built-in (read only)	servers/rendering/shader_types.cpp:366	#1794		float			
particles.start.COLOR	built-in	servers/rendering/shader_types.cpp:368	#1794		vec4			
particles.start.VELOCITY	built-in	servers/rendering/shader_types.cpp:369	#1794		vec3			
particles.start.MASS	built-in	servers/rendering/shader_types.cpp:370	#1794		float			
particles.start.ACTIVE	built-in	servers/rendering/shader_types.cpp:371	#1794		bool			
particles.start.CUSTOM	built-in	servers/rendering/shader_types.cpp:372	#1794		vec4			
particles.start.USERDATA1	built-in	servers/rendering/shader_types.cpp:373	#1794		vec4			
particles.start.USERDATA2	built-in	servers/rendering/shader_types.cpp:374	#1794		vec4			
particles.start.USERDATA3	built-in	servers/rendering/shader_types.cpp:375	#1794		vec4			
particles.start.USERDATA4	built-in	servers/rendering/shader_types.cpp:376	#1794		vec4			
particles.start.USERDATA5	built-in	servers/rendering/shader_types.cpp:377	#1794		vec4			
particles.start.USERDATA6	built-in	servers/rendering/shader_types.cpp:378	#1794		vec4			
particles.start.TRANSFORM	built-in	servers/rendering/shader_types.cpp:379	#1794		mat4			
particles.start.LIFETIME	built-in (read only)	servers/rendering/shader_types.cpp:380	#1794		float			
particles.start.DELTA	built-in (read only)	servers/rendering/shader_types.cpp:381	#1794		float			
particles.start.NUMBER	built-in (read only)	servers/rendering/shader_types.cpp:382	#1794		uint			
particles.start.INDEX	built-in (read only)	servers/rendering/shader_types.cpp:383	#1794		uint			
particles.start.EMISSION_TRANSFORM	built-in (read only)	servers/rendering/shader_types.cpp:384	#1794		mat4			
particles.start.EMITTER_VELOCITY	built-in (read only)	servers/rendering/shader_types.cpp:385	#1794		vec3			
particles.start.INTERPOLATE_TO_END	built-in (read only)	servers/rendering/shader_types.cpp:386	#1794		float			
particles.start.RANDOM_SEED	built-in (read only)	servers/rendering/shader_types.cpp:387	#1794		uint			
particles.start.FLAG_EMIT_POSITION	built-in (read only)	servers/rendering/shader_types.cpp:388	#1794		uint			
particles.start.FLAG_EMIT_ROT_SCALE	built-in (read only)	servers/rendering/shader_types.cpp:389	#1794		uint			
particles.start.FLAG_EMIT_VELOCITY	built-in (read only)	servers/rendering/shader_types.cpp:390	#1794		uint			
particles.start.FLAG_EMIT_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:391	#1794		uint			
particles.start.FLAG_EMIT_CUSTOM	built-in (read only)	servers/rendering/shader_types.cpp:392	#1794		uint			
particles.start.RESTART_POSITION	built-in (read only)	servers/rendering/shader_types.cpp:393	#1794		bool			
particles.start.RESTART_ROT_SCALE	built-in (read only)	servers/rendering/shader_types.cpp:394	#1794		bool			
particles.start.RESTART_VELOCITY	built-in (read only)	servers/rendering/shader_types.cpp:395	#1794		bool			
particles.start.RESTART_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:396	#1794		bool			
particles.start.RESTART_CUSTOM	built-in (read only)	servers/rendering/shader_types.cpp:397	#1794		bool			
particles.start.AMOUNT_RATIO	built-in (read only)	servers/rendering/shader_types.cpp:398	#1794		float			
particles.process.COLOR	built-in	servers/rendering/shader_types.cpp:401	#1794		vec4			
particles.process.VELOCITY	built-in	servers/rendering/shader_types.cpp:402	#1794		vec3			
particles.process.MASS	built-in	servers/rendering/shader_types.cpp:403	#1794		float			
particles.process.ACTIVE	built-in	servers/rendering/shader_types.cpp:404	#1794		bool			
particles.process.RESTART	built-in (read only)	servers/rendering/shader_types.cpp:405	#1794		bool			
particles.process.CUSTOM	built-in	servers/rendering/shader_types.cpp:406	#1794		vec4			
particles.process.USERDATA1	built-in	servers/rendering/shader_types.cpp:407	#1794		vec4			
particles.process.USERDATA2	built-in	servers/rendering/shader_types.cpp:408	#1794		vec4			
particles.process.USERDATA3	built-in	servers/rendering/shader_types.cpp:409	#1794		vec4			
particles.process.USERDATA4	built-in	servers/rendering/shader_types.cpp:410	#1794		vec4			
particles.process.USERDATA5	built-in	servers/rendering/shader_types.cpp:411	#1794		vec4			
particles.process.USERDATA6	built-in	servers/rendering/shader_types.cpp:412	#1794		vec4			
particles.process.TRANSFORM	built-in	servers/rendering/shader_types.cpp:413	#1794		mat4			
particles.process.LIFETIME	built-in (read only)	servers/rendering/shader_types.cpp:414	#1794		float			
particles.process.DELTA	built-in (read only)	servers/rendering/shader_types.cpp:415	#1794		float			
particles.process.NUMBER	built-in (read only)	servers/rendering/shader_types.cpp:416	#1794		uint			
particles.process.INDEX	built-in (read only)	servers/rendering/shader_types.cpp:417	#1794		uint			
particles.process.EMISSION_TRANSFORM	built-in (read only)	servers/rendering/shader_types.cpp:418	#1794		mat4			
particles.process.EMITTER_VELOCITY	built-in (read only)	servers/rendering/shader_types.cpp:419	#1794		vec3			
particles.process.INTERPOLATE_TO_END	built-in (read only)	servers/rendering/shader_types.cpp:420	#1794		float			
particles.process.RANDOM_SEED	built-in (read only)	servers/rendering/shader_types.cpp:421	#1794		uint			
particles.process.FLAG_EMIT_POSITION	built-in (read only)	servers/rendering/shader_types.cpp:422	#1794		uint			
particles.process.FLAG_EMIT_ROT_SCALE	built-in (read only)	servers/rendering/shader_types.cpp:423	#1794		uint			
particles.process.FLAG_EMIT_VELOCITY	built-in (read only)	servers/rendering/shader_types.cpp:424	#1794		uint			
particles.process.FLAG_EMIT_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:425	#1794		uint			
particles.process.FLAG_EMIT_CUSTOM	built-in (read only)	servers/rendering/shader_types.cpp:426	#1794		uint			
particles.process.COLLIDED	built-in (read only)	servers/rendering/shader_types.cpp:427	#1794		bool			
particles.process.COLLISION_NORMAL	built-in (read only)	servers/rendering/shader_types.cpp:428	#1794		vec3			
particles.process.COLLISION_DEPTH	built-in (read only)	servers/rendering/shader_types.cpp:429	#1794		float			
particles.process.ATTRACTOR_FORCE	built-in (read only)	servers/rendering/shader_types.cpp:430	#1794		vec3			
particles.process.AMOUNT_RATIO	built-in (read only)	servers/rendering/shader_types.cpp:431	#1794		float			
sky.global.TIME	built-in (read only)	servers/rendering/shader_types.cpp:456	#1794		float			
sky.constants.PI	built-in (read only)	servers/rendering/shader_types.cpp:457	#1794		float			
sky.constants.TAU	built-in (read only)	servers/rendering/shader_types.cpp:458	#1794		float			
sky.constants.E	built-in (read only)	servers/rendering/shader_types.cpp:459	#1794		float			
sky.global.POSITION	built-in (read only)	servers/rendering/shader_types.cpp:460	#1794		vec3			
sky.global.RADIANCE	built-in (read only)	servers/rendering/shader_types.cpp:461	#1794		samplerCube			
sky.global.AT_HALF_RES_PASS	built-in (read only)	servers/rendering/shader_types.cpp:462	#1794		bool			
sky.global.AT_QUARTER_RES_PASS	built-in (read only)	servers/rendering/shader_types.cpp:463	#1794		bool			
sky.global.AT_CUBEMAP_PASS	built-in (read only)	servers/rendering/shader_types.cpp:464	#1794		bool			
sky.global.LIGHT0_ENABLED	built-in (read only)	servers/rendering/shader_types.cpp:465	#1794		bool			
sky.global.LIGHT0_DIRECTION	built-in (read only)	servers/rendering/shader_types.cpp:466	#1794		vec3			
sky.global.LIGHT0_ENERGY	built-in (read only)	servers/rendering/shader_types.cpp:467	#1794		float			
sky.global.LIGHT0_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:468	#1794		vec3			
sky.global.LIGHT0_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:469	#1794		float			
sky.global.LIGHT1_ENABLED	built-in (read only)	servers/rendering/shader_types.cpp:470	#1794		bool			
sky.global.LIGHT1_DIRECTION	built-in (read only)	servers/rendering/shader_types.cpp:471	#1794		vec3			
sky.global.LIGHT1_ENERGY	built-in (read only)	servers/rendering/shader_types.cpp:472	#1794		float			
sky.global.LIGHT1_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:473	#1794		vec3			
sky.global.LIGHT1_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:474	#1794		float			
sky.global.LIGHT2_ENABLED	built-in (read only)	servers/rendering/shader_types.cpp:475	#1794		bool			
sky.global.LIGHT2_DIRECTION	built-in (read only)	servers/rendering/shader_types.cpp:476	#1794		vec3			
sky.global.LIGHT2_ENERGY	built-in (read only)	servers/rendering/shader_types.cpp:477	#1794		float			
sky.global.LIGHT2_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:478	#1794		vec3			
sky.global.LIGHT2_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:479	#1794		float			
sky.global.LIGHT3_ENABLED	built-in (read only)	servers/rendering/shader_types.cpp:480	#1794		bool			
sky.global.LIGHT3_DIRECTION	built-in (read only)	servers/rendering/shader_types.cpp:481	#1794		vec3			
sky.global.LIGHT3_ENERGY	built-in (read only)	servers/rendering/shader_types.cpp:482	#1794		float			
sky.global.LIGHT3_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:483	#1794		vec3			
sky.global.LIGHT3_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:484	#1794		float			
sky.sky.COLOR	built-in	servers/rendering/shader_types.cpp:486	#1794		vec3			
sky.sky.ALPHA	built-in	servers/rendering/shader_types.cpp:487	#1794		float			
sky.sky.EYEDIR	built-in (read only)	servers/rendering/shader_types.cpp:488	#1794		vec3			
sky.sky.SCREEN_UV	built-in (read only)	servers/rendering/shader_types.cpp:489	#1794		vec2			
sky.sky.FRAGCOORD	built-in (read only)	servers/rendering/shader_types.cpp:490	#1794		vec4			
sky.sky.SKY_COORDS	built-in (read only)	servers/rendering/shader_types.cpp:491	#1794		vec2			
sky.sky.HALF_RES_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:492	#1794		vec4			
sky.sky.QUARTER_RES_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:493	#1794		vec4			
sky.sky.FOG	built-in	servers/rendering/shader_types.cpp:494	#1794		vec4			
fog.global.TIME	built-in (read only)	servers/rendering/shader_types.cpp:507	#1794		float			
fog.constants.PI	built-in (read only)	servers/rendering/shader_types.cpp:508	#1794		float			
fog.constants.TAU	built-in (read only)	servers/rendering/shader_types.cpp:509	#1794		float			
fog.constants.E	built-in (read only)	servers/rendering/shader_types.cpp:510	#1794		float			
fog.fog.WORLD_POSITION	built-in (read only)	servers/rendering/shader_types.cpp:512	#1794		vec3			
fog.fog.OBJECT_POSITION	built-in (read only)	servers/rendering/shader_types.cpp:513	#1794		vec3			
fog.fog.UVW	built-in (read only)	servers/rendering/shader_types.cpp:514	#1794		vec3			
fog.fog.SIZE	built-in (read only)	servers/rendering/shader_types.cpp:515	#1794		vec3			
fog.fog.SDF	built-in (read only)	servers/rendering/shader_types.cpp:516	#1794		float			
fog.fog.ALBEDO	built-in	servers/rendering/shader_types.cpp:517	#1794		vec3			
fog.fog.DENSITY	built-in	servers/rendering/shader_types.cpp:518	#1794		float			
fog.fog.EMISSION	built-in	servers/rendering/shader_types.cpp:519	#1794		vec3			
canvas_item.fragment.texture_sdf(vec2)	stage function	servers/rendering/shader_types.cpp:314	#1794		float	(vec2)		
canvas_item.light.texture_sdf(vec2)	stage function	servers/rendering/shader_types.cpp:315	#1794		float	(vec2)		
canvas_item.fragment.sdf_to_screen_uv(vec2)	stage function	servers/rendering/shader_types.cpp:317	#1794		vec2	(vec2)		
canvas_item.light.sdf_to_screen_uv(vec2)	stage function	servers/rendering/shader_types.cpp:318	#1794		vec2	(vec2)		
canvas_item.fragment.texture_sdf_normal(vec2)	stage function	servers/rendering/shader_types.cpp:319	#1794		vec2	(vec2)		
canvas_item.light.texture_sdf_normal(vec2)	stage function	servers/rendering/shader_types.cpp:320	#1794		vec2	(vec2)		
canvas_item.fragment.screen_uv_to_sdf(vec2)	stage function	servers/rendering/shader_types.cpp:328	#1794		vec2	(vec2)		
canvas_item.light.screen_uv_to_sdf(vec2)	stage function	servers/rendering/shader_types.cpp:329	#1794		vec2	(vec2)		
particles.start.emit_subparticle(mat4,vec3,vec4,vec4,uint)	stage function	servers/rendering/shader_types.cpp:442	#1794		bool	(mat4,vec3,vec4,vec4,uint)		
particles.process.emit_subparticle(mat4,vec3,vec4,vec4,uint)	stage function	servers/rendering/shader_types.cpp:443	#1794		bool	(mat4,vec3,vec4,vec4,uint)		
spatial render_mode blend_mix	render mode	servers/rendering/shader_types.cpp:233	#1794					
spatial render_mode blend_add	render mode	servers/rendering/shader_types.cpp:233	#1794					
spatial render_mode blend_sub	render mode	servers/rendering/shader_types.cpp:233	#1794					
spatial render_mode blend_mul	render mode	servers/rendering/shader_types.cpp:233	#1794					
spatial render_mode blend_premul_alpha	render mode	servers/rendering/shader_types.cpp:233	#1794					
spatial render_mode depth_draw_opaque	render mode	servers/rendering/shader_types.cpp:234	#1794					
spatial render_mode depth_draw_always	render mode	servers/rendering/shader_types.cpp:234	#1794					
spatial render_mode depth_draw_never	render mode	servers/rendering/shader_types.cpp:234	#1794					
spatial render_mode depth_prepass_alpha	render mode	servers/rendering/shader_types.cpp:235	#1794					
spatial render_mode depth_test_default	render mode	servers/rendering/shader_types.cpp:236	#1794					
spatial render_mode depth_test_disabled	render mode	servers/rendering/shader_types.cpp:236	#1794					
spatial render_mode depth_test_inverted	render mode	servers/rendering/shader_types.cpp:236	#1794					
spatial render_mode sss_mode_skin	render mode	servers/rendering/shader_types.cpp:237	#1794					
spatial render_mode cull_back	render mode	servers/rendering/shader_types.cpp:238	#1794					
spatial render_mode cull_front	render mode	servers/rendering/shader_types.cpp:238	#1794					
spatial render_mode cull_disabled	render mode	servers/rendering/shader_types.cpp:238	#1794					
spatial render_mode unshaded	render mode	servers/rendering/shader_types.cpp:239	#1794					
spatial render_mode wireframe	render mode	servers/rendering/shader_types.cpp:240	#1794					
spatial render_mode diffuse_lambert	render mode	servers/rendering/shader_types.cpp:241	#1794					
spatial render_mode diffuse_lambert_wrap	render mode	servers/rendering/shader_types.cpp:241	#1794					
spatial render_mode diffuse_burley	render mode	servers/rendering/shader_types.cpp:241	#1794					
spatial render_mode diffuse_toon	render mode	servers/rendering/shader_types.cpp:241	#1794					
spatial render_mode specular_schlick_ggx	render mode	servers/rendering/shader_types.cpp:242	#1794					
spatial render_mode specular_toon	render mode	servers/rendering/shader_types.cpp:242	#1794					
spatial render_mode specular_disabled	render mode	servers/rendering/shader_types.cpp:242	#1794					
spatial render_mode skip_vertex_transform	render mode	servers/rendering/shader_types.cpp:243	#1794					
spatial render_mode world_vertex_coords	render mode	servers/rendering/shader_types.cpp:244	#1794					
spatial render_mode ensure_correct_normals	render mode	servers/rendering/shader_types.cpp:245	#1794					
spatial render_mode shadows_disabled	render mode	servers/rendering/shader_types.cpp:246	#1794					
spatial render_mode ambient_light_disabled	render mode	servers/rendering/shader_types.cpp:247	#1794					
spatial render_mode shadow_to_opacity	render mode	servers/rendering/shader_types.cpp:248	#1794					
spatial render_mode vertex_lighting	render mode	servers/rendering/shader_types.cpp:249	#1794					
spatial render_mode particle_trails	render mode	servers/rendering/shader_types.cpp:250	#1794					
spatial render_mode alpha_to_coverage	render mode	servers/rendering/shader_types.cpp:251	#1794					
spatial render_mode alpha_to_coverage_and_one	render mode	servers/rendering/shader_types.cpp:252	#1794					
spatial render_mode debug_shadow_splits	render mode	servers/rendering/shader_types.cpp:253	#1794					
spatial render_mode fog_disabled	render mode	servers/rendering/shader_types.cpp:254	#1794					
spatial render_mode specular_occlusion_disabled	render mode	servers/rendering/shader_types.cpp:255	#1794					
spatial stencil_mode read	stencil mode	servers/rendering/shader_types.cpp:256	#1794					
spatial stencil_mode write	stencil mode	servers/rendering/shader_types.cpp:257	#1794					
spatial stencil_mode write_depth_fail	stencil mode	servers/rendering/shader_types.cpp:258	#1794					
spatial stencil_mode compare_always	stencil mode	servers/rendering/shader_types.cpp:259	#1794					
spatial stencil_mode compare_less	stencil mode	servers/rendering/shader_types.cpp:259	#1794					
spatial stencil_mode compare_equal	stencil mode	servers/rendering/shader_types.cpp:259	#1794					
spatial stencil_mode compare_less_or_equal	stencil mode	servers/rendering/shader_types.cpp:259	#1794					
spatial stencil_mode compare_greater	stencil mode	servers/rendering/shader_types.cpp:259	#1794					
spatial stencil_mode compare_not_equal	stencil mode	servers/rendering/shader_types.cpp:259	#1794					
spatial stencil_mode compare_greater_or_equal	stencil mode	servers/rendering/shader_types.cpp:259	#1794					
canvas_item render_mode skip_vertex_transform	render mode	servers/rendering/shader_types.cpp:354	#1794					
canvas_item render_mode blend_mix	render mode	servers/rendering/shader_types.cpp:355	#1794					
canvas_item render_mode blend_add	render mode	servers/rendering/shader_types.cpp:355	#1794					
canvas_item render_mode blend_sub	render mode	servers/rendering/shader_types.cpp:355	#1794					
canvas_item render_mode blend_mul	render mode	servers/rendering/shader_types.cpp:355	#1794					
canvas_item render_mode blend_premul_alpha	render mode	servers/rendering/shader_types.cpp:355	#1794					
canvas_item render_mode blend_disabled	render mode	servers/rendering/shader_types.cpp:355	#1794					
canvas_item render_mode unshaded	render mode	servers/rendering/shader_types.cpp:356	#1794					
canvas_item render_mode light_only	render mode	servers/rendering/shader_types.cpp:357	#1794					
canvas_item render_mode world_vertex_coords	render mode	servers/rendering/shader_types.cpp:358	#1794					
particles render_mode collision_use_scale	render mode	servers/rendering/shader_types.cpp:448	#1794					
particles render_mode disable_force	render mode	servers/rendering/shader_types.cpp:449	#1794					
particles render_mode disable_velocity	render mode	servers/rendering/shader_types.cpp:450	#1794					
particles render_mode keep_data	render mode	servers/rendering/shader_types.cpp:451	#1794					
sky render_mode use_half_res_pass	render mode	servers/rendering/shader_types.cpp:499	#1794					
sky render_mode use_quarter_res_pass	render mode	servers/rendering/shader_types.cpp:500	#1794					
sky render_mode disable_fog	render mode	servers/rendering/shader_types.cpp:501	#1794					
sky render_mode use_debanding	render mode	servers/rendering/shader_types.cpp:502	#1794					
#if	preprocessor	servers/rendering/shader_preprocessor.cpp:384	#1828					
#ifdef	preprocessor	servers/rendering/shader_preprocessor.cpp:386	#1828					
#ifndef	preprocessor	servers/rendering/shader_preprocessor.cpp:388	#1828					
#elif	preprocessor	servers/rendering/shader_preprocessor.cpp:390	#1828					
#else	preprocessor	servers/rendering/shader_preprocessor.cpp:392	#1828					
#endif	preprocessor	servers/rendering/shader_preprocessor.cpp:394	#1828					
#error	preprocessor	servers/rendering/shader_preprocessor.cpp:396	#1828					
#define	preprocessor	servers/rendering/shader_preprocessor.cpp:398	#1828					
#undef	preprocessor	servers/rendering/shader_preprocessor.cpp:400	#1828					
#include	preprocessor	servers/rendering/shader_preprocessor.cpp:402	#1828					
#pragma	preprocessor	servers/rendering/shader_preprocessor.cpp:404	#1828					
defined	preprocessor	servers/rendering/shader_preprocessor.cpp:910	#1828					
#pragma disable_preprocessor	preprocessor	servers/rendering/shader_preprocessor.cpp:803	#1828					
`;

function readRow(line: string): InstructionRow {
  const [id = '', family = '', source = '', owner = '', token, returns, args, webgl2, webgpu] =
    line.split('\t');
  return {
    id,
    family,
    source,
    owner,
    ...(token ? { token } : {}),
    ...(returns ? { returns } : {}),
    ...(args ? { args: args === '()' ? [] : args.slice(1, -1).split(',') } : {}),
    ...(webgl2 ? { webgl2 } : {}),
    ...(webgpu ? { webgpu } : {}),
  };
}

export const INSTRUCTION_TABLE: readonly InstructionRow[] = ROWS.trim().split('\n').map(readRow);
