/**
 * The instruction table of Godot 4.6.3's shading language, read from Godot's source.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm godot:shader-language
 */

/** One instruction: a type, a keyword, an operator signature, a function overload or a built-in. */
export interface InstructionRow {
  readonly id: string;
  readonly family: string;
  /** Godot's `file:line` that defines it. */
  readonly source: string;
  /** Godot's token for a keyword. */
  readonly token?: string;
  readonly returns?: string;
  readonly args?: readonly string[];
}

/**
 * One row per line: id, family, source, token, returns, args, tab-separated. An empty field is absent, and the
 * args are a bracketed list, so a function of no arguments has `()`.
 */
const ROWS = `
void	data type	servers/rendering/shader_language.h:210	TK_TYPE_VOID		
bool	data type	servers/rendering/shader_language.h:211	TK_TYPE_BOOL		
bvec2	data type	servers/rendering/shader_language.h:212	TK_TYPE_BVEC2		
bvec3	data type	servers/rendering/shader_language.h:213	TK_TYPE_BVEC3		
bvec4	data type	servers/rendering/shader_language.h:214	TK_TYPE_BVEC4		
int	data type	servers/rendering/shader_language.h:215	TK_TYPE_INT		
ivec2	data type	servers/rendering/shader_language.h:216	TK_TYPE_IVEC2		
ivec3	data type	servers/rendering/shader_language.h:217	TK_TYPE_IVEC3		
ivec4	data type	servers/rendering/shader_language.h:218	TK_TYPE_IVEC4		
uint	data type	servers/rendering/shader_language.h:219	TK_TYPE_UINT		
uvec2	data type	servers/rendering/shader_language.h:220	TK_TYPE_UVEC2		
uvec3	data type	servers/rendering/shader_language.h:221	TK_TYPE_UVEC3		
uvec4	data type	servers/rendering/shader_language.h:222	TK_TYPE_UVEC4		
float	data type	servers/rendering/shader_language.h:223	TK_TYPE_FLOAT		
vec2	data type	servers/rendering/shader_language.h:224	TK_TYPE_VEC2		
vec3	data type	servers/rendering/shader_language.h:225	TK_TYPE_VEC3		
vec4	data type	servers/rendering/shader_language.h:226	TK_TYPE_VEC4		
mat2	data type	servers/rendering/shader_language.h:227	TK_TYPE_MAT2		
mat3	data type	servers/rendering/shader_language.h:228	TK_TYPE_MAT3		
mat4	data type	servers/rendering/shader_language.h:229	TK_TYPE_MAT4		
sampler2D	data type	servers/rendering/shader_language.h:230	TK_TYPE_SAMPLER2D		
isampler2D	data type	servers/rendering/shader_language.h:231	TK_TYPE_ISAMPLER2D		
usampler2D	data type	servers/rendering/shader_language.h:232	TK_TYPE_USAMPLER2D		
sampler2DArray	data type	servers/rendering/shader_language.h:233	TK_TYPE_SAMPLER2DARRAY		
isampler2DArray	data type	servers/rendering/shader_language.h:234	TK_TYPE_ISAMPLER2DARRAY		
usampler2DArray	data type	servers/rendering/shader_language.h:235	TK_TYPE_USAMPLER2DARRAY		
sampler3D	data type	servers/rendering/shader_language.h:236	TK_TYPE_SAMPLER3D		
isampler3D	data type	servers/rendering/shader_language.h:237	TK_TYPE_ISAMPLER3D		
usampler3D	data type	servers/rendering/shader_language.h:238	TK_TYPE_USAMPLER3D		
samplerCube	data type	servers/rendering/shader_language.h:239	TK_TYPE_SAMPLERCUBE		
samplerCubeArray	data type	servers/rendering/shader_language.h:240	TK_TYPE_SAMPLERCUBEARRAY		
samplerExternalOES	data type	servers/rendering/shader_language.h:241	TK_TYPE_SAMPLEREXT		
struct type	data type	servers/rendering/shader_language.h:242			
float literal	literal	servers/rendering/shader_language.h:59			
int literal	literal	servers/rendering/shader_language.h:60			
uint literal	literal	servers/rendering/shader_language.h:61			
true	literal	servers/rendering/shader_language.cpp:284	TK_TRUE		
false	literal	servers/rendering/shader_language.cpp:285	TK_FALSE		
flat	qualifier	servers/rendering/shader_language.cpp:324	TK_INTERPOLATION_FLAT		
smooth	qualifier	servers/rendering/shader_language.cpp:325	TK_INTERPOLATION_SMOOTH		
lowp	qualifier	servers/rendering/shader_language.cpp:329	TK_PRECISION_LOW		
mediump	qualifier	servers/rendering/shader_language.cpp:330	TK_PRECISION_MID		
highp	qualifier	servers/rendering/shader_language.cpp:331	TK_PRECISION_HIGH		
uniform	shader head	servers/rendering/shader_language.cpp:335	TK_UNIFORM		
group_uniforms	shader head	servers/rendering/shader_language.cpp:336	TK_UNIFORM_GROUP		
varying	shader head	servers/rendering/shader_language.cpp:337	TK_VARYING		
const	shader head	servers/rendering/shader_language.cpp:338	TK_CONST		
struct	shader head	servers/rendering/shader_language.cpp:339	TK_STRUCT		
shader_type	shader head	servers/rendering/shader_language.cpp:340	TK_SHADER_TYPE		
render_mode	shader head	servers/rendering/shader_language.cpp:341	TK_RENDER_MODE		
stencil_mode	shader head	servers/rendering/shader_language.cpp:342	TK_STENCIL_MODE		
instance	uniform	servers/rendering/shader_language.cpp:346	TK_INSTANCE		
global	uniform	servers/rendering/shader_language.cpp:347	TK_GLOBAL		
if	statement keyword	servers/rendering/shader_language.cpp:351	TK_CF_IF		
else	statement keyword	servers/rendering/shader_language.cpp:352	TK_CF_ELSE		
for	statement keyword	servers/rendering/shader_language.cpp:353	TK_CF_FOR		
while	statement keyword	servers/rendering/shader_language.cpp:354	TK_CF_WHILE		
do	statement keyword	servers/rendering/shader_language.cpp:355	TK_CF_DO		
switch	statement keyword	servers/rendering/shader_language.cpp:356	TK_CF_SWITCH		
case	statement keyword	servers/rendering/shader_language.cpp:357	TK_CF_CASE		
default	statement keyword	servers/rendering/shader_language.cpp:358	TK_CF_DEFAULT		
break	statement keyword	servers/rendering/shader_language.cpp:359	TK_CF_BREAK		
continue	statement keyword	servers/rendering/shader_language.cpp:360	TK_CF_CONTINUE		
return	statement keyword	servers/rendering/shader_language.cpp:361	TK_CF_RETURN		
discard	statement keyword	servers/rendering/shader_language.cpp:362	TK_CF_DISCARD		
in	qualifier	servers/rendering/shader_language.cpp:366	TK_ARG_IN		
out	qualifier	servers/rendering/shader_language.cpp:367	TK_ARG_OUT		
inout	qualifier	servers/rendering/shader_language.cpp:368	TK_ARG_INOUT		
source_color	uniform hint	servers/rendering/shader_language.cpp:372	TK_HINT_SOURCE_COLOR		
color_conversion_disabled	uniform hint	servers/rendering/shader_language.cpp:373	TK_HINT_COLOR_CONVERSION_DISABLED		
hint_range	uniform hint	servers/rendering/shader_language.cpp:374	TK_HINT_RANGE		
hint_enum	uniform hint	servers/rendering/shader_language.cpp:375	TK_HINT_ENUM		
instance_index	uniform hint	servers/rendering/shader_language.cpp:376	TK_HINT_INSTANCE_INDEX		
hint_normal	uniform hint	servers/rendering/shader_language.cpp:380	TK_HINT_NORMAL_TEXTURE		
hint_default_white	uniform hint	servers/rendering/shader_language.cpp:381	TK_HINT_DEFAULT_WHITE_TEXTURE		
hint_default_black	uniform hint	servers/rendering/shader_language.cpp:382	TK_HINT_DEFAULT_BLACK_TEXTURE		
hint_default_transparent	uniform hint	servers/rendering/shader_language.cpp:383	TK_HINT_DEFAULT_TRANSPARENT_TEXTURE		
hint_anisotropy	uniform hint	servers/rendering/shader_language.cpp:384	TK_HINT_ANISOTROPY_TEXTURE		
hint_roughness_r	uniform hint	servers/rendering/shader_language.cpp:385	TK_HINT_ROUGHNESS_R		
hint_roughness_g	uniform hint	servers/rendering/shader_language.cpp:386	TK_HINT_ROUGHNESS_G		
hint_roughness_b	uniform hint	servers/rendering/shader_language.cpp:387	TK_HINT_ROUGHNESS_B		
hint_roughness_a	uniform hint	servers/rendering/shader_language.cpp:388	TK_HINT_ROUGHNESS_A		
hint_roughness_normal	uniform hint	servers/rendering/shader_language.cpp:389	TK_HINT_ROUGHNESS_NORMAL_TEXTURE		
hint_roughness_gray	uniform hint	servers/rendering/shader_language.cpp:390	TK_HINT_ROUGHNESS_GRAY		
hint_screen_texture	uniform hint	servers/rendering/shader_language.cpp:391	TK_HINT_SCREEN_TEXTURE		
hint_normal_roughness_texture	uniform hint	servers/rendering/shader_language.cpp:392	TK_HINT_NORMAL_ROUGHNESS_TEXTURE		
hint_depth_texture	uniform hint	servers/rendering/shader_language.cpp:393	TK_HINT_DEPTH_TEXTURE		
filter_nearest	sampler setting	servers/rendering/shader_language.cpp:395	TK_FILTER_NEAREST		
filter_linear	sampler setting	servers/rendering/shader_language.cpp:396	TK_FILTER_LINEAR		
filter_nearest_mipmap	sampler setting	servers/rendering/shader_language.cpp:397	TK_FILTER_NEAREST_MIPMAP		
filter_linear_mipmap	sampler setting	servers/rendering/shader_language.cpp:398	TK_FILTER_LINEAR_MIPMAP		
filter_nearest_mipmap_anisotropic	sampler setting	servers/rendering/shader_language.cpp:399	TK_FILTER_NEAREST_MIPMAP_ANISOTROPIC		
filter_linear_mipmap_anisotropic	sampler setting	servers/rendering/shader_language.cpp:400	TK_FILTER_LINEAR_MIPMAP_ANISOTROPIC		
repeat_enable	sampler setting	servers/rendering/shader_language.cpp:401	TK_REPEAT_ENABLE		
repeat_disable	sampler setting	servers/rendering/shader_language.cpp:402	TK_REPEAT_DISABLE		
OP_EQUAL(bool,bool)	operator	servers/rendering/shader_language.cpp:1565		bool	(bool,bool)
OP_EQUAL(bvec2,bvec2)	operator	servers/rendering/shader_language.cpp:1565		bool	(bvec2,bvec2)
OP_EQUAL(bvec3,bvec3)	operator	servers/rendering/shader_language.cpp:1565		bool	(bvec3,bvec3)
OP_EQUAL(bvec4,bvec4)	operator	servers/rendering/shader_language.cpp:1565		bool	(bvec4,bvec4)
OP_EQUAL(int,int)	operator	servers/rendering/shader_language.cpp:1565		bool	(int,int)
OP_EQUAL(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1565		bool	(ivec2,ivec2)
OP_EQUAL(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1565		bool	(ivec3,ivec3)
OP_EQUAL(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1565		bool	(ivec4,ivec4)
OP_EQUAL(uint,uint)	operator	servers/rendering/shader_language.cpp:1565		bool	(uint,uint)
OP_EQUAL(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1565		bool	(uvec2,uvec2)
OP_EQUAL(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1565		bool	(uvec3,uvec3)
OP_EQUAL(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1565		bool	(uvec4,uvec4)
OP_EQUAL(float,float)	operator	servers/rendering/shader_language.cpp:1565		bool	(float,float)
OP_EQUAL(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1565		bool	(vec2,vec2)
OP_EQUAL(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1565		bool	(vec3,vec3)
OP_EQUAL(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1565		bool	(vec4,vec4)
OP_EQUAL(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1565		bool	(mat2,mat2)
OP_EQUAL(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1565		bool	(mat3,mat3)
OP_EQUAL(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1565		bool	(mat4,mat4)
OP_NOT_EQUAL(bool,bool)	operator	servers/rendering/shader_language.cpp:1565		bool	(bool,bool)
OP_NOT_EQUAL(bvec2,bvec2)	operator	servers/rendering/shader_language.cpp:1565		bool	(bvec2,bvec2)
OP_NOT_EQUAL(bvec3,bvec3)	operator	servers/rendering/shader_language.cpp:1565		bool	(bvec3,bvec3)
OP_NOT_EQUAL(bvec4,bvec4)	operator	servers/rendering/shader_language.cpp:1565		bool	(bvec4,bvec4)
OP_NOT_EQUAL(int,int)	operator	servers/rendering/shader_language.cpp:1565		bool	(int,int)
OP_NOT_EQUAL(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1565		bool	(ivec2,ivec2)
OP_NOT_EQUAL(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1565		bool	(ivec3,ivec3)
OP_NOT_EQUAL(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1565		bool	(ivec4,ivec4)
OP_NOT_EQUAL(uint,uint)	operator	servers/rendering/shader_language.cpp:1565		bool	(uint,uint)
OP_NOT_EQUAL(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1565		bool	(uvec2,uvec2)
OP_NOT_EQUAL(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1565		bool	(uvec3,uvec3)
OP_NOT_EQUAL(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1565		bool	(uvec4,uvec4)
OP_NOT_EQUAL(float,float)	operator	servers/rendering/shader_language.cpp:1565		bool	(float,float)
OP_NOT_EQUAL(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1565		bool	(vec2,vec2)
OP_NOT_EQUAL(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1565		bool	(vec3,vec3)
OP_NOT_EQUAL(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1565		bool	(vec4,vec4)
OP_NOT_EQUAL(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1565		bool	(mat2,mat2)
OP_NOT_EQUAL(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1565		bool	(mat3,mat3)
OP_NOT_EQUAL(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1565		bool	(mat4,mat4)
OP_LESS(int,int)	operator	servers/rendering/shader_language.cpp:1576		bool	(int,int)
OP_LESS(uint,uint)	operator	servers/rendering/shader_language.cpp:1576		bool	(uint,uint)
OP_LESS(float,float)	operator	servers/rendering/shader_language.cpp:1576		bool	(float,float)
OP_LESS_EQUAL(int,int)	operator	servers/rendering/shader_language.cpp:1576		bool	(int,int)
OP_LESS_EQUAL(uint,uint)	operator	servers/rendering/shader_language.cpp:1576		bool	(uint,uint)
OP_LESS_EQUAL(float,float)	operator	servers/rendering/shader_language.cpp:1576		bool	(float,float)
OP_GREATER(int,int)	operator	servers/rendering/shader_language.cpp:1576		bool	(int,int)
OP_GREATER(uint,uint)	operator	servers/rendering/shader_language.cpp:1576		bool	(uint,uint)
OP_GREATER(float,float)	operator	servers/rendering/shader_language.cpp:1576		bool	(float,float)
OP_GREATER_EQUAL(int,int)	operator	servers/rendering/shader_language.cpp:1576		bool	(int,int)
OP_GREATER_EQUAL(uint,uint)	operator	servers/rendering/shader_language.cpp:1576		bool	(uint,uint)
OP_GREATER_EQUAL(float,float)	operator	servers/rendering/shader_language.cpp:1576		bool	(float,float)
OP_AND(bool,bool)	operator	servers/rendering/shader_language.cpp:1591		bool	(bool,bool)
OP_OR(bool,bool)	operator	servers/rendering/shader_language.cpp:1591		bool	(bool,bool)
OP_NOT(bool)	operator	servers/rendering/shader_language.cpp:1604		bool	(bool)
OP_NEGATE(int)	operator	servers/rendering/shader_language.cpp:1614		int	(int)
OP_NEGATE(ivec2)	operator	servers/rendering/shader_language.cpp:1614		ivec2	(ivec2)
OP_NEGATE(ivec3)	operator	servers/rendering/shader_language.cpp:1614		ivec3	(ivec3)
OP_NEGATE(ivec4)	operator	servers/rendering/shader_language.cpp:1614		ivec4	(ivec4)
OP_NEGATE(uint)	operator	servers/rendering/shader_language.cpp:1614		uint	(uint)
OP_NEGATE(uvec2)	operator	servers/rendering/shader_language.cpp:1614		uvec2	(uvec2)
OP_NEGATE(uvec3)	operator	servers/rendering/shader_language.cpp:1614		uvec3	(uvec3)
OP_NEGATE(uvec4)	operator	servers/rendering/shader_language.cpp:1614		uvec4	(uvec4)
OP_NEGATE(float)	operator	servers/rendering/shader_language.cpp:1614		float	(float)
OP_NEGATE(vec2)	operator	servers/rendering/shader_language.cpp:1614		vec2	(vec2)
OP_NEGATE(vec3)	operator	servers/rendering/shader_language.cpp:1614		vec3	(vec3)
OP_NEGATE(vec4)	operator	servers/rendering/shader_language.cpp:1614		vec4	(vec4)
OP_ADD(int,int)	operator	servers/rendering/shader_language.cpp:1627		int	(int,int)
OP_ADD(int,ivec2)	operator	servers/rendering/shader_language.cpp:1627		ivec2	(int,ivec2)
OP_ADD(int,ivec3)	operator	servers/rendering/shader_language.cpp:1627		ivec3	(int,ivec3)
OP_ADD(int,ivec4)	operator	servers/rendering/shader_language.cpp:1627		ivec4	(int,ivec4)
OP_ADD(ivec2,int)	operator	servers/rendering/shader_language.cpp:1627		ivec2	(ivec2,int)
OP_ADD(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1627		ivec2	(ivec2,ivec2)
OP_ADD(ivec3,int)	operator	servers/rendering/shader_language.cpp:1627		ivec3	(ivec3,int)
OP_ADD(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1627		ivec3	(ivec3,ivec3)
OP_ADD(ivec4,int)	operator	servers/rendering/shader_language.cpp:1627		ivec4	(ivec4,int)
OP_ADD(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1627		ivec4	(ivec4,ivec4)
OP_ADD(uint,uint)	operator	servers/rendering/shader_language.cpp:1627		uint	(uint,uint)
OP_ADD(uint,uvec2)	operator	servers/rendering/shader_language.cpp:1627		uvec2	(uint,uvec2)
OP_ADD(uint,uvec3)	operator	servers/rendering/shader_language.cpp:1627		uvec3	(uint,uvec3)
OP_ADD(uint,uvec4)	operator	servers/rendering/shader_language.cpp:1627		uvec4	(uint,uvec4)
OP_ADD(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1627		uvec2	(uvec2,uint)
OP_ADD(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1627		uvec2	(uvec2,uvec2)
OP_ADD(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1627		uvec3	(uvec3,uint)
OP_ADD(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1627		uvec3	(uvec3,uvec3)
OP_ADD(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1627		uvec4	(uvec4,uint)
OP_ADD(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1627		uvec4	(uvec4,uvec4)
OP_ADD(float,float)	operator	servers/rendering/shader_language.cpp:1627		float	(float,float)
OP_ADD(float,vec2)	operator	servers/rendering/shader_language.cpp:1627		vec2	(float,vec2)
OP_ADD(float,vec3)	operator	servers/rendering/shader_language.cpp:1627		vec3	(float,vec3)
OP_ADD(float,vec4)	operator	servers/rendering/shader_language.cpp:1627		vec4	(float,vec4)
OP_ADD(float,mat2)	operator	servers/rendering/shader_language.cpp:1627		mat2	(float,mat2)
OP_ADD(float,mat3)	operator	servers/rendering/shader_language.cpp:1627		mat3	(float,mat3)
OP_ADD(float,mat4)	operator	servers/rendering/shader_language.cpp:1627		mat4	(float,mat4)
OP_ADD(vec2,float)	operator	servers/rendering/shader_language.cpp:1627		vec2	(vec2,float)
OP_ADD(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1627		vec2	(vec2,vec2)
OP_ADD(vec3,float)	operator	servers/rendering/shader_language.cpp:1627		vec3	(vec3,float)
OP_ADD(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1627		vec3	(vec3,vec3)
OP_ADD(vec4,float)	operator	servers/rendering/shader_language.cpp:1627		vec4	(vec4,float)
OP_ADD(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1627		vec4	(vec4,vec4)
OP_ADD(mat2,float)	operator	servers/rendering/shader_language.cpp:1627		mat2	(mat2,float)
OP_ADD(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1627		mat2	(mat2,mat2)
OP_ADD(mat3,float)	operator	servers/rendering/shader_language.cpp:1627		mat3	(mat3,float)
OP_ADD(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1627		mat3	(mat3,mat3)
OP_ADD(mat4,float)	operator	servers/rendering/shader_language.cpp:1627		mat4	(mat4,float)
OP_ADD(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1627		mat4	(mat4,mat4)
OP_SUB(int,int)	operator	servers/rendering/shader_language.cpp:1627		int	(int,int)
OP_SUB(int,ivec2)	operator	servers/rendering/shader_language.cpp:1627		ivec2	(int,ivec2)
OP_SUB(int,ivec3)	operator	servers/rendering/shader_language.cpp:1627		ivec3	(int,ivec3)
OP_SUB(int,ivec4)	operator	servers/rendering/shader_language.cpp:1627		ivec4	(int,ivec4)
OP_SUB(ivec2,int)	operator	servers/rendering/shader_language.cpp:1627		ivec2	(ivec2,int)
OP_SUB(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1627		ivec2	(ivec2,ivec2)
OP_SUB(ivec3,int)	operator	servers/rendering/shader_language.cpp:1627		ivec3	(ivec3,int)
OP_SUB(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1627		ivec3	(ivec3,ivec3)
OP_SUB(ivec4,int)	operator	servers/rendering/shader_language.cpp:1627		ivec4	(ivec4,int)
OP_SUB(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1627		ivec4	(ivec4,ivec4)
OP_SUB(uint,uint)	operator	servers/rendering/shader_language.cpp:1627		uint	(uint,uint)
OP_SUB(uint,uvec2)	operator	servers/rendering/shader_language.cpp:1627		uvec2	(uint,uvec2)
OP_SUB(uint,uvec3)	operator	servers/rendering/shader_language.cpp:1627		uvec3	(uint,uvec3)
OP_SUB(uint,uvec4)	operator	servers/rendering/shader_language.cpp:1627		uvec4	(uint,uvec4)
OP_SUB(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1627		uvec2	(uvec2,uint)
OP_SUB(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1627		uvec2	(uvec2,uvec2)
OP_SUB(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1627		uvec3	(uvec3,uint)
OP_SUB(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1627		uvec3	(uvec3,uvec3)
OP_SUB(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1627		uvec4	(uvec4,uint)
OP_SUB(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1627		uvec4	(uvec4,uvec4)
OP_SUB(float,float)	operator	servers/rendering/shader_language.cpp:1627		float	(float,float)
OP_SUB(float,vec2)	operator	servers/rendering/shader_language.cpp:1627		vec2	(float,vec2)
OP_SUB(float,vec3)	operator	servers/rendering/shader_language.cpp:1627		vec3	(float,vec3)
OP_SUB(float,vec4)	operator	servers/rendering/shader_language.cpp:1627		vec4	(float,vec4)
OP_SUB(float,mat2)	operator	servers/rendering/shader_language.cpp:1627		mat2	(float,mat2)
OP_SUB(float,mat3)	operator	servers/rendering/shader_language.cpp:1627		mat3	(float,mat3)
OP_SUB(float,mat4)	operator	servers/rendering/shader_language.cpp:1627		mat4	(float,mat4)
OP_SUB(vec2,float)	operator	servers/rendering/shader_language.cpp:1627		vec2	(vec2,float)
OP_SUB(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1627		vec2	(vec2,vec2)
OP_SUB(vec3,float)	operator	servers/rendering/shader_language.cpp:1627		vec3	(vec3,float)
OP_SUB(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1627		vec3	(vec3,vec3)
OP_SUB(vec4,float)	operator	servers/rendering/shader_language.cpp:1627		vec4	(vec4,float)
OP_SUB(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1627		vec4	(vec4,vec4)
OP_SUB(mat2,float)	operator	servers/rendering/shader_language.cpp:1627		mat2	(mat2,float)
OP_SUB(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1627		mat2	(mat2,mat2)
OP_SUB(mat3,float)	operator	servers/rendering/shader_language.cpp:1627		mat3	(mat3,float)
OP_SUB(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1627		mat3	(mat3,mat3)
OP_SUB(mat4,float)	operator	servers/rendering/shader_language.cpp:1627		mat4	(mat4,float)
OP_SUB(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1627		mat4	(mat4,mat4)
OP_MUL(int,int)	operator	servers/rendering/shader_language.cpp:1627		int	(int,int)
OP_MUL(int,ivec2)	operator	servers/rendering/shader_language.cpp:1627		ivec2	(int,ivec2)
OP_MUL(int,ivec3)	operator	servers/rendering/shader_language.cpp:1627		ivec3	(int,ivec3)
OP_MUL(int,ivec4)	operator	servers/rendering/shader_language.cpp:1627		ivec4	(int,ivec4)
OP_MUL(ivec2,int)	operator	servers/rendering/shader_language.cpp:1627		ivec2	(ivec2,int)
OP_MUL(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1627		ivec2	(ivec2,ivec2)
OP_MUL(ivec3,int)	operator	servers/rendering/shader_language.cpp:1627		ivec3	(ivec3,int)
OP_MUL(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1627		ivec3	(ivec3,ivec3)
OP_MUL(ivec4,int)	operator	servers/rendering/shader_language.cpp:1627		ivec4	(ivec4,int)
OP_MUL(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1627		ivec4	(ivec4,ivec4)
OP_MUL(uint,uint)	operator	servers/rendering/shader_language.cpp:1627		uint	(uint,uint)
OP_MUL(uint,uvec2)	operator	servers/rendering/shader_language.cpp:1627		uvec2	(uint,uvec2)
OP_MUL(uint,uvec3)	operator	servers/rendering/shader_language.cpp:1627		uvec3	(uint,uvec3)
OP_MUL(uint,uvec4)	operator	servers/rendering/shader_language.cpp:1627		uvec4	(uint,uvec4)
OP_MUL(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1627		uvec2	(uvec2,uint)
OP_MUL(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1627		uvec2	(uvec2,uvec2)
OP_MUL(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1627		uvec3	(uvec3,uint)
OP_MUL(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1627		uvec3	(uvec3,uvec3)
OP_MUL(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1627		uvec4	(uvec4,uint)
OP_MUL(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1627		uvec4	(uvec4,uvec4)
OP_MUL(float,float)	operator	servers/rendering/shader_language.cpp:1627		float	(float,float)
OP_MUL(float,vec2)	operator	servers/rendering/shader_language.cpp:1627		vec2	(float,vec2)
OP_MUL(float,vec3)	operator	servers/rendering/shader_language.cpp:1627		vec3	(float,vec3)
OP_MUL(float,vec4)	operator	servers/rendering/shader_language.cpp:1627		vec4	(float,vec4)
OP_MUL(float,mat2)	operator	servers/rendering/shader_language.cpp:1627		mat2	(float,mat2)
OP_MUL(float,mat3)	operator	servers/rendering/shader_language.cpp:1627		mat3	(float,mat3)
OP_MUL(float,mat4)	operator	servers/rendering/shader_language.cpp:1627		mat4	(float,mat4)
OP_MUL(vec2,float)	operator	servers/rendering/shader_language.cpp:1627		vec2	(vec2,float)
OP_MUL(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1627		vec2	(vec2,vec2)
OP_MUL(vec2,mat2)	operator	servers/rendering/shader_language.cpp:1627		vec2	(vec2,mat2)
OP_MUL(vec3,float)	operator	servers/rendering/shader_language.cpp:1627		vec3	(vec3,float)
OP_MUL(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1627		vec3	(vec3,vec3)
OP_MUL(vec3,mat3)	operator	servers/rendering/shader_language.cpp:1627		vec3	(vec3,mat3)
OP_MUL(vec4,float)	operator	servers/rendering/shader_language.cpp:1627		vec4	(vec4,float)
OP_MUL(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1627		vec4	(vec4,vec4)
OP_MUL(vec4,mat4)	operator	servers/rendering/shader_language.cpp:1627		vec4	(vec4,mat4)
OP_MUL(mat2,float)	operator	servers/rendering/shader_language.cpp:1627		mat2	(mat2,float)
OP_MUL(mat2,vec2)	operator	servers/rendering/shader_language.cpp:1627		vec2	(mat2,vec2)
OP_MUL(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1627		mat2	(mat2,mat2)
OP_MUL(mat3,float)	operator	servers/rendering/shader_language.cpp:1627		mat3	(mat3,float)
OP_MUL(mat3,vec3)	operator	servers/rendering/shader_language.cpp:1627		vec3	(mat3,vec3)
OP_MUL(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1627		mat3	(mat3,mat3)
OP_MUL(mat4,float)	operator	servers/rendering/shader_language.cpp:1627		mat4	(mat4,float)
OP_MUL(mat4,vec4)	operator	servers/rendering/shader_language.cpp:1627		vec4	(mat4,vec4)
OP_MUL(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1627		mat4	(mat4,mat4)
OP_DIV(int,int)	operator	servers/rendering/shader_language.cpp:1627		int	(int,int)
OP_DIV(int,ivec2)	operator	servers/rendering/shader_language.cpp:1627		ivec2	(int,ivec2)
OP_DIV(int,ivec3)	operator	servers/rendering/shader_language.cpp:1627		ivec3	(int,ivec3)
OP_DIV(int,ivec4)	operator	servers/rendering/shader_language.cpp:1627		ivec4	(int,ivec4)
OP_DIV(ivec2,int)	operator	servers/rendering/shader_language.cpp:1627		ivec2	(ivec2,int)
OP_DIV(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1627		ivec2	(ivec2,ivec2)
OP_DIV(ivec3,int)	operator	servers/rendering/shader_language.cpp:1627		ivec3	(ivec3,int)
OP_DIV(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1627		ivec3	(ivec3,ivec3)
OP_DIV(ivec4,int)	operator	servers/rendering/shader_language.cpp:1627		ivec4	(ivec4,int)
OP_DIV(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1627		ivec4	(ivec4,ivec4)
OP_DIV(uint,uint)	operator	servers/rendering/shader_language.cpp:1627		uint	(uint,uint)
OP_DIV(uint,uvec2)	operator	servers/rendering/shader_language.cpp:1627		uvec2	(uint,uvec2)
OP_DIV(uint,uvec3)	operator	servers/rendering/shader_language.cpp:1627		uvec3	(uint,uvec3)
OP_DIV(uint,uvec4)	operator	servers/rendering/shader_language.cpp:1627		uvec4	(uint,uvec4)
OP_DIV(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1627		uvec2	(uvec2,uint)
OP_DIV(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1627		uvec2	(uvec2,uvec2)
OP_DIV(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1627		uvec3	(uvec3,uint)
OP_DIV(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1627		uvec3	(uvec3,uvec3)
OP_DIV(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1627		uvec4	(uvec4,uint)
OP_DIV(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1627		uvec4	(uvec4,uvec4)
OP_DIV(float,float)	operator	servers/rendering/shader_language.cpp:1627		float	(float,float)
OP_DIV(float,vec2)	operator	servers/rendering/shader_language.cpp:1627		vec2	(float,vec2)
OP_DIV(float,vec3)	operator	servers/rendering/shader_language.cpp:1627		vec3	(float,vec3)
OP_DIV(float,vec4)	operator	servers/rendering/shader_language.cpp:1627		vec4	(float,vec4)
OP_DIV(float,mat2)	operator	servers/rendering/shader_language.cpp:1627		mat2	(float,mat2)
OP_DIV(float,mat3)	operator	servers/rendering/shader_language.cpp:1627		mat3	(float,mat3)
OP_DIV(float,mat4)	operator	servers/rendering/shader_language.cpp:1627		mat4	(float,mat4)
OP_DIV(vec2,float)	operator	servers/rendering/shader_language.cpp:1627		vec2	(vec2,float)
OP_DIV(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1627		vec2	(vec2,vec2)
OP_DIV(vec3,float)	operator	servers/rendering/shader_language.cpp:1627		vec3	(vec3,float)
OP_DIV(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1627		vec3	(vec3,vec3)
OP_DIV(vec4,float)	operator	servers/rendering/shader_language.cpp:1627		vec4	(vec4,float)
OP_DIV(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1627		vec4	(vec4,vec4)
OP_DIV(mat2,float)	operator	servers/rendering/shader_language.cpp:1627		mat2	(mat2,float)
OP_DIV(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1627		mat2	(mat2,mat2)
OP_DIV(mat3,float)	operator	servers/rendering/shader_language.cpp:1627		mat3	(mat3,float)
OP_DIV(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1627		mat3	(mat3,mat3)
OP_DIV(mat4,float)	operator	servers/rendering/shader_language.cpp:1627		mat4	(mat4,float)
OP_DIV(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1627		mat4	(mat4,mat4)
OP_MOD(int,int)	operator	servers/rendering/shader_language.cpp:1693		int	(int,int)
OP_MOD(ivec2,int)	operator	servers/rendering/shader_language.cpp:1693		ivec2	(ivec2,int)
OP_MOD(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1693		ivec2	(ivec2,ivec2)
OP_MOD(ivec3,int)	operator	servers/rendering/shader_language.cpp:1693		ivec3	(ivec3,int)
OP_MOD(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1693		ivec3	(ivec3,ivec3)
OP_MOD(ivec4,int)	operator	servers/rendering/shader_language.cpp:1693		ivec4	(ivec4,int)
OP_MOD(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1693		ivec4	(ivec4,ivec4)
OP_MOD(uint,uint)	operator	servers/rendering/shader_language.cpp:1693		uint	(uint,uint)
OP_MOD(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1693		uvec2	(uvec2,uint)
OP_MOD(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1693		uvec2	(uvec2,uvec2)
OP_MOD(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1693		uvec3	(uvec3,uint)
OP_MOD(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1693		uvec3	(uvec3,uvec3)
OP_MOD(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1693		uvec4	(uvec4,uint)
OP_MOD(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1693		uvec4	(uvec4,uvec4)
OP_SHIFT_LEFT(int,int)	operator	servers/rendering/shader_language.cpp:1755		int	(int,int)
OP_SHIFT_LEFT(ivec2,int)	operator	servers/rendering/shader_language.cpp:1755		ivec2	(ivec2,int)
OP_SHIFT_LEFT(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1755		ivec2	(ivec2,ivec2)
OP_SHIFT_LEFT(ivec3,int)	operator	servers/rendering/shader_language.cpp:1755		ivec3	(ivec3,int)
OP_SHIFT_LEFT(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1755		ivec3	(ivec3,ivec3)
OP_SHIFT_LEFT(ivec4,int)	operator	servers/rendering/shader_language.cpp:1755		ivec4	(ivec4,int)
OP_SHIFT_LEFT(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1755		ivec4	(ivec4,ivec4)
OP_SHIFT_LEFT(uint,uint)	operator	servers/rendering/shader_language.cpp:1755		uint	(uint,uint)
OP_SHIFT_LEFT(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1755		uvec2	(uvec2,uint)
OP_SHIFT_LEFT(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1755		uvec2	(uvec2,uvec2)
OP_SHIFT_LEFT(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1755		uvec3	(uvec3,uint)
OP_SHIFT_LEFT(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1755		uvec3	(uvec3,uvec3)
OP_SHIFT_LEFT(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1755		uvec4	(uvec4,uint)
OP_SHIFT_LEFT(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1755		uvec4	(uvec4,uvec4)
OP_SHIFT_RIGHT(int,int)	operator	servers/rendering/shader_language.cpp:1755		int	(int,int)
OP_SHIFT_RIGHT(ivec2,int)	operator	servers/rendering/shader_language.cpp:1755		ivec2	(ivec2,int)
OP_SHIFT_RIGHT(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1755		ivec2	(ivec2,ivec2)
OP_SHIFT_RIGHT(ivec3,int)	operator	servers/rendering/shader_language.cpp:1755		ivec3	(ivec3,int)
OP_SHIFT_RIGHT(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1755		ivec3	(ivec3,ivec3)
OP_SHIFT_RIGHT(ivec4,int)	operator	servers/rendering/shader_language.cpp:1755		ivec4	(ivec4,int)
OP_SHIFT_RIGHT(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1755		ivec4	(ivec4,ivec4)
OP_SHIFT_RIGHT(uint,uint)	operator	servers/rendering/shader_language.cpp:1755		uint	(uint,uint)
OP_SHIFT_RIGHT(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1755		uvec2	(uvec2,uint)
OP_SHIFT_RIGHT(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1755		uvec2	(uvec2,uvec2)
OP_SHIFT_RIGHT(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1755		uvec3	(uvec3,uint)
OP_SHIFT_RIGHT(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1755		uvec3	(uvec3,uvec3)
OP_SHIFT_RIGHT(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1755		uvec4	(uvec4,uint)
OP_SHIFT_RIGHT(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1755		uvec4	(uvec4,uvec4)
OP_ASSIGN(bool,bool)	operator	servers/rendering/shader_language.cpp:1810		bool	(bool,bool)
OP_ASSIGN(bvec2,bvec2)	operator	servers/rendering/shader_language.cpp:1810		bvec2	(bvec2,bvec2)
OP_ASSIGN(bvec3,bvec3)	operator	servers/rendering/shader_language.cpp:1810		bvec3	(bvec3,bvec3)
OP_ASSIGN(bvec4,bvec4)	operator	servers/rendering/shader_language.cpp:1810		bvec4	(bvec4,bvec4)
OP_ASSIGN(int,int)	operator	servers/rendering/shader_language.cpp:1810		int	(int,int)
OP_ASSIGN(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1810		ivec2	(ivec2,ivec2)
OP_ASSIGN(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1810		ivec3	(ivec3,ivec3)
OP_ASSIGN(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1810		ivec4	(ivec4,ivec4)
OP_ASSIGN(uint,uint)	operator	servers/rendering/shader_language.cpp:1810		uint	(uint,uint)
OP_ASSIGN(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1810		uvec2	(uvec2,uvec2)
OP_ASSIGN(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1810		uvec3	(uvec3,uvec3)
OP_ASSIGN(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1810		uvec4	(uvec4,uvec4)
OP_ASSIGN(float,float)	operator	servers/rendering/shader_language.cpp:1810		float	(float,float)
OP_ASSIGN(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1810		vec2	(vec2,vec2)
OP_ASSIGN(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1810		vec3	(vec3,vec3)
OP_ASSIGN(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1810		vec4	(vec4,vec4)
OP_ASSIGN(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1810		mat2	(mat2,mat2)
OP_ASSIGN(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1810		mat3	(mat3,mat3)
OP_ASSIGN(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1810		mat4	(mat4,mat4)
OP_ASSIGN_ADD(int,int)	operator	servers/rendering/shader_language.cpp:1833		int	(int,int)
OP_ASSIGN_ADD(ivec2,int)	operator	servers/rendering/shader_language.cpp:1833		ivec2	(ivec2,int)
OP_ASSIGN_ADD(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1833		ivec2	(ivec2,ivec2)
OP_ASSIGN_ADD(ivec3,int)	operator	servers/rendering/shader_language.cpp:1833		ivec3	(ivec3,int)
OP_ASSIGN_ADD(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1833		ivec3	(ivec3,ivec3)
OP_ASSIGN_ADD(ivec4,int)	operator	servers/rendering/shader_language.cpp:1833		ivec4	(ivec4,int)
OP_ASSIGN_ADD(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1833		ivec4	(ivec4,ivec4)
OP_ASSIGN_ADD(uint,uint)	operator	servers/rendering/shader_language.cpp:1833		uint	(uint,uint)
OP_ASSIGN_ADD(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1833		uvec2	(uvec2,uint)
OP_ASSIGN_ADD(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1833		uvec2	(uvec2,uvec2)
OP_ASSIGN_ADD(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1833		uvec3	(uvec3,uint)
OP_ASSIGN_ADD(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1833		uvec3	(uvec3,uvec3)
OP_ASSIGN_ADD(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1833		uvec4	(uvec4,uint)
OP_ASSIGN_ADD(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1833		uvec4	(uvec4,uvec4)
OP_ASSIGN_ADD(float,float)	operator	servers/rendering/shader_language.cpp:1833		float	(float,float)
OP_ASSIGN_ADD(vec2,float)	operator	servers/rendering/shader_language.cpp:1833		vec2	(vec2,float)
OP_ASSIGN_ADD(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1833		vec2	(vec2,vec2)
OP_ASSIGN_ADD(vec3,float)	operator	servers/rendering/shader_language.cpp:1833		vec3	(vec3,float)
OP_ASSIGN_ADD(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1833		vec3	(vec3,vec3)
OP_ASSIGN_ADD(vec4,float)	operator	servers/rendering/shader_language.cpp:1833		vec4	(vec4,float)
OP_ASSIGN_ADD(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1833		vec4	(vec4,vec4)
OP_ASSIGN_ADD(mat2,float)	operator	servers/rendering/shader_language.cpp:1833		mat2	(mat2,float)
OP_ASSIGN_ADD(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1833		mat2	(mat2,mat2)
OP_ASSIGN_ADD(mat3,float)	operator	servers/rendering/shader_language.cpp:1833		mat3	(mat3,float)
OP_ASSIGN_ADD(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1833		mat3	(mat3,mat3)
OP_ASSIGN_ADD(mat4,float)	operator	servers/rendering/shader_language.cpp:1833		mat4	(mat4,float)
OP_ASSIGN_ADD(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1833		mat4	(mat4,mat4)
OP_ASSIGN_SUB(int,int)	operator	servers/rendering/shader_language.cpp:1833		int	(int,int)
OP_ASSIGN_SUB(ivec2,int)	operator	servers/rendering/shader_language.cpp:1833		ivec2	(ivec2,int)
OP_ASSIGN_SUB(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1833		ivec2	(ivec2,ivec2)
OP_ASSIGN_SUB(ivec3,int)	operator	servers/rendering/shader_language.cpp:1833		ivec3	(ivec3,int)
OP_ASSIGN_SUB(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1833		ivec3	(ivec3,ivec3)
OP_ASSIGN_SUB(ivec4,int)	operator	servers/rendering/shader_language.cpp:1833		ivec4	(ivec4,int)
OP_ASSIGN_SUB(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1833		ivec4	(ivec4,ivec4)
OP_ASSIGN_SUB(uint,uint)	operator	servers/rendering/shader_language.cpp:1833		uint	(uint,uint)
OP_ASSIGN_SUB(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1833		uvec2	(uvec2,uint)
OP_ASSIGN_SUB(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1833		uvec2	(uvec2,uvec2)
OP_ASSIGN_SUB(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1833		uvec3	(uvec3,uint)
OP_ASSIGN_SUB(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1833		uvec3	(uvec3,uvec3)
OP_ASSIGN_SUB(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1833		uvec4	(uvec4,uint)
OP_ASSIGN_SUB(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1833		uvec4	(uvec4,uvec4)
OP_ASSIGN_SUB(float,float)	operator	servers/rendering/shader_language.cpp:1833		float	(float,float)
OP_ASSIGN_SUB(vec2,float)	operator	servers/rendering/shader_language.cpp:1833		vec2	(vec2,float)
OP_ASSIGN_SUB(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1833		vec2	(vec2,vec2)
OP_ASSIGN_SUB(vec3,float)	operator	servers/rendering/shader_language.cpp:1833		vec3	(vec3,float)
OP_ASSIGN_SUB(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1833		vec3	(vec3,vec3)
OP_ASSIGN_SUB(vec4,float)	operator	servers/rendering/shader_language.cpp:1833		vec4	(vec4,float)
OP_ASSIGN_SUB(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1833		vec4	(vec4,vec4)
OP_ASSIGN_SUB(mat2,float)	operator	servers/rendering/shader_language.cpp:1833		mat2	(mat2,float)
OP_ASSIGN_SUB(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1833		mat2	(mat2,mat2)
OP_ASSIGN_SUB(mat3,float)	operator	servers/rendering/shader_language.cpp:1833		mat3	(mat3,float)
OP_ASSIGN_SUB(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1833		mat3	(mat3,mat3)
OP_ASSIGN_SUB(mat4,float)	operator	servers/rendering/shader_language.cpp:1833		mat4	(mat4,float)
OP_ASSIGN_SUB(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1833		mat4	(mat4,mat4)
OP_ASSIGN_MUL(int,int)	operator	servers/rendering/shader_language.cpp:1833		int	(int,int)
OP_ASSIGN_MUL(ivec2,int)	operator	servers/rendering/shader_language.cpp:1833		ivec2	(ivec2,int)
OP_ASSIGN_MUL(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1833		ivec2	(ivec2,ivec2)
OP_ASSIGN_MUL(ivec3,int)	operator	servers/rendering/shader_language.cpp:1833		ivec3	(ivec3,int)
OP_ASSIGN_MUL(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1833		ivec3	(ivec3,ivec3)
OP_ASSIGN_MUL(ivec4,int)	operator	servers/rendering/shader_language.cpp:1833		ivec4	(ivec4,int)
OP_ASSIGN_MUL(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1833		ivec4	(ivec4,ivec4)
OP_ASSIGN_MUL(uint,uint)	operator	servers/rendering/shader_language.cpp:1833		uint	(uint,uint)
OP_ASSIGN_MUL(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1833		uvec2	(uvec2,uint)
OP_ASSIGN_MUL(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1833		uvec2	(uvec2,uvec2)
OP_ASSIGN_MUL(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1833		uvec3	(uvec3,uint)
OP_ASSIGN_MUL(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1833		uvec3	(uvec3,uvec3)
OP_ASSIGN_MUL(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1833		uvec4	(uvec4,uint)
OP_ASSIGN_MUL(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1833		uvec4	(uvec4,uvec4)
OP_ASSIGN_MUL(float,float)	operator	servers/rendering/shader_language.cpp:1833		float	(float,float)
OP_ASSIGN_MUL(vec2,float)	operator	servers/rendering/shader_language.cpp:1833		vec2	(vec2,float)
OP_ASSIGN_MUL(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1833		vec2	(vec2,vec2)
OP_ASSIGN_MUL(vec2,mat2)	operator	servers/rendering/shader_language.cpp:1833		vec2	(vec2,mat2)
OP_ASSIGN_MUL(vec3,float)	operator	servers/rendering/shader_language.cpp:1833		vec3	(vec3,float)
OP_ASSIGN_MUL(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1833		vec3	(vec3,vec3)
OP_ASSIGN_MUL(vec3,mat3)	operator	servers/rendering/shader_language.cpp:1833		vec3	(vec3,mat3)
OP_ASSIGN_MUL(vec4,float)	operator	servers/rendering/shader_language.cpp:1833		vec4	(vec4,float)
OP_ASSIGN_MUL(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1833		vec4	(vec4,vec4)
OP_ASSIGN_MUL(vec4,mat4)	operator	servers/rendering/shader_language.cpp:1833		vec4	(vec4,mat4)
OP_ASSIGN_MUL(mat2,float)	operator	servers/rendering/shader_language.cpp:1833		mat2	(mat2,float)
OP_ASSIGN_MUL(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1833		mat2	(mat2,mat2)
OP_ASSIGN_MUL(mat3,float)	operator	servers/rendering/shader_language.cpp:1833		mat3	(mat3,float)
OP_ASSIGN_MUL(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1833		mat3	(mat3,mat3)
OP_ASSIGN_MUL(mat4,float)	operator	servers/rendering/shader_language.cpp:1833		mat4	(mat4,float)
OP_ASSIGN_MUL(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1833		mat4	(mat4,mat4)
OP_ASSIGN_DIV(int,int)	operator	servers/rendering/shader_language.cpp:1833		int	(int,int)
OP_ASSIGN_DIV(ivec2,int)	operator	servers/rendering/shader_language.cpp:1833		ivec2	(ivec2,int)
OP_ASSIGN_DIV(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1833		ivec2	(ivec2,ivec2)
OP_ASSIGN_DIV(ivec3,int)	operator	servers/rendering/shader_language.cpp:1833		ivec3	(ivec3,int)
OP_ASSIGN_DIV(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1833		ivec3	(ivec3,ivec3)
OP_ASSIGN_DIV(ivec4,int)	operator	servers/rendering/shader_language.cpp:1833		ivec4	(ivec4,int)
OP_ASSIGN_DIV(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1833		ivec4	(ivec4,ivec4)
OP_ASSIGN_DIV(uint,uint)	operator	servers/rendering/shader_language.cpp:1833		uint	(uint,uint)
OP_ASSIGN_DIV(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1833		uvec2	(uvec2,uint)
OP_ASSIGN_DIV(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1833		uvec2	(uvec2,uvec2)
OP_ASSIGN_DIV(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1833		uvec3	(uvec3,uint)
OP_ASSIGN_DIV(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1833		uvec3	(uvec3,uvec3)
OP_ASSIGN_DIV(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1833		uvec4	(uvec4,uint)
OP_ASSIGN_DIV(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1833		uvec4	(uvec4,uvec4)
OP_ASSIGN_DIV(float,float)	operator	servers/rendering/shader_language.cpp:1833		float	(float,float)
OP_ASSIGN_DIV(vec2,float)	operator	servers/rendering/shader_language.cpp:1833		vec2	(vec2,float)
OP_ASSIGN_DIV(vec2,vec2)	operator	servers/rendering/shader_language.cpp:1833		vec2	(vec2,vec2)
OP_ASSIGN_DIV(vec3,float)	operator	servers/rendering/shader_language.cpp:1833		vec3	(vec3,float)
OP_ASSIGN_DIV(vec3,vec3)	operator	servers/rendering/shader_language.cpp:1833		vec3	(vec3,vec3)
OP_ASSIGN_DIV(vec4,float)	operator	servers/rendering/shader_language.cpp:1833		vec4	(vec4,float)
OP_ASSIGN_DIV(vec4,vec4)	operator	servers/rendering/shader_language.cpp:1833		vec4	(vec4,vec4)
OP_ASSIGN_DIV(mat2,float)	operator	servers/rendering/shader_language.cpp:1833		mat2	(mat2,float)
OP_ASSIGN_DIV(mat2,mat2)	operator	servers/rendering/shader_language.cpp:1833		mat2	(mat2,mat2)
OP_ASSIGN_DIV(mat3,float)	operator	servers/rendering/shader_language.cpp:1833		mat3	(mat3,float)
OP_ASSIGN_DIV(mat3,mat3)	operator	servers/rendering/shader_language.cpp:1833		mat3	(mat3,mat3)
OP_ASSIGN_DIV(mat4,float)	operator	servers/rendering/shader_language.cpp:1833		mat4	(mat4,float)
OP_ASSIGN_DIV(mat4,mat4)	operator	servers/rendering/shader_language.cpp:1833		mat4	(mat4,mat4)
OP_ASSIGN_MOD(int,int)	operator	servers/rendering/shader_language.cpp:1693		int	(int,int)
OP_ASSIGN_MOD(ivec2,int)	operator	servers/rendering/shader_language.cpp:1693		ivec2	(ivec2,int)
OP_ASSIGN_MOD(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1693		ivec2	(ivec2,ivec2)
OP_ASSIGN_MOD(ivec3,int)	operator	servers/rendering/shader_language.cpp:1693		ivec3	(ivec3,int)
OP_ASSIGN_MOD(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1693		ivec3	(ivec3,ivec3)
OP_ASSIGN_MOD(ivec4,int)	operator	servers/rendering/shader_language.cpp:1693		ivec4	(ivec4,int)
OP_ASSIGN_MOD(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1693		ivec4	(ivec4,ivec4)
OP_ASSIGN_MOD(uint,uint)	operator	servers/rendering/shader_language.cpp:1693		uint	(uint,uint)
OP_ASSIGN_MOD(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1693		uvec2	(uvec2,uint)
OP_ASSIGN_MOD(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1693		uvec2	(uvec2,uvec2)
OP_ASSIGN_MOD(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1693		uvec3	(uvec3,uint)
OP_ASSIGN_MOD(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1693		uvec3	(uvec3,uvec3)
OP_ASSIGN_MOD(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1693		uvec4	(uvec4,uint)
OP_ASSIGN_MOD(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1693		uvec4	(uvec4,uvec4)
OP_ASSIGN_SHIFT_LEFT(int,int)	operator	servers/rendering/shader_language.cpp:1755		int	(int,int)
OP_ASSIGN_SHIFT_LEFT(ivec2,int)	operator	servers/rendering/shader_language.cpp:1755		ivec2	(ivec2,int)
OP_ASSIGN_SHIFT_LEFT(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1755		ivec2	(ivec2,ivec2)
OP_ASSIGN_SHIFT_LEFT(ivec3,int)	operator	servers/rendering/shader_language.cpp:1755		ivec3	(ivec3,int)
OP_ASSIGN_SHIFT_LEFT(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1755		ivec3	(ivec3,ivec3)
OP_ASSIGN_SHIFT_LEFT(ivec4,int)	operator	servers/rendering/shader_language.cpp:1755		ivec4	(ivec4,int)
OP_ASSIGN_SHIFT_LEFT(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1755		ivec4	(ivec4,ivec4)
OP_ASSIGN_SHIFT_LEFT(uint,uint)	operator	servers/rendering/shader_language.cpp:1755		uint	(uint,uint)
OP_ASSIGN_SHIFT_LEFT(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1755		uvec2	(uvec2,uint)
OP_ASSIGN_SHIFT_LEFT(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1755		uvec2	(uvec2,uvec2)
OP_ASSIGN_SHIFT_LEFT(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1755		uvec3	(uvec3,uint)
OP_ASSIGN_SHIFT_LEFT(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1755		uvec3	(uvec3,uvec3)
OP_ASSIGN_SHIFT_LEFT(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1755		uvec4	(uvec4,uint)
OP_ASSIGN_SHIFT_LEFT(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1755		uvec4	(uvec4,uvec4)
OP_ASSIGN_SHIFT_RIGHT(int,int)	operator	servers/rendering/shader_language.cpp:1755		int	(int,int)
OP_ASSIGN_SHIFT_RIGHT(ivec2,int)	operator	servers/rendering/shader_language.cpp:1755		ivec2	(ivec2,int)
OP_ASSIGN_SHIFT_RIGHT(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1755		ivec2	(ivec2,ivec2)
OP_ASSIGN_SHIFT_RIGHT(ivec3,int)	operator	servers/rendering/shader_language.cpp:1755		ivec3	(ivec3,int)
OP_ASSIGN_SHIFT_RIGHT(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1755		ivec3	(ivec3,ivec3)
OP_ASSIGN_SHIFT_RIGHT(ivec4,int)	operator	servers/rendering/shader_language.cpp:1755		ivec4	(ivec4,int)
OP_ASSIGN_SHIFT_RIGHT(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1755		ivec4	(ivec4,ivec4)
OP_ASSIGN_SHIFT_RIGHT(uint,uint)	operator	servers/rendering/shader_language.cpp:1755		uint	(uint,uint)
OP_ASSIGN_SHIFT_RIGHT(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1755		uvec2	(uvec2,uint)
OP_ASSIGN_SHIFT_RIGHT(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1755		uvec2	(uvec2,uvec2)
OP_ASSIGN_SHIFT_RIGHT(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1755		uvec3	(uvec3,uint)
OP_ASSIGN_SHIFT_RIGHT(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1755		uvec3	(uvec3,uvec3)
OP_ASSIGN_SHIFT_RIGHT(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1755		uvec4	(uvec4,uint)
OP_ASSIGN_SHIFT_RIGHT(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1755		uvec4	(uvec4,uvec4)
OP_ASSIGN_BIT_AND(int,int)	operator	servers/rendering/shader_language.cpp:1902		int	(int,int)
OP_ASSIGN_BIT_AND(ivec2,int)	operator	servers/rendering/shader_language.cpp:1902		ivec2	(ivec2,int)
OP_ASSIGN_BIT_AND(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1902		ivec2	(ivec2,ivec2)
OP_ASSIGN_BIT_AND(ivec3,int)	operator	servers/rendering/shader_language.cpp:1902		ivec3	(ivec3,int)
OP_ASSIGN_BIT_AND(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1902		ivec3	(ivec3,ivec3)
OP_ASSIGN_BIT_AND(ivec4,int)	operator	servers/rendering/shader_language.cpp:1902		ivec4	(ivec4,int)
OP_ASSIGN_BIT_AND(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1902		ivec4	(ivec4,ivec4)
OP_ASSIGN_BIT_AND(uint,uint)	operator	servers/rendering/shader_language.cpp:1902		uint	(uint,uint)
OP_ASSIGN_BIT_AND(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1902		uvec2	(uvec2,uint)
OP_ASSIGN_BIT_AND(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1902		uvec2	(uvec2,uvec2)
OP_ASSIGN_BIT_AND(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1902		uvec3	(uvec3,uint)
OP_ASSIGN_BIT_AND(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1902		uvec3	(uvec3,uvec3)
OP_ASSIGN_BIT_AND(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1902		uvec4	(uvec4,uint)
OP_ASSIGN_BIT_AND(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1902		uvec4	(uvec4,uvec4)
OP_ASSIGN_BIT_OR(int,int)	operator	servers/rendering/shader_language.cpp:1902		int	(int,int)
OP_ASSIGN_BIT_OR(ivec2,int)	operator	servers/rendering/shader_language.cpp:1902		ivec2	(ivec2,int)
OP_ASSIGN_BIT_OR(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1902		ivec2	(ivec2,ivec2)
OP_ASSIGN_BIT_OR(ivec3,int)	operator	servers/rendering/shader_language.cpp:1902		ivec3	(ivec3,int)
OP_ASSIGN_BIT_OR(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1902		ivec3	(ivec3,ivec3)
OP_ASSIGN_BIT_OR(ivec4,int)	operator	servers/rendering/shader_language.cpp:1902		ivec4	(ivec4,int)
OP_ASSIGN_BIT_OR(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1902		ivec4	(ivec4,ivec4)
OP_ASSIGN_BIT_OR(uint,uint)	operator	servers/rendering/shader_language.cpp:1902		uint	(uint,uint)
OP_ASSIGN_BIT_OR(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1902		uvec2	(uvec2,uint)
OP_ASSIGN_BIT_OR(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1902		uvec2	(uvec2,uvec2)
OP_ASSIGN_BIT_OR(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1902		uvec3	(uvec3,uint)
OP_ASSIGN_BIT_OR(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1902		uvec3	(uvec3,uvec3)
OP_ASSIGN_BIT_OR(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1902		uvec4	(uvec4,uint)
OP_ASSIGN_BIT_OR(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1902		uvec4	(uvec4,uvec4)
OP_ASSIGN_BIT_XOR(int,int)	operator	servers/rendering/shader_language.cpp:1902		int	(int,int)
OP_ASSIGN_BIT_XOR(ivec2,int)	operator	servers/rendering/shader_language.cpp:1902		ivec2	(ivec2,int)
OP_ASSIGN_BIT_XOR(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1902		ivec2	(ivec2,ivec2)
OP_ASSIGN_BIT_XOR(ivec3,int)	operator	servers/rendering/shader_language.cpp:1902		ivec3	(ivec3,int)
OP_ASSIGN_BIT_XOR(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1902		ivec3	(ivec3,ivec3)
OP_ASSIGN_BIT_XOR(ivec4,int)	operator	servers/rendering/shader_language.cpp:1902		ivec4	(ivec4,int)
OP_ASSIGN_BIT_XOR(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1902		ivec4	(ivec4,ivec4)
OP_ASSIGN_BIT_XOR(uint,uint)	operator	servers/rendering/shader_language.cpp:1902		uint	(uint,uint)
OP_ASSIGN_BIT_XOR(uvec2,uint)	operator	servers/rendering/shader_language.cpp:1902		uvec2	(uvec2,uint)
OP_ASSIGN_BIT_XOR(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1902		uvec2	(uvec2,uvec2)
OP_ASSIGN_BIT_XOR(uvec3,uint)	operator	servers/rendering/shader_language.cpp:1902		uvec3	(uvec3,uint)
OP_ASSIGN_BIT_XOR(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1902		uvec3	(uvec3,uvec3)
OP_ASSIGN_BIT_XOR(uvec4,uint)	operator	servers/rendering/shader_language.cpp:1902		uvec4	(uvec4,uint)
OP_ASSIGN_BIT_XOR(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1902		uvec4	(uvec4,uvec4)
OP_BIT_AND(int,int)	operator	servers/rendering/shader_language.cpp:1902		int	(int,int)
OP_BIT_AND(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1902		ivec2	(ivec2,ivec2)
OP_BIT_AND(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1902		ivec3	(ivec3,ivec3)
OP_BIT_AND(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1902		ivec4	(ivec4,ivec4)
OP_BIT_AND(uint,uint)	operator	servers/rendering/shader_language.cpp:1902		uint	(uint,uint)
OP_BIT_AND(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1902		uvec2	(uvec2,uvec2)
OP_BIT_AND(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1902		uvec3	(uvec3,uvec3)
OP_BIT_AND(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1902		uvec4	(uvec4,uvec4)
OP_BIT_OR(int,int)	operator	servers/rendering/shader_language.cpp:1902		int	(int,int)
OP_BIT_OR(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1902		ivec2	(ivec2,ivec2)
OP_BIT_OR(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1902		ivec3	(ivec3,ivec3)
OP_BIT_OR(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1902		ivec4	(ivec4,ivec4)
OP_BIT_OR(uint,uint)	operator	servers/rendering/shader_language.cpp:1902		uint	(uint,uint)
OP_BIT_OR(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1902		uvec2	(uvec2,uvec2)
OP_BIT_OR(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1902		uvec3	(uvec3,uvec3)
OP_BIT_OR(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1902		uvec4	(uvec4,uvec4)
OP_BIT_XOR(int,int)	operator	servers/rendering/shader_language.cpp:1902		int	(int,int)
OP_BIT_XOR(ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1902		ivec2	(ivec2,ivec2)
OP_BIT_XOR(ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1902		ivec3	(ivec3,ivec3)
OP_BIT_XOR(ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1902		ivec4	(ivec4,ivec4)
OP_BIT_XOR(uint,uint)	operator	servers/rendering/shader_language.cpp:1902		uint	(uint,uint)
OP_BIT_XOR(uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1902		uvec2	(uvec2,uvec2)
OP_BIT_XOR(uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1902		uvec3	(uvec3,uvec3)
OP_BIT_XOR(uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1902		uvec4	(uvec4,uvec4)
OP_BIT_INVERT(int)	operator	servers/rendering/shader_language.cpp:1981		int	(int)
OP_BIT_INVERT(ivec2)	operator	servers/rendering/shader_language.cpp:1981		ivec2	(ivec2)
OP_BIT_INVERT(ivec3)	operator	servers/rendering/shader_language.cpp:1981		ivec3	(ivec3)
OP_BIT_INVERT(ivec4)	operator	servers/rendering/shader_language.cpp:1981		ivec4	(ivec4)
OP_BIT_INVERT(uint)	operator	servers/rendering/shader_language.cpp:1981		uint	(uint)
OP_BIT_INVERT(uvec2)	operator	servers/rendering/shader_language.cpp:1981		uvec2	(uvec2)
OP_BIT_INVERT(uvec3)	operator	servers/rendering/shader_language.cpp:1981		uvec3	(uvec3)
OP_BIT_INVERT(uvec4)	operator	servers/rendering/shader_language.cpp:1981		uvec4	(uvec4)
OP_INCREMENT(int)	operator	servers/rendering/shader_language.cpp:1614		int	(int)
OP_INCREMENT(ivec2)	operator	servers/rendering/shader_language.cpp:1614		ivec2	(ivec2)
OP_INCREMENT(ivec3)	operator	servers/rendering/shader_language.cpp:1614		ivec3	(ivec3)
OP_INCREMENT(ivec4)	operator	servers/rendering/shader_language.cpp:1614		ivec4	(ivec4)
OP_INCREMENT(uint)	operator	servers/rendering/shader_language.cpp:1614		uint	(uint)
OP_INCREMENT(uvec2)	operator	servers/rendering/shader_language.cpp:1614		uvec2	(uvec2)
OP_INCREMENT(uvec3)	operator	servers/rendering/shader_language.cpp:1614		uvec3	(uvec3)
OP_INCREMENT(uvec4)	operator	servers/rendering/shader_language.cpp:1614		uvec4	(uvec4)
OP_INCREMENT(float)	operator	servers/rendering/shader_language.cpp:1614		float	(float)
OP_INCREMENT(vec2)	operator	servers/rendering/shader_language.cpp:1614		vec2	(vec2)
OP_INCREMENT(vec3)	operator	servers/rendering/shader_language.cpp:1614		vec3	(vec3)
OP_INCREMENT(vec4)	operator	servers/rendering/shader_language.cpp:1614		vec4	(vec4)
OP_DECREMENT(int)	operator	servers/rendering/shader_language.cpp:1614		int	(int)
OP_DECREMENT(ivec2)	operator	servers/rendering/shader_language.cpp:1614		ivec2	(ivec2)
OP_DECREMENT(ivec3)	operator	servers/rendering/shader_language.cpp:1614		ivec3	(ivec3)
OP_DECREMENT(ivec4)	operator	servers/rendering/shader_language.cpp:1614		ivec4	(ivec4)
OP_DECREMENT(uint)	operator	servers/rendering/shader_language.cpp:1614		uint	(uint)
OP_DECREMENT(uvec2)	operator	servers/rendering/shader_language.cpp:1614		uvec2	(uvec2)
OP_DECREMENT(uvec3)	operator	servers/rendering/shader_language.cpp:1614		uvec3	(uvec3)
OP_DECREMENT(uvec4)	operator	servers/rendering/shader_language.cpp:1614		uvec4	(uvec4)
OP_DECREMENT(float)	operator	servers/rendering/shader_language.cpp:1614		float	(float)
OP_DECREMENT(vec2)	operator	servers/rendering/shader_language.cpp:1614		vec2	(vec2)
OP_DECREMENT(vec3)	operator	servers/rendering/shader_language.cpp:1614		vec3	(vec3)
OP_DECREMENT(vec4)	operator	servers/rendering/shader_language.cpp:1614		vec4	(vec4)
OP_SELECT_IF(bool,bool,bool)	operator	servers/rendering/shader_language.cpp:1990		bool	(bool,bool,bool)
OP_SELECT_IF(bool,bvec2,bvec2)	operator	servers/rendering/shader_language.cpp:1990		bvec2	(bool,bvec2,bvec2)
OP_SELECT_IF(bool,bvec3,bvec3)	operator	servers/rendering/shader_language.cpp:1990		bvec3	(bool,bvec3,bvec3)
OP_SELECT_IF(bool,bvec4,bvec4)	operator	servers/rendering/shader_language.cpp:1990		bvec4	(bool,bvec4,bvec4)
OP_SELECT_IF(bool,int,int)	operator	servers/rendering/shader_language.cpp:1990		int	(bool,int,int)
OP_SELECT_IF(bool,ivec2,ivec2)	operator	servers/rendering/shader_language.cpp:1990		ivec2	(bool,ivec2,ivec2)
OP_SELECT_IF(bool,ivec3,ivec3)	operator	servers/rendering/shader_language.cpp:1990		ivec3	(bool,ivec3,ivec3)
OP_SELECT_IF(bool,ivec4,ivec4)	operator	servers/rendering/shader_language.cpp:1990		ivec4	(bool,ivec4,ivec4)
OP_SELECT_IF(bool,uint,uint)	operator	servers/rendering/shader_language.cpp:1990		uint	(bool,uint,uint)
OP_SELECT_IF(bool,uvec2,uvec2)	operator	servers/rendering/shader_language.cpp:1990		uvec2	(bool,uvec2,uvec2)
OP_SELECT_IF(bool,uvec3,uvec3)	operator	servers/rendering/shader_language.cpp:1990		uvec3	(bool,uvec3,uvec3)
OP_SELECT_IF(bool,uvec4,uvec4)	operator	servers/rendering/shader_language.cpp:1990		uvec4	(bool,uvec4,uvec4)
OP_SELECT_IF(bool,float,float)	operator	servers/rendering/shader_language.cpp:1990		float	(bool,float,float)
OP_SELECT_IF(bool,vec2,vec2)	operator	servers/rendering/shader_language.cpp:1990		vec2	(bool,vec2,vec2)
OP_SELECT_IF(bool,vec3,vec3)	operator	servers/rendering/shader_language.cpp:1990		vec3	(bool,vec3,vec3)
OP_SELECT_IF(bool,vec4,vec4)	operator	servers/rendering/shader_language.cpp:1990		vec4	(bool,vec4,vec4)
OP_SELECT_IF(bool,mat2,mat2)	operator	servers/rendering/shader_language.cpp:1990		mat2	(bool,mat2,mat2)
OP_SELECT_IF(bool,mat3,mat3)	operator	servers/rendering/shader_language.cpp:1990		mat3	(bool,mat3,mat3)
OP_SELECT_IF(bool,mat4,mat4)	operator	servers/rendering/shader_language.cpp:1990		mat4	(bool,mat4,mat4)
OP_SELECT_ELSE	operator	servers/rendering/shader_language.cpp:1558			
OP_POST_INCREMENT(int)	operator	servers/rendering/shader_language.cpp:1614		int	(int)
OP_POST_INCREMENT(ivec2)	operator	servers/rendering/shader_language.cpp:1614		ivec2	(ivec2)
OP_POST_INCREMENT(ivec3)	operator	servers/rendering/shader_language.cpp:1614		ivec3	(ivec3)
OP_POST_INCREMENT(ivec4)	operator	servers/rendering/shader_language.cpp:1614		ivec4	(ivec4)
OP_POST_INCREMENT(uint)	operator	servers/rendering/shader_language.cpp:1614		uint	(uint)
OP_POST_INCREMENT(uvec2)	operator	servers/rendering/shader_language.cpp:1614		uvec2	(uvec2)
OP_POST_INCREMENT(uvec3)	operator	servers/rendering/shader_language.cpp:1614		uvec3	(uvec3)
OP_POST_INCREMENT(uvec4)	operator	servers/rendering/shader_language.cpp:1614		uvec4	(uvec4)
OP_POST_INCREMENT(float)	operator	servers/rendering/shader_language.cpp:1614		float	(float)
OP_POST_INCREMENT(vec2)	operator	servers/rendering/shader_language.cpp:1614		vec2	(vec2)
OP_POST_INCREMENT(vec3)	operator	servers/rendering/shader_language.cpp:1614		vec3	(vec3)
OP_POST_INCREMENT(vec4)	operator	servers/rendering/shader_language.cpp:1614		vec4	(vec4)
OP_POST_DECREMENT(int)	operator	servers/rendering/shader_language.cpp:1614		int	(int)
OP_POST_DECREMENT(ivec2)	operator	servers/rendering/shader_language.cpp:1614		ivec2	(ivec2)
OP_POST_DECREMENT(ivec3)	operator	servers/rendering/shader_language.cpp:1614		ivec3	(ivec3)
OP_POST_DECREMENT(ivec4)	operator	servers/rendering/shader_language.cpp:1614		ivec4	(ivec4)
OP_POST_DECREMENT(uint)	operator	servers/rendering/shader_language.cpp:1614		uint	(uint)
OP_POST_DECREMENT(uvec2)	operator	servers/rendering/shader_language.cpp:1614		uvec2	(uvec2)
OP_POST_DECREMENT(uvec3)	operator	servers/rendering/shader_language.cpp:1614		uvec3	(uvec3)
OP_POST_DECREMENT(uvec4)	operator	servers/rendering/shader_language.cpp:1614		uvec4	(uvec4)
OP_POST_DECREMENT(float)	operator	servers/rendering/shader_language.cpp:1614		float	(float)
OP_POST_DECREMENT(vec2)	operator	servers/rendering/shader_language.cpp:1614		vec2	(vec2)
OP_POST_DECREMENT(vec3)	operator	servers/rendering/shader_language.cpp:1614		vec3	(vec3)
OP_POST_DECREMENT(vec4)	operator	servers/rendering/shader_language.cpp:1614		vec4	(vec4)
OP_CALL	operator	servers/rendering/shader_language.cpp:1558			
OP_CONSTRUCT	operator	servers/rendering/shader_language.cpp:1558			
OP_STRUCT	operator	servers/rendering/shader_language.cpp:1558			
OP_INDEX	operator	servers/rendering/shader_language.cpp:1558			
OP_EMPTY	operator	servers/rendering/shader_language.cpp:1558			
FLOW_OP_IF	statement	servers/rendering/shader_language.h:307			
FLOW_OP_RETURN	statement	servers/rendering/shader_language.h:308			
FLOW_OP_FOR	statement	servers/rendering/shader_language.h:309			
FLOW_OP_WHILE	statement	servers/rendering/shader_language.h:310			
FLOW_OP_DO	statement	servers/rendering/shader_language.h:311			
FLOW_OP_BREAK	statement	servers/rendering/shader_language.h:312			
FLOW_OP_SWITCH	statement	servers/rendering/shader_language.h:313			
FLOW_OP_CASE	statement	servers/rendering/shader_language.h:314			
FLOW_OP_DEFAULT	statement	servers/rendering/shader_language.h:315			
FLOW_OP_CONTINUE	statement	servers/rendering/shader_language.h:316			
FLOW_OP_DISCARD	statement	servers/rendering/shader_language.h:317			
bvec2(bool)	constructor	servers/rendering/shader_language.cpp:2422		bvec2	(bool)
bvec2(bool,bool)	constructor	servers/rendering/shader_language.cpp:2423		bvec2	(bool,bool)
bvec3(bool)	constructor	servers/rendering/shader_language.cpp:2424		bvec3	(bool)
bvec3(bool,bool,bool)	constructor	servers/rendering/shader_language.cpp:2425		bvec3	(bool,bool,bool)
bvec3(bvec2,bool)	constructor	servers/rendering/shader_language.cpp:2426		bvec3	(bvec2,bool)
bvec3(bool,bvec2)	constructor	servers/rendering/shader_language.cpp:2427		bvec3	(bool,bvec2)
bvec4(bool)	constructor	servers/rendering/shader_language.cpp:2428		bvec4	(bool)
bvec4(bool,bool,bool,bool)	constructor	servers/rendering/shader_language.cpp:2429		bvec4	(bool,bool,bool,bool)
bvec4(bool,bvec2,bool)	constructor	servers/rendering/shader_language.cpp:2430		bvec4	(bool,bvec2,bool)
bvec4(bvec2,bool,bool)	constructor	servers/rendering/shader_language.cpp:2431		bvec4	(bvec2,bool,bool)
bvec4(bool,bool,bvec2)	constructor	servers/rendering/shader_language.cpp:2432		bvec4	(bool,bool,bvec2)
bvec4(bool,bvec3)	constructor	servers/rendering/shader_language.cpp:2433		bvec4	(bool,bvec3)
bvec4(bvec3,bool)	constructor	servers/rendering/shader_language.cpp:2434		bvec4	(bvec3,bool)
bvec4(bvec2,bvec2)	constructor	servers/rendering/shader_language.cpp:2435		bvec4	(bvec2,bvec2)
vec2(float)	constructor	servers/rendering/shader_language.cpp:2437		vec2	(float)
vec2(float,float)	constructor	servers/rendering/shader_language.cpp:2438		vec2	(float,float)
vec3(float)	constructor	servers/rendering/shader_language.cpp:2439		vec3	(float)
vec3(float,float,float)	constructor	servers/rendering/shader_language.cpp:2440		vec3	(float,float,float)
vec3(vec2,float)	constructor	servers/rendering/shader_language.cpp:2441		vec3	(vec2,float)
vec3(float,vec2)	constructor	servers/rendering/shader_language.cpp:2442		vec3	(float,vec2)
vec4(float)	constructor	servers/rendering/shader_language.cpp:2443		vec4	(float)
vec4(float,float,float,float)	constructor	servers/rendering/shader_language.cpp:2444		vec4	(float,float,float,float)
vec4(float,vec2,float)	constructor	servers/rendering/shader_language.cpp:2445		vec4	(float,vec2,float)
vec4(vec2,float,float)	constructor	servers/rendering/shader_language.cpp:2446		vec4	(vec2,float,float)
vec4(float,float,vec2)	constructor	servers/rendering/shader_language.cpp:2447		vec4	(float,float,vec2)
vec4(float,vec3)	constructor	servers/rendering/shader_language.cpp:2448		vec4	(float,vec3)
vec4(vec3,float)	constructor	servers/rendering/shader_language.cpp:2449		vec4	(vec3,float)
vec4(vec2,vec2)	constructor	servers/rendering/shader_language.cpp:2450		vec4	(vec2,vec2)
ivec2(int)	constructor	servers/rendering/shader_language.cpp:2452		ivec2	(int)
ivec2(int,int)	constructor	servers/rendering/shader_language.cpp:2453		ivec2	(int,int)
ivec3(int)	constructor	servers/rendering/shader_language.cpp:2454		ivec3	(int)
ivec3(int,int,int)	constructor	servers/rendering/shader_language.cpp:2455		ivec3	(int,int,int)
ivec3(ivec2,int)	constructor	servers/rendering/shader_language.cpp:2456		ivec3	(ivec2,int)
ivec3(int,ivec2)	constructor	servers/rendering/shader_language.cpp:2457		ivec3	(int,ivec2)
ivec4(int)	constructor	servers/rendering/shader_language.cpp:2458		ivec4	(int)
ivec4(int,int,int,int)	constructor	servers/rendering/shader_language.cpp:2459		ivec4	(int,int,int,int)
ivec4(int,ivec2,int)	constructor	servers/rendering/shader_language.cpp:2460		ivec4	(int,ivec2,int)
ivec4(ivec2,int,int)	constructor	servers/rendering/shader_language.cpp:2461		ivec4	(ivec2,int,int)
ivec4(int,int,ivec2)	constructor	servers/rendering/shader_language.cpp:2462		ivec4	(int,int,ivec2)
ivec4(int,ivec3)	constructor	servers/rendering/shader_language.cpp:2463		ivec4	(int,ivec3)
ivec4(ivec3,int)	constructor	servers/rendering/shader_language.cpp:2464		ivec4	(ivec3,int)
ivec4(ivec2,ivec2)	constructor	servers/rendering/shader_language.cpp:2465		ivec4	(ivec2,ivec2)
uvec2(uint)	constructor	servers/rendering/shader_language.cpp:2467		uvec2	(uint)
uvec2(uint,uint)	constructor	servers/rendering/shader_language.cpp:2468		uvec2	(uint,uint)
uvec3(uint)	constructor	servers/rendering/shader_language.cpp:2469		uvec3	(uint)
uvec3(uint,uint,uint)	constructor	servers/rendering/shader_language.cpp:2470		uvec3	(uint,uint,uint)
uvec3(uvec2,uint)	constructor	servers/rendering/shader_language.cpp:2471		uvec3	(uvec2,uint)
uvec3(uint,uvec2)	constructor	servers/rendering/shader_language.cpp:2472		uvec3	(uint,uvec2)
uvec4(uint)	constructor	servers/rendering/shader_language.cpp:2473		uvec4	(uint)
uvec4(uint,uint,uint,uint)	constructor	servers/rendering/shader_language.cpp:2474		uvec4	(uint,uint,uint,uint)
uvec4(uint,uvec2,uint)	constructor	servers/rendering/shader_language.cpp:2475		uvec4	(uint,uvec2,uint)
uvec4(uvec2,uint,uint)	constructor	servers/rendering/shader_language.cpp:2476		uvec4	(uvec2,uint,uint)
uvec4(uint,uint,uvec2)	constructor	servers/rendering/shader_language.cpp:2477		uvec4	(uint,uint,uvec2)
uvec4(uint,uvec3)	constructor	servers/rendering/shader_language.cpp:2478		uvec4	(uint,uvec3)
uvec4(uvec3,uint)	constructor	servers/rendering/shader_language.cpp:2479		uvec4	(uvec3,uint)
uvec4(uvec2,uvec2)	constructor	servers/rendering/shader_language.cpp:2480		uvec4	(uvec2,uvec2)
mat2(vec2,vec2)	constructor	servers/rendering/shader_language.cpp:2482		mat2	(vec2,vec2)
mat3(vec3,vec3,vec3)	constructor	servers/rendering/shader_language.cpp:2483		mat3	(vec3,vec3,vec3)
mat4(vec4,vec4,vec4,vec4)	constructor	servers/rendering/shader_language.cpp:2484		mat4	(vec4,vec4,vec4,vec4)
mat2(float)	constructor	servers/rendering/shader_language.cpp:2486		mat2	(float)
mat3(float)	constructor	servers/rendering/shader_language.cpp:2487		mat3	(float)
mat4(float)	constructor	servers/rendering/shader_language.cpp:2488		mat4	(float)
int(bool)	function	servers/rendering/shader_language.cpp:2492		int	(bool)
int(int)	function	servers/rendering/shader_language.cpp:2493		int	(int)
int(uint)	function	servers/rendering/shader_language.cpp:2494		int	(uint)
int(float)	function	servers/rendering/shader_language.cpp:2495		int	(float)
float(bool)	function	servers/rendering/shader_language.cpp:2497		float	(bool)
float(int)	function	servers/rendering/shader_language.cpp:2498		float	(int)
float(uint)	function	servers/rendering/shader_language.cpp:2499		float	(uint)
float(float)	function	servers/rendering/shader_language.cpp:2500		float	(float)
uint(bool)	function	servers/rendering/shader_language.cpp:2502		uint	(bool)
uint(int)	function	servers/rendering/shader_language.cpp:2503		uint	(int)
uint(uint)	function	servers/rendering/shader_language.cpp:2504		uint	(uint)
uint(float)	function	servers/rendering/shader_language.cpp:2505		uint	(float)
bool(bool)	function	servers/rendering/shader_language.cpp:2507		bool	(bool)
bool(int)	function	servers/rendering/shader_language.cpp:2508		bool	(int)
bool(uint)	function	servers/rendering/shader_language.cpp:2509		bool	(uint)
bool(float)	function	servers/rendering/shader_language.cpp:2510		bool	(float)
ivec2(bvec2)	function	servers/rendering/shader_language.cpp:2514		ivec2	(bvec2)
ivec2(ivec2)	function	servers/rendering/shader_language.cpp:2515		ivec2	(ivec2)
ivec2(uvec2)	function	servers/rendering/shader_language.cpp:2516		ivec2	(uvec2)
ivec2(vec2)	function	servers/rendering/shader_language.cpp:2517		ivec2	(vec2)
vec2(bvec2)	function	servers/rendering/shader_language.cpp:2519		vec2	(bvec2)
vec2(ivec2)	function	servers/rendering/shader_language.cpp:2520		vec2	(ivec2)
vec2(uvec2)	function	servers/rendering/shader_language.cpp:2521		vec2	(uvec2)
vec2(vec2)	function	servers/rendering/shader_language.cpp:2522		vec2	(vec2)
uvec2(bvec2)	function	servers/rendering/shader_language.cpp:2524		uvec2	(bvec2)
uvec2(ivec2)	function	servers/rendering/shader_language.cpp:2525		uvec2	(ivec2)
uvec2(uvec2)	function	servers/rendering/shader_language.cpp:2526		uvec2	(uvec2)
uvec2(vec2)	function	servers/rendering/shader_language.cpp:2527		uvec2	(vec2)
bvec2(bvec2)	function	servers/rendering/shader_language.cpp:2529		bvec2	(bvec2)
bvec2(ivec2)	function	servers/rendering/shader_language.cpp:2530		bvec2	(ivec2)
bvec2(uvec2)	function	servers/rendering/shader_language.cpp:2531		bvec2	(uvec2)
bvec2(vec2)	function	servers/rendering/shader_language.cpp:2532		bvec2	(vec2)
ivec3(bvec3)	function	servers/rendering/shader_language.cpp:2534		ivec3	(bvec3)
ivec3(ivec3)	function	servers/rendering/shader_language.cpp:2535		ivec3	(ivec3)
ivec3(uvec3)	function	servers/rendering/shader_language.cpp:2536		ivec3	(uvec3)
ivec3(vec3)	function	servers/rendering/shader_language.cpp:2537		ivec3	(vec3)
vec3(bvec3)	function	servers/rendering/shader_language.cpp:2539		vec3	(bvec3)
vec3(ivec3)	function	servers/rendering/shader_language.cpp:2540		vec3	(ivec3)
vec3(uvec3)	function	servers/rendering/shader_language.cpp:2541		vec3	(uvec3)
vec3(vec3)	function	servers/rendering/shader_language.cpp:2542		vec3	(vec3)
uvec3(bvec3)	function	servers/rendering/shader_language.cpp:2544		uvec3	(bvec3)
uvec3(ivec3)	function	servers/rendering/shader_language.cpp:2545		uvec3	(ivec3)
uvec3(uvec3)	function	servers/rendering/shader_language.cpp:2546		uvec3	(uvec3)
uvec3(vec3)	function	servers/rendering/shader_language.cpp:2547		uvec3	(vec3)
bvec3(bvec3)	function	servers/rendering/shader_language.cpp:2549		bvec3	(bvec3)
bvec3(ivec3)	function	servers/rendering/shader_language.cpp:2550		bvec3	(ivec3)
bvec3(uvec3)	function	servers/rendering/shader_language.cpp:2551		bvec3	(uvec3)
bvec3(vec3)	function	servers/rendering/shader_language.cpp:2552		bvec3	(vec3)
ivec4(bvec4)	function	servers/rendering/shader_language.cpp:2554		ivec4	(bvec4)
ivec4(ivec4)	function	servers/rendering/shader_language.cpp:2555		ivec4	(ivec4)
ivec4(uvec4)	function	servers/rendering/shader_language.cpp:2556		ivec4	(uvec4)
ivec4(vec4)	function	servers/rendering/shader_language.cpp:2557		ivec4	(vec4)
vec4(bvec4)	function	servers/rendering/shader_language.cpp:2559		vec4	(bvec4)
vec4(ivec4)	function	servers/rendering/shader_language.cpp:2560		vec4	(ivec4)
vec4(uvec4)	function	servers/rendering/shader_language.cpp:2561		vec4	(uvec4)
vec4(vec4)	function	servers/rendering/shader_language.cpp:2562		vec4	(vec4)
uvec4(bvec4)	function	servers/rendering/shader_language.cpp:2564		uvec4	(bvec4)
uvec4(ivec4)	function	servers/rendering/shader_language.cpp:2565		uvec4	(ivec4)
uvec4(uvec4)	function	servers/rendering/shader_language.cpp:2566		uvec4	(uvec4)
uvec4(vec4)	function	servers/rendering/shader_language.cpp:2567		uvec4	(vec4)
bvec4(bvec4)	function	servers/rendering/shader_language.cpp:2569		bvec4	(bvec4)
bvec4(ivec4)	function	servers/rendering/shader_language.cpp:2570		bvec4	(ivec4)
bvec4(uvec4)	function	servers/rendering/shader_language.cpp:2571		bvec4	(uvec4)
bvec4(vec4)	function	servers/rendering/shader_language.cpp:2572		bvec4	(vec4)
mat2(mat3)	function	servers/rendering/shader_language.cpp:2576		mat2	(mat3)
mat2(mat4)	function	servers/rendering/shader_language.cpp:2577		mat2	(mat4)
mat3(mat2)	function	servers/rendering/shader_language.cpp:2578		mat3	(mat2)
mat3(mat4)	function	servers/rendering/shader_language.cpp:2579		mat3	(mat4)
mat4(mat2)	function	servers/rendering/shader_language.cpp:2580		mat4	(mat2)
mat4(mat3)	function	servers/rendering/shader_language.cpp:2581		mat4	(mat3)
radians(float)	function	servers/rendering/shader_language.cpp:2586		float	(float)
radians(vec2)	function	servers/rendering/shader_language.cpp:2587		vec2	(vec2)
radians(vec3)	function	servers/rendering/shader_language.cpp:2588		vec3	(vec3)
radians(vec4)	function	servers/rendering/shader_language.cpp:2589		vec4	(vec4)
degrees(float)	function	servers/rendering/shader_language.cpp:2593		float	(float)
degrees(vec2)	function	servers/rendering/shader_language.cpp:2594		vec2	(vec2)
degrees(vec3)	function	servers/rendering/shader_language.cpp:2595		vec3	(vec3)
degrees(vec4)	function	servers/rendering/shader_language.cpp:2596		vec4	(vec4)
sin(float)	function	servers/rendering/shader_language.cpp:2600		float	(float)
sin(vec2)	function	servers/rendering/shader_language.cpp:2601		vec2	(vec2)
sin(vec3)	function	servers/rendering/shader_language.cpp:2602		vec3	(vec3)
sin(vec4)	function	servers/rendering/shader_language.cpp:2603		vec4	(vec4)
cos(float)	function	servers/rendering/shader_language.cpp:2607		float	(float)
cos(vec2)	function	servers/rendering/shader_language.cpp:2608		vec2	(vec2)
cos(vec3)	function	servers/rendering/shader_language.cpp:2609		vec3	(vec3)
cos(vec4)	function	servers/rendering/shader_language.cpp:2610		vec4	(vec4)
tan(float)	function	servers/rendering/shader_language.cpp:2614		float	(float)
tan(vec2)	function	servers/rendering/shader_language.cpp:2615		vec2	(vec2)
tan(vec3)	function	servers/rendering/shader_language.cpp:2616		vec3	(vec3)
tan(vec4)	function	servers/rendering/shader_language.cpp:2617		vec4	(vec4)
asin(float)	function	servers/rendering/shader_language.cpp:2621		float	(float)
asin(vec2)	function	servers/rendering/shader_language.cpp:2622		vec2	(vec2)
asin(vec3)	function	servers/rendering/shader_language.cpp:2623		vec3	(vec3)
asin(vec4)	function	servers/rendering/shader_language.cpp:2624		vec4	(vec4)
acos(float)	function	servers/rendering/shader_language.cpp:2628		float	(float)
acos(vec2)	function	servers/rendering/shader_language.cpp:2629		vec2	(vec2)
acos(vec3)	function	servers/rendering/shader_language.cpp:2630		vec3	(vec3)
acos(vec4)	function	servers/rendering/shader_language.cpp:2631		vec4	(vec4)
atan(float)	function	servers/rendering/shader_language.cpp:2635		float	(float)
atan(vec2)	function	servers/rendering/shader_language.cpp:2636		vec2	(vec2)
atan(vec3)	function	servers/rendering/shader_language.cpp:2637		vec3	(vec3)
atan(vec4)	function	servers/rendering/shader_language.cpp:2638		vec4	(vec4)
atan(float,float)	function	servers/rendering/shader_language.cpp:2639		float	(float,float)
atan(vec2,vec2)	function	servers/rendering/shader_language.cpp:2640		vec2	(vec2,vec2)
atan(vec3,vec3)	function	servers/rendering/shader_language.cpp:2641		vec3	(vec3,vec3)
atan(vec4,vec4)	function	servers/rendering/shader_language.cpp:2642		vec4	(vec4,vec4)
sinh(float)	function	servers/rendering/shader_language.cpp:2646		float	(float)
sinh(vec2)	function	servers/rendering/shader_language.cpp:2647		vec2	(vec2)
sinh(vec3)	function	servers/rendering/shader_language.cpp:2648		vec3	(vec3)
sinh(vec4)	function	servers/rendering/shader_language.cpp:2649		vec4	(vec4)
cosh(float)	function	servers/rendering/shader_language.cpp:2653		float	(float)
cosh(vec2)	function	servers/rendering/shader_language.cpp:2654		vec2	(vec2)
cosh(vec3)	function	servers/rendering/shader_language.cpp:2655		vec3	(vec3)
cosh(vec4)	function	servers/rendering/shader_language.cpp:2656		vec4	(vec4)
tanh(float)	function	servers/rendering/shader_language.cpp:2660		float	(float)
tanh(vec2)	function	servers/rendering/shader_language.cpp:2661		vec2	(vec2)
tanh(vec3)	function	servers/rendering/shader_language.cpp:2662		vec3	(vec3)
tanh(vec4)	function	servers/rendering/shader_language.cpp:2663		vec4	(vec4)
asinh(float)	function	servers/rendering/shader_language.cpp:2667		float	(float)
asinh(vec2)	function	servers/rendering/shader_language.cpp:2668		vec2	(vec2)
asinh(vec3)	function	servers/rendering/shader_language.cpp:2669		vec3	(vec3)
asinh(vec4)	function	servers/rendering/shader_language.cpp:2670		vec4	(vec4)
acosh(float)	function	servers/rendering/shader_language.cpp:2674		float	(float)
acosh(vec2)	function	servers/rendering/shader_language.cpp:2675		vec2	(vec2)
acosh(vec3)	function	servers/rendering/shader_language.cpp:2676		vec3	(vec3)
acosh(vec4)	function	servers/rendering/shader_language.cpp:2677		vec4	(vec4)
atanh(float)	function	servers/rendering/shader_language.cpp:2681		float	(float)
atanh(vec2)	function	servers/rendering/shader_language.cpp:2682		vec2	(vec2)
atanh(vec3)	function	servers/rendering/shader_language.cpp:2683		vec3	(vec3)
atanh(vec4)	function	servers/rendering/shader_language.cpp:2684		vec4	(vec4)
pow(float,float)	function	servers/rendering/shader_language.cpp:2689		float	(float,float)
pow(vec2,vec2)	function	servers/rendering/shader_language.cpp:2690		vec2	(vec2,vec2)
pow(vec3,vec3)	function	servers/rendering/shader_language.cpp:2691		vec3	(vec3,vec3)
pow(vec4,vec4)	function	servers/rendering/shader_language.cpp:2692		vec4	(vec4,vec4)
exp(float)	function	servers/rendering/shader_language.cpp:2696		float	(float)
exp(vec2)	function	servers/rendering/shader_language.cpp:2697		vec2	(vec2)
exp(vec3)	function	servers/rendering/shader_language.cpp:2698		vec3	(vec3)
exp(vec4)	function	servers/rendering/shader_language.cpp:2699		vec4	(vec4)
log(float)	function	servers/rendering/shader_language.cpp:2703		float	(float)
log(vec2)	function	servers/rendering/shader_language.cpp:2704		vec2	(vec2)
log(vec3)	function	servers/rendering/shader_language.cpp:2705		vec3	(vec3)
log(vec4)	function	servers/rendering/shader_language.cpp:2706		vec4	(vec4)
exp2(float)	function	servers/rendering/shader_language.cpp:2710		float	(float)
exp2(vec2)	function	servers/rendering/shader_language.cpp:2711		vec2	(vec2)
exp2(vec3)	function	servers/rendering/shader_language.cpp:2712		vec3	(vec3)
exp2(vec4)	function	servers/rendering/shader_language.cpp:2713		vec4	(vec4)
log2(float)	function	servers/rendering/shader_language.cpp:2717		float	(float)
log2(vec2)	function	servers/rendering/shader_language.cpp:2718		vec2	(vec2)
log2(vec3)	function	servers/rendering/shader_language.cpp:2719		vec3	(vec3)
log2(vec4)	function	servers/rendering/shader_language.cpp:2720		vec4	(vec4)
sqrt(float)	function	servers/rendering/shader_language.cpp:2724		float	(float)
sqrt(vec2)	function	servers/rendering/shader_language.cpp:2725		vec2	(vec2)
sqrt(vec3)	function	servers/rendering/shader_language.cpp:2726		vec3	(vec3)
sqrt(vec4)	function	servers/rendering/shader_language.cpp:2727		vec4	(vec4)
inversesqrt(float)	function	servers/rendering/shader_language.cpp:2731		float	(float)
inversesqrt(vec2)	function	servers/rendering/shader_language.cpp:2732		vec2	(vec2)
inversesqrt(vec3)	function	servers/rendering/shader_language.cpp:2733		vec3	(vec3)
inversesqrt(vec4)	function	servers/rendering/shader_language.cpp:2734		vec4	(vec4)
abs(float)	function	servers/rendering/shader_language.cpp:2739		float	(float)
abs(vec2)	function	servers/rendering/shader_language.cpp:2740		vec2	(vec2)
abs(vec3)	function	servers/rendering/shader_language.cpp:2741		vec3	(vec3)
abs(vec4)	function	servers/rendering/shader_language.cpp:2742		vec4	(vec4)
abs(int)	function	servers/rendering/shader_language.cpp:2744		int	(int)
abs(ivec2)	function	servers/rendering/shader_language.cpp:2745		ivec2	(ivec2)
abs(ivec3)	function	servers/rendering/shader_language.cpp:2746		ivec3	(ivec3)
abs(ivec4)	function	servers/rendering/shader_language.cpp:2747		ivec4	(ivec4)
sign(float)	function	servers/rendering/shader_language.cpp:2751		float	(float)
sign(vec2)	function	servers/rendering/shader_language.cpp:2752		vec2	(vec2)
sign(vec3)	function	servers/rendering/shader_language.cpp:2753		vec3	(vec3)
sign(vec4)	function	servers/rendering/shader_language.cpp:2754		vec4	(vec4)
sign(int)	function	servers/rendering/shader_language.cpp:2756		int	(int)
sign(ivec2)	function	servers/rendering/shader_language.cpp:2757		ivec2	(ivec2)
sign(ivec3)	function	servers/rendering/shader_language.cpp:2758		ivec3	(ivec3)
sign(ivec4)	function	servers/rendering/shader_language.cpp:2759		ivec4	(ivec4)
floor(float)	function	servers/rendering/shader_language.cpp:2763		float	(float)
floor(vec2)	function	servers/rendering/shader_language.cpp:2764		vec2	(vec2)
floor(vec3)	function	servers/rendering/shader_language.cpp:2765		vec3	(vec3)
floor(vec4)	function	servers/rendering/shader_language.cpp:2766		vec4	(vec4)
trunc(float)	function	servers/rendering/shader_language.cpp:2770		float	(float)
trunc(vec2)	function	servers/rendering/shader_language.cpp:2771		vec2	(vec2)
trunc(vec3)	function	servers/rendering/shader_language.cpp:2772		vec3	(vec3)
trunc(vec4)	function	servers/rendering/shader_language.cpp:2773		vec4	(vec4)
round(float)	function	servers/rendering/shader_language.cpp:2777		float	(float)
round(vec2)	function	servers/rendering/shader_language.cpp:2778		vec2	(vec2)
round(vec3)	function	servers/rendering/shader_language.cpp:2779		vec3	(vec3)
round(vec4)	function	servers/rendering/shader_language.cpp:2780		vec4	(vec4)
roundEven(float)	function	servers/rendering/shader_language.cpp:2784		float	(float)
roundEven(vec2)	function	servers/rendering/shader_language.cpp:2785		vec2	(vec2)
roundEven(vec3)	function	servers/rendering/shader_language.cpp:2786		vec3	(vec3)
roundEven(vec4)	function	servers/rendering/shader_language.cpp:2787		vec4	(vec4)
ceil(float)	function	servers/rendering/shader_language.cpp:2791		float	(float)
ceil(vec2)	function	servers/rendering/shader_language.cpp:2792		vec2	(vec2)
ceil(vec3)	function	servers/rendering/shader_language.cpp:2793		vec3	(vec3)
ceil(vec4)	function	servers/rendering/shader_language.cpp:2794		vec4	(vec4)
fract(float)	function	servers/rendering/shader_language.cpp:2798		float	(float)
fract(vec2)	function	servers/rendering/shader_language.cpp:2799		vec2	(vec2)
fract(vec3)	function	servers/rendering/shader_language.cpp:2800		vec3	(vec3)
fract(vec4)	function	servers/rendering/shader_language.cpp:2801		vec4	(vec4)
mod(float,float)	function	servers/rendering/shader_language.cpp:2805		float	(float,float)
mod(vec2,vec2)	function	servers/rendering/shader_language.cpp:2806		vec2	(vec2,vec2)
mod(vec2,float)	function	servers/rendering/shader_language.cpp:2807		vec2	(vec2,float)
mod(vec3,vec3)	function	servers/rendering/shader_language.cpp:2808		vec3	(vec3,vec3)
mod(vec3,float)	function	servers/rendering/shader_language.cpp:2809		vec3	(vec3,float)
mod(vec4,vec4)	function	servers/rendering/shader_language.cpp:2810		vec4	(vec4,vec4)
mod(vec4,float)	function	servers/rendering/shader_language.cpp:2811		vec4	(vec4,float)
modf(float,float)	function	servers/rendering/shader_language.cpp:2815		float	(float,float)
modf(vec2,vec2)	function	servers/rendering/shader_language.cpp:2816		vec2	(vec2,vec2)
modf(vec3,vec3)	function	servers/rendering/shader_language.cpp:2817		vec3	(vec3,vec3)
modf(vec4,vec4)	function	servers/rendering/shader_language.cpp:2818		vec4	(vec4,vec4)
min(float,float)	function	servers/rendering/shader_language.cpp:2822		float	(float,float)
min(vec2,vec2)	function	servers/rendering/shader_language.cpp:2823		vec2	(vec2,vec2)
min(vec2,float)	function	servers/rendering/shader_language.cpp:2824		vec2	(vec2,float)
min(vec3,vec3)	function	servers/rendering/shader_language.cpp:2825		vec3	(vec3,vec3)
min(vec3,float)	function	servers/rendering/shader_language.cpp:2826		vec3	(vec3,float)
min(vec4,vec4)	function	servers/rendering/shader_language.cpp:2827		vec4	(vec4,vec4)
min(vec4,float)	function	servers/rendering/shader_language.cpp:2828		vec4	(vec4,float)
min(int,int)	function	servers/rendering/shader_language.cpp:2830		int	(int,int)
min(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:2831		ivec2	(ivec2,ivec2)
min(ivec2,int)	function	servers/rendering/shader_language.cpp:2832		ivec2	(ivec2,int)
min(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:2833		ivec3	(ivec3,ivec3)
min(ivec3,int)	function	servers/rendering/shader_language.cpp:2834		ivec3	(ivec3,int)
min(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:2835		ivec4	(ivec4,ivec4)
min(ivec4,int)	function	servers/rendering/shader_language.cpp:2836		ivec4	(ivec4,int)
min(uint,uint)	function	servers/rendering/shader_language.cpp:2838		uint	(uint,uint)
min(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:2839		uvec2	(uvec2,uvec2)
min(uvec2,uint)	function	servers/rendering/shader_language.cpp:2840		uvec2	(uvec2,uint)
min(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:2841		uvec3	(uvec3,uvec3)
min(uvec3,uint)	function	servers/rendering/shader_language.cpp:2842		uvec3	(uvec3,uint)
min(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:2843		uvec4	(uvec4,uvec4)
min(uvec4,uint)	function	servers/rendering/shader_language.cpp:2844		uvec4	(uvec4,uint)
max(float,float)	function	servers/rendering/shader_language.cpp:2848		float	(float,float)
max(vec2,vec2)	function	servers/rendering/shader_language.cpp:2849		vec2	(vec2,vec2)
max(vec2,float)	function	servers/rendering/shader_language.cpp:2850		vec2	(vec2,float)
max(vec3,vec3)	function	servers/rendering/shader_language.cpp:2851		vec3	(vec3,vec3)
max(vec3,float)	function	servers/rendering/shader_language.cpp:2852		vec3	(vec3,float)
max(vec4,vec4)	function	servers/rendering/shader_language.cpp:2853		vec4	(vec4,vec4)
max(vec4,float)	function	servers/rendering/shader_language.cpp:2854		vec4	(vec4,float)
max(int,int)	function	servers/rendering/shader_language.cpp:2856		int	(int,int)
max(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:2857		ivec2	(ivec2,ivec2)
max(ivec2,int)	function	servers/rendering/shader_language.cpp:2858		ivec2	(ivec2,int)
max(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:2859		ivec3	(ivec3,ivec3)
max(ivec3,int)	function	servers/rendering/shader_language.cpp:2860		ivec3	(ivec3,int)
max(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:2861		ivec4	(ivec4,ivec4)
max(ivec4,int)	function	servers/rendering/shader_language.cpp:2862		ivec4	(ivec4,int)
max(uint,uint)	function	servers/rendering/shader_language.cpp:2864		uint	(uint,uint)
max(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:2865		uvec2	(uvec2,uvec2)
max(uvec2,uint)	function	servers/rendering/shader_language.cpp:2866		uvec2	(uvec2,uint)
max(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:2867		uvec3	(uvec3,uvec3)
max(uvec3,uint)	function	servers/rendering/shader_language.cpp:2868		uvec3	(uvec3,uint)
max(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:2869		uvec4	(uvec4,uvec4)
max(uvec4,uint)	function	servers/rendering/shader_language.cpp:2870		uvec4	(uvec4,uint)
clamp(float,float,float)	function	servers/rendering/shader_language.cpp:2874		float	(float,float,float)
clamp(vec2,vec2,vec2)	function	servers/rendering/shader_language.cpp:2875		vec2	(vec2,vec2,vec2)
clamp(vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:2876		vec3	(vec3,vec3,vec3)
clamp(vec4,vec4,vec4)	function	servers/rendering/shader_language.cpp:2877		vec4	(vec4,vec4,vec4)
clamp(vec2,float,float)	function	servers/rendering/shader_language.cpp:2878		vec2	(vec2,float,float)
clamp(vec3,float,float)	function	servers/rendering/shader_language.cpp:2879		vec3	(vec3,float,float)
clamp(vec4,float,float)	function	servers/rendering/shader_language.cpp:2880		vec4	(vec4,float,float)
clamp(int,int,int)	function	servers/rendering/shader_language.cpp:2882		int	(int,int,int)
clamp(ivec2,ivec2,ivec2)	function	servers/rendering/shader_language.cpp:2883		ivec2	(ivec2,ivec2,ivec2)
clamp(ivec3,ivec3,ivec3)	function	servers/rendering/shader_language.cpp:2884		ivec3	(ivec3,ivec3,ivec3)
clamp(ivec4,ivec4,ivec4)	function	servers/rendering/shader_language.cpp:2885		ivec4	(ivec4,ivec4,ivec4)
clamp(ivec2,int,int)	function	servers/rendering/shader_language.cpp:2886		ivec2	(ivec2,int,int)
clamp(ivec3,int,int)	function	servers/rendering/shader_language.cpp:2887		ivec3	(ivec3,int,int)
clamp(ivec4,int,int)	function	servers/rendering/shader_language.cpp:2888		ivec4	(ivec4,int,int)
clamp(uint,uint,uint)	function	servers/rendering/shader_language.cpp:2890		uint	(uint,uint,uint)
clamp(uvec2,uvec2,uvec2)	function	servers/rendering/shader_language.cpp:2891		uvec2	(uvec2,uvec2,uvec2)
clamp(uvec3,uvec3,uvec3)	function	servers/rendering/shader_language.cpp:2892		uvec3	(uvec3,uvec3,uvec3)
clamp(uvec4,uvec4,uvec4)	function	servers/rendering/shader_language.cpp:2893		uvec4	(uvec4,uvec4,uvec4)
clamp(uvec2,uint,uint)	function	servers/rendering/shader_language.cpp:2894		uvec2	(uvec2,uint,uint)
clamp(uvec3,uint,uint)	function	servers/rendering/shader_language.cpp:2895		uvec3	(uvec3,uint,uint)
clamp(uvec4,uint,uint)	function	servers/rendering/shader_language.cpp:2896		uvec4	(uvec4,uint,uint)
mix(float,float,float)	function	servers/rendering/shader_language.cpp:2900		float	(float,float,float)
mix(vec2,vec2,float)	function	servers/rendering/shader_language.cpp:2901		vec2	(vec2,vec2,float)
mix(vec2,vec2,bvec2)	function	servers/rendering/shader_language.cpp:2902		vec2	(vec2,vec2,bvec2)
mix(vec2,vec2,vec2)	function	servers/rendering/shader_language.cpp:2903		vec2	(vec2,vec2,vec2)
mix(vec3,vec3,float)	function	servers/rendering/shader_language.cpp:2904		vec3	(vec3,vec3,float)
mix(vec3,vec3,bvec3)	function	servers/rendering/shader_language.cpp:2905		vec3	(vec3,vec3,bvec3)
mix(vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:2906		vec3	(vec3,vec3,vec3)
mix(vec4,vec4,float)	function	servers/rendering/shader_language.cpp:2907		vec4	(vec4,vec4,float)
mix(vec4,vec4,bvec4)	function	servers/rendering/shader_language.cpp:2908		vec4	(vec4,vec4,bvec4)
mix(vec4,vec4,vec4)	function	servers/rendering/shader_language.cpp:2909		vec4	(vec4,vec4,vec4)
step(float,float)	function	servers/rendering/shader_language.cpp:2913		float	(float,float)
step(vec2,vec2)	function	servers/rendering/shader_language.cpp:2914		vec2	(vec2,vec2)
step(vec3,vec3)	function	servers/rendering/shader_language.cpp:2915		vec3	(vec3,vec3)
step(vec4,vec4)	function	servers/rendering/shader_language.cpp:2916		vec4	(vec4,vec4)
step(float,vec2)	function	servers/rendering/shader_language.cpp:2917		vec2	(float,vec2)
step(float,vec3)	function	servers/rendering/shader_language.cpp:2918		vec3	(float,vec3)
step(float,vec4)	function	servers/rendering/shader_language.cpp:2919		vec4	(float,vec4)
smoothstep(float,float,float)	function	servers/rendering/shader_language.cpp:2923		float	(float,float,float)
smoothstep(vec2,vec2,vec2)	function	servers/rendering/shader_language.cpp:2924		vec2	(vec2,vec2,vec2)
smoothstep(vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:2925		vec3	(vec3,vec3,vec3)
smoothstep(vec4,vec4,vec4)	function	servers/rendering/shader_language.cpp:2926		vec4	(vec4,vec4,vec4)
smoothstep(float,float,vec2)	function	servers/rendering/shader_language.cpp:2927		vec2	(float,float,vec2)
smoothstep(float,float,vec3)	function	servers/rendering/shader_language.cpp:2928		vec3	(float,float,vec3)
smoothstep(float,float,vec4)	function	servers/rendering/shader_language.cpp:2929		vec4	(float,float,vec4)
isnan(float)	function	servers/rendering/shader_language.cpp:2933		bool	(float)
isnan(vec2)	function	servers/rendering/shader_language.cpp:2934		bvec2	(vec2)
isnan(vec3)	function	servers/rendering/shader_language.cpp:2935		bvec3	(vec3)
isnan(vec4)	function	servers/rendering/shader_language.cpp:2936		bvec4	(vec4)
isinf(float)	function	servers/rendering/shader_language.cpp:2940		bool	(float)
isinf(vec2)	function	servers/rendering/shader_language.cpp:2941		bvec2	(vec2)
isinf(vec3)	function	servers/rendering/shader_language.cpp:2942		bvec3	(vec3)
isinf(vec4)	function	servers/rendering/shader_language.cpp:2943		bvec4	(vec4)
floatBitsToInt(float)	function	servers/rendering/shader_language.cpp:2947		int	(float)
floatBitsToInt(vec2)	function	servers/rendering/shader_language.cpp:2948		ivec2	(vec2)
floatBitsToInt(vec3)	function	servers/rendering/shader_language.cpp:2949		ivec3	(vec3)
floatBitsToInt(vec4)	function	servers/rendering/shader_language.cpp:2950		ivec4	(vec4)
floatBitsToUint(float)	function	servers/rendering/shader_language.cpp:2954		uint	(float)
floatBitsToUint(vec2)	function	servers/rendering/shader_language.cpp:2955		uvec2	(vec2)
floatBitsToUint(vec3)	function	servers/rendering/shader_language.cpp:2956		uvec3	(vec3)
floatBitsToUint(vec4)	function	servers/rendering/shader_language.cpp:2957		uvec4	(vec4)
intBitsToFloat(int)	function	servers/rendering/shader_language.cpp:2961		float	(int)
intBitsToFloat(ivec2)	function	servers/rendering/shader_language.cpp:2962		vec2	(ivec2)
intBitsToFloat(ivec3)	function	servers/rendering/shader_language.cpp:2963		vec3	(ivec3)
intBitsToFloat(ivec4)	function	servers/rendering/shader_language.cpp:2964		vec4	(ivec4)
uintBitsToFloat(uint)	function	servers/rendering/shader_language.cpp:2968		float	(uint)
uintBitsToFloat(uvec2)	function	servers/rendering/shader_language.cpp:2969		vec2	(uvec2)
uintBitsToFloat(uvec3)	function	servers/rendering/shader_language.cpp:2970		vec3	(uvec3)
uintBitsToFloat(uvec4)	function	servers/rendering/shader_language.cpp:2971		vec4	(uvec4)
length(float)	function	servers/rendering/shader_language.cpp:2976		float	(float)
length(vec2)	function	servers/rendering/shader_language.cpp:2977		float	(vec2)
length(vec3)	function	servers/rendering/shader_language.cpp:2978		float	(vec3)
length(vec4)	function	servers/rendering/shader_language.cpp:2979		float	(vec4)
distance(float,float)	function	servers/rendering/shader_language.cpp:2983		float	(float,float)
distance(vec2,vec2)	function	servers/rendering/shader_language.cpp:2984		float	(vec2,vec2)
distance(vec3,vec3)	function	servers/rendering/shader_language.cpp:2985		float	(vec3,vec3)
distance(vec4,vec4)	function	servers/rendering/shader_language.cpp:2986		float	(vec4,vec4)
dot(float,float)	function	servers/rendering/shader_language.cpp:2990		float	(float,float)
dot(vec2,vec2)	function	servers/rendering/shader_language.cpp:2991		float	(vec2,vec2)
dot(vec3,vec3)	function	servers/rendering/shader_language.cpp:2992		float	(vec3,vec3)
dot(vec4,vec4)	function	servers/rendering/shader_language.cpp:2993		float	(vec4,vec4)
cross(vec3,vec3)	function	servers/rendering/shader_language.cpp:2997		vec3	(vec3,vec3)
normalize(float)	function	servers/rendering/shader_language.cpp:3001		float	(float)
normalize(vec2)	function	servers/rendering/shader_language.cpp:3002		vec2	(vec2)
normalize(vec3)	function	servers/rendering/shader_language.cpp:3003		vec3	(vec3)
normalize(vec4)	function	servers/rendering/shader_language.cpp:3004		vec4	(vec4)
reflect(vec2,vec2)	function	servers/rendering/shader_language.cpp:3008		vec2	(vec2,vec2)
reflect(vec3,vec3)	function	servers/rendering/shader_language.cpp:3009		vec3	(vec3,vec3)
reflect(vec4,vec4)	function	servers/rendering/shader_language.cpp:3010		vec4	(vec4,vec4)
refract(vec2,vec2,float)	function	servers/rendering/shader_language.cpp:3014		vec2	(vec2,vec2,float)
refract(vec3,vec3,float)	function	servers/rendering/shader_language.cpp:3015		vec3	(vec3,vec3,float)
refract(vec4,vec4,float)	function	servers/rendering/shader_language.cpp:3016		vec4	(vec4,vec4,float)
faceforward(vec2,vec2,vec2)	function	servers/rendering/shader_language.cpp:3020		vec2	(vec2,vec2,vec2)
faceforward(vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:3021		vec3	(vec3,vec3,vec3)
faceforward(vec4,vec4,vec4)	function	servers/rendering/shader_language.cpp:3022		vec4	(vec4,vec4,vec4)
matrixCompMult(mat2,mat2)	function	servers/rendering/shader_language.cpp:3026		mat2	(mat2,mat2)
matrixCompMult(mat3,mat3)	function	servers/rendering/shader_language.cpp:3027		mat3	(mat3,mat3)
matrixCompMult(mat4,mat4)	function	servers/rendering/shader_language.cpp:3028		mat4	(mat4,mat4)
outerProduct(vec2,vec2)	function	servers/rendering/shader_language.cpp:3032		mat2	(vec2,vec2)
outerProduct(vec3,vec3)	function	servers/rendering/shader_language.cpp:3033		mat3	(vec3,vec3)
outerProduct(vec4,vec4)	function	servers/rendering/shader_language.cpp:3034		mat4	(vec4,vec4)
transpose(mat2)	function	servers/rendering/shader_language.cpp:3038		mat2	(mat2)
transpose(mat3)	function	servers/rendering/shader_language.cpp:3039		mat3	(mat3)
transpose(mat4)	function	servers/rendering/shader_language.cpp:3040		mat4	(mat4)
determinant(mat2)	function	servers/rendering/shader_language.cpp:3044		float	(mat2)
determinant(mat3)	function	servers/rendering/shader_language.cpp:3045		float	(mat3)
determinant(mat4)	function	servers/rendering/shader_language.cpp:3046		float	(mat4)
inverse(mat2)	function	servers/rendering/shader_language.cpp:3050		mat2	(mat2)
inverse(mat3)	function	servers/rendering/shader_language.cpp:3051		mat3	(mat3)
inverse(mat4)	function	servers/rendering/shader_language.cpp:3052		mat4	(mat4)
lessThan(vec2,vec2)	function	servers/rendering/shader_language.cpp:3056		bvec2	(vec2,vec2)
lessThan(vec3,vec3)	function	servers/rendering/shader_language.cpp:3057		bvec3	(vec3,vec3)
lessThan(vec4,vec4)	function	servers/rendering/shader_language.cpp:3058		bvec4	(vec4,vec4)
lessThan(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:3060		bvec2	(ivec2,ivec2)
lessThan(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:3061		bvec3	(ivec3,ivec3)
lessThan(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:3062		bvec4	(ivec4,ivec4)
lessThan(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:3064		bvec3	(uvec3,uvec3)
lessThan(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:3065		bvec4	(uvec4,uvec4)
lessThan(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:3066		bvec2	(uvec2,uvec2)
greaterThan(vec2,vec2)	function	servers/rendering/shader_language.cpp:3070		bvec2	(vec2,vec2)
greaterThan(vec3,vec3)	function	servers/rendering/shader_language.cpp:3071		bvec3	(vec3,vec3)
greaterThan(vec4,vec4)	function	servers/rendering/shader_language.cpp:3072		bvec4	(vec4,vec4)
greaterThan(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:3074		bvec2	(ivec2,ivec2)
greaterThan(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:3075		bvec3	(ivec3,ivec3)
greaterThan(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:3076		bvec4	(ivec4,ivec4)
greaterThan(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:3078		bvec2	(uvec2,uvec2)
greaterThan(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:3079		bvec3	(uvec3,uvec3)
greaterThan(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:3080		bvec4	(uvec4,uvec4)
lessThanEqual(vec2,vec2)	function	servers/rendering/shader_language.cpp:3084		bvec2	(vec2,vec2)
lessThanEqual(vec3,vec3)	function	servers/rendering/shader_language.cpp:3085		bvec3	(vec3,vec3)
lessThanEqual(vec4,vec4)	function	servers/rendering/shader_language.cpp:3086		bvec4	(vec4,vec4)
lessThanEqual(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:3088		bvec2	(ivec2,ivec2)
lessThanEqual(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:3089		bvec3	(ivec3,ivec3)
lessThanEqual(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:3090		bvec4	(ivec4,ivec4)
lessThanEqual(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:3092		bvec2	(uvec2,uvec2)
lessThanEqual(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:3093		bvec3	(uvec3,uvec3)
lessThanEqual(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:3094		bvec4	(uvec4,uvec4)
greaterThanEqual(vec2,vec2)	function	servers/rendering/shader_language.cpp:3098		bvec2	(vec2,vec2)
greaterThanEqual(vec3,vec3)	function	servers/rendering/shader_language.cpp:3099		bvec3	(vec3,vec3)
greaterThanEqual(vec4,vec4)	function	servers/rendering/shader_language.cpp:3100		bvec4	(vec4,vec4)
greaterThanEqual(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:3102		bvec2	(ivec2,ivec2)
greaterThanEqual(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:3103		bvec3	(ivec3,ivec3)
greaterThanEqual(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:3104		bvec4	(ivec4,ivec4)
greaterThanEqual(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:3106		bvec2	(uvec2,uvec2)
greaterThanEqual(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:3107		bvec3	(uvec3,uvec3)
greaterThanEqual(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:3108		bvec4	(uvec4,uvec4)
equal(vec2,vec2)	function	servers/rendering/shader_language.cpp:3112		bvec2	(vec2,vec2)
equal(vec3,vec3)	function	servers/rendering/shader_language.cpp:3113		bvec3	(vec3,vec3)
equal(vec4,vec4)	function	servers/rendering/shader_language.cpp:3114		bvec4	(vec4,vec4)
equal(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:3116		bvec2	(ivec2,ivec2)
equal(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:3117		bvec3	(ivec3,ivec3)
equal(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:3118		bvec4	(ivec4,ivec4)
equal(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:3120		bvec2	(uvec2,uvec2)
equal(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:3121		bvec3	(uvec3,uvec3)
equal(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:3122		bvec4	(uvec4,uvec4)
equal(bvec2,bvec2)	function	servers/rendering/shader_language.cpp:3124		bvec2	(bvec2,bvec2)
equal(bvec3,bvec3)	function	servers/rendering/shader_language.cpp:3125		bvec3	(bvec3,bvec3)
equal(bvec4,bvec4)	function	servers/rendering/shader_language.cpp:3126		bvec4	(bvec4,bvec4)
notEqual(vec2,vec2)	function	servers/rendering/shader_language.cpp:3130		bvec2	(vec2,vec2)
notEqual(vec3,vec3)	function	servers/rendering/shader_language.cpp:3131		bvec3	(vec3,vec3)
notEqual(vec4,vec4)	function	servers/rendering/shader_language.cpp:3132		bvec4	(vec4,vec4)
notEqual(ivec2,ivec2)	function	servers/rendering/shader_language.cpp:3134		bvec2	(ivec2,ivec2)
notEqual(ivec3,ivec3)	function	servers/rendering/shader_language.cpp:3135		bvec3	(ivec3,ivec3)
notEqual(ivec4,ivec4)	function	servers/rendering/shader_language.cpp:3136		bvec4	(ivec4,ivec4)
notEqual(uvec2,uvec2)	function	servers/rendering/shader_language.cpp:3138		bvec2	(uvec2,uvec2)
notEqual(uvec3,uvec3)	function	servers/rendering/shader_language.cpp:3139		bvec3	(uvec3,uvec3)
notEqual(uvec4,uvec4)	function	servers/rendering/shader_language.cpp:3140		bvec4	(uvec4,uvec4)
notEqual(bvec2,bvec2)	function	servers/rendering/shader_language.cpp:3142		bvec2	(bvec2,bvec2)
notEqual(bvec3,bvec3)	function	servers/rendering/shader_language.cpp:3143		bvec3	(bvec3,bvec3)
notEqual(bvec4,bvec4)	function	servers/rendering/shader_language.cpp:3144		bvec4	(bvec4,bvec4)
any(bvec2)	function	servers/rendering/shader_language.cpp:3148		bool	(bvec2)
any(bvec3)	function	servers/rendering/shader_language.cpp:3149		bool	(bvec3)
any(bvec4)	function	servers/rendering/shader_language.cpp:3150		bool	(bvec4)
all(bvec2)	function	servers/rendering/shader_language.cpp:3154		bool	(bvec2)
all(bvec3)	function	servers/rendering/shader_language.cpp:3155		bool	(bvec3)
all(bvec4)	function	servers/rendering/shader_language.cpp:3156		bool	(bvec4)
not(bvec2)	function	servers/rendering/shader_language.cpp:3160		bvec2	(bvec2)
not(bvec3)	function	servers/rendering/shader_language.cpp:3161		bvec3	(bvec3)
not(bvec4)	function	servers/rendering/shader_language.cpp:3162		bvec4	(bvec4)
textureSize(sampler2D,int)	function	servers/rendering/shader_language.cpp:3167		ivec2	(sampler2D,int)
textureSize(isampler2D,int)	function	servers/rendering/shader_language.cpp:3168		ivec2	(isampler2D,int)
textureSize(usampler2D,int)	function	servers/rendering/shader_language.cpp:3169		ivec2	(usampler2D,int)
textureSize(sampler2DArray,int)	function	servers/rendering/shader_language.cpp:3170		ivec3	(sampler2DArray,int)
textureSize(isampler2DArray,int)	function	servers/rendering/shader_language.cpp:3171		ivec3	(isampler2DArray,int)
textureSize(usampler2DArray,int)	function	servers/rendering/shader_language.cpp:3172		ivec3	(usampler2DArray,int)
textureSize(sampler3D,int)	function	servers/rendering/shader_language.cpp:3173		ivec3	(sampler3D,int)
textureSize(isampler3D,int)	function	servers/rendering/shader_language.cpp:3174		ivec3	(isampler3D,int)
textureSize(usampler3D,int)	function	servers/rendering/shader_language.cpp:3175		ivec3	(usampler3D,int)
textureSize(samplerCube,int)	function	servers/rendering/shader_language.cpp:3176		ivec2	(samplerCube,int)
textureSize(samplerCubeArray,int)	function	servers/rendering/shader_language.cpp:3177		ivec2	(samplerCubeArray,int)
texture(sampler2D,vec2)	function	servers/rendering/shader_language.cpp:3181		vec4	(sampler2D,vec2)
texture(sampler2D,vec2,float)	function	servers/rendering/shader_language.cpp:3182		vec4	(sampler2D,vec2,float)
texture(usampler2D,vec2)	function	servers/rendering/shader_language.cpp:3183		uvec4	(usampler2D,vec2)
texture(usampler2D,vec2,float)	function	servers/rendering/shader_language.cpp:3184		uvec4	(usampler2D,vec2,float)
texture(isampler2D,vec2)	function	servers/rendering/shader_language.cpp:3185		ivec4	(isampler2D,vec2)
texture(isampler2D,vec2,float)	function	servers/rendering/shader_language.cpp:3186		ivec4	(isampler2D,vec2,float)
texture(sampler2DArray,vec3)	function	servers/rendering/shader_language.cpp:3187		vec4	(sampler2DArray,vec3)
texture(sampler2DArray,vec3,float)	function	servers/rendering/shader_language.cpp:3188		vec4	(sampler2DArray,vec3,float)
texture(usampler2DArray,vec3)	function	servers/rendering/shader_language.cpp:3189		uvec4	(usampler2DArray,vec3)
texture(usampler2DArray,vec3,float)	function	servers/rendering/shader_language.cpp:3190		uvec4	(usampler2DArray,vec3,float)
texture(isampler2DArray,vec3)	function	servers/rendering/shader_language.cpp:3191		ivec4	(isampler2DArray,vec3)
texture(isampler2DArray,vec3,float)	function	servers/rendering/shader_language.cpp:3192		ivec4	(isampler2DArray,vec3,float)
texture(sampler3D,vec3)	function	servers/rendering/shader_language.cpp:3193		vec4	(sampler3D,vec3)
texture(sampler3D,vec3,float)	function	servers/rendering/shader_language.cpp:3194		vec4	(sampler3D,vec3,float)
texture(usampler3D,vec3)	function	servers/rendering/shader_language.cpp:3195		uvec4	(usampler3D,vec3)
texture(usampler3D,vec3,float)	function	servers/rendering/shader_language.cpp:3196		uvec4	(usampler3D,vec3,float)
texture(isampler3D,vec3)	function	servers/rendering/shader_language.cpp:3197		ivec4	(isampler3D,vec3)
texture(isampler3D,vec3,float)	function	servers/rendering/shader_language.cpp:3198		ivec4	(isampler3D,vec3,float)
texture(samplerCube,vec3)	function	servers/rendering/shader_language.cpp:3199		vec4	(samplerCube,vec3)
texture(samplerCube,vec3,float)	function	servers/rendering/shader_language.cpp:3200		vec4	(samplerCube,vec3,float)
texture(samplerCubeArray,vec4)	function	servers/rendering/shader_language.cpp:3201		vec4	(samplerCubeArray,vec4)
texture(samplerCubeArray,vec4,float)	function	servers/rendering/shader_language.cpp:3202		vec4	(samplerCubeArray,vec4,float)
texture(samplerExternalOES,vec2)	function	servers/rendering/shader_language.cpp:3203		vec4	(samplerExternalOES,vec2)
texture(samplerExternalOES,vec2,float)	function	servers/rendering/shader_language.cpp:3204		vec4	(samplerExternalOES,vec2,float)
textureProj(sampler2D,vec3)	function	servers/rendering/shader_language.cpp:3208		vec4	(sampler2D,vec3)
textureProj(sampler2D,vec4)	function	servers/rendering/shader_language.cpp:3209		vec4	(sampler2D,vec4)
textureProj(sampler2D,vec3,float)	function	servers/rendering/shader_language.cpp:3210		vec4	(sampler2D,vec3,float)
textureProj(sampler2D,vec4,float)	function	servers/rendering/shader_language.cpp:3211		vec4	(sampler2D,vec4,float)
textureProj(isampler2D,vec3)	function	servers/rendering/shader_language.cpp:3212		ivec4	(isampler2D,vec3)
textureProj(isampler2D,vec4)	function	servers/rendering/shader_language.cpp:3213		ivec4	(isampler2D,vec4)
textureProj(isampler2D,vec3,float)	function	servers/rendering/shader_language.cpp:3214		ivec4	(isampler2D,vec3,float)
textureProj(isampler2D,vec4,float)	function	servers/rendering/shader_language.cpp:3215		ivec4	(isampler2D,vec4,float)
textureProj(usampler2D,vec3)	function	servers/rendering/shader_language.cpp:3216		uvec4	(usampler2D,vec3)
textureProj(usampler2D,vec4)	function	servers/rendering/shader_language.cpp:3217		uvec4	(usampler2D,vec4)
textureProj(usampler2D,vec3,float)	function	servers/rendering/shader_language.cpp:3218		uvec4	(usampler2D,vec3,float)
textureProj(usampler2D,vec4,float)	function	servers/rendering/shader_language.cpp:3219		uvec4	(usampler2D,vec4,float)
textureProj(sampler3D,vec4)	function	servers/rendering/shader_language.cpp:3220		vec4	(sampler3D,vec4)
textureProj(sampler3D,vec4,float)	function	servers/rendering/shader_language.cpp:3221		vec4	(sampler3D,vec4,float)
textureProj(isampler3D,vec4)	function	servers/rendering/shader_language.cpp:3222		ivec4	(isampler3D,vec4)
textureProj(isampler3D,vec4,float)	function	servers/rendering/shader_language.cpp:3223		ivec4	(isampler3D,vec4,float)
textureProj(usampler3D,vec4)	function	servers/rendering/shader_language.cpp:3224		uvec4	(usampler3D,vec4)
textureProj(usampler3D,vec4,float)	function	servers/rendering/shader_language.cpp:3225		uvec4	(usampler3D,vec4,float)
textureLod(sampler2D,vec2,float)	function	servers/rendering/shader_language.cpp:3229		vec4	(sampler2D,vec2,float)
textureLod(isampler2D,vec2,float)	function	servers/rendering/shader_language.cpp:3230		ivec4	(isampler2D,vec2,float)
textureLod(usampler2D,vec2,float)	function	servers/rendering/shader_language.cpp:3231		uvec4	(usampler2D,vec2,float)
textureLod(sampler2DArray,vec3,float)	function	servers/rendering/shader_language.cpp:3232		vec4	(sampler2DArray,vec3,float)
textureLod(isampler2DArray,vec3,float)	function	servers/rendering/shader_language.cpp:3233		ivec4	(isampler2DArray,vec3,float)
textureLod(usampler2DArray,vec3,float)	function	servers/rendering/shader_language.cpp:3234		uvec4	(usampler2DArray,vec3,float)
textureLod(sampler3D,vec3,float)	function	servers/rendering/shader_language.cpp:3235		vec4	(sampler3D,vec3,float)
textureLod(isampler3D,vec3,float)	function	servers/rendering/shader_language.cpp:3236		ivec4	(isampler3D,vec3,float)
textureLod(usampler3D,vec3,float)	function	servers/rendering/shader_language.cpp:3237		uvec4	(usampler3D,vec3,float)
textureLod(samplerCube,vec3,float)	function	servers/rendering/shader_language.cpp:3238		vec4	(samplerCube,vec3,float)
textureLod(samplerCubeArray,vec4,float)	function	servers/rendering/shader_language.cpp:3239		vec4	(samplerCubeArray,vec4,float)
texelFetch(sampler2D,ivec2,int)	function	servers/rendering/shader_language.cpp:3243		vec4	(sampler2D,ivec2,int)
texelFetch(isampler2D,ivec2,int)	function	servers/rendering/shader_language.cpp:3244		ivec4	(isampler2D,ivec2,int)
texelFetch(usampler2D,ivec2,int)	function	servers/rendering/shader_language.cpp:3245		uvec4	(usampler2D,ivec2,int)
texelFetch(sampler2DArray,ivec3,int)	function	servers/rendering/shader_language.cpp:3246		vec4	(sampler2DArray,ivec3,int)
texelFetch(isampler2DArray,ivec3,int)	function	servers/rendering/shader_language.cpp:3247		ivec4	(isampler2DArray,ivec3,int)
texelFetch(usampler2DArray,ivec3,int)	function	servers/rendering/shader_language.cpp:3248		uvec4	(usampler2DArray,ivec3,int)
texelFetch(sampler3D,ivec3,int)	function	servers/rendering/shader_language.cpp:3249		vec4	(sampler3D,ivec3,int)
texelFetch(isampler3D,ivec3,int)	function	servers/rendering/shader_language.cpp:3250		ivec4	(isampler3D,ivec3,int)
texelFetch(usampler3D,ivec3,int)	function	servers/rendering/shader_language.cpp:3251		uvec4	(usampler3D,ivec3,int)
textureProjLod(sampler2D,vec3,float)	function	servers/rendering/shader_language.cpp:3255		vec4	(sampler2D,vec3,float)
textureProjLod(sampler2D,vec4,float)	function	servers/rendering/shader_language.cpp:3256		vec4	(sampler2D,vec4,float)
textureProjLod(isampler2D,vec3,float)	function	servers/rendering/shader_language.cpp:3257		ivec4	(isampler2D,vec3,float)
textureProjLod(isampler2D,vec4,float)	function	servers/rendering/shader_language.cpp:3258		ivec4	(isampler2D,vec4,float)
textureProjLod(usampler2D,vec3,float)	function	servers/rendering/shader_language.cpp:3259		uvec4	(usampler2D,vec3,float)
textureProjLod(usampler2D,vec4,float)	function	servers/rendering/shader_language.cpp:3260		uvec4	(usampler2D,vec4,float)
textureProjLod(sampler3D,vec4,float)	function	servers/rendering/shader_language.cpp:3261		vec4	(sampler3D,vec4,float)
textureProjLod(isampler3D,vec4,float)	function	servers/rendering/shader_language.cpp:3262		ivec4	(isampler3D,vec4,float)
textureProjLod(usampler3D,vec4,float)	function	servers/rendering/shader_language.cpp:3263		uvec4	(usampler3D,vec4,float)
textureGrad(sampler2D,vec2,vec2,vec2)	function	servers/rendering/shader_language.cpp:3267		vec4	(sampler2D,vec2,vec2,vec2)
textureGrad(isampler2D,vec2,vec2,vec2)	function	servers/rendering/shader_language.cpp:3268		ivec4	(isampler2D,vec2,vec2,vec2)
textureGrad(usampler2D,vec2,vec2,vec2)	function	servers/rendering/shader_language.cpp:3269		uvec4	(usampler2D,vec2,vec2,vec2)
textureGrad(sampler2DArray,vec3,vec2,vec2)	function	servers/rendering/shader_language.cpp:3270		vec4	(sampler2DArray,vec3,vec2,vec2)
textureGrad(isampler2DArray,vec3,vec2,vec2)	function	servers/rendering/shader_language.cpp:3271		ivec4	(isampler2DArray,vec3,vec2,vec2)
textureGrad(usampler2DArray,vec3,vec2,vec2)	function	servers/rendering/shader_language.cpp:3272		uvec4	(usampler2DArray,vec3,vec2,vec2)
textureGrad(sampler3D,vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:3273		vec4	(sampler3D,vec3,vec3,vec3)
textureGrad(isampler3D,vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:3274		ivec4	(isampler3D,vec3,vec3,vec3)
textureGrad(usampler3D,vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:3275		uvec4	(usampler3D,vec3,vec3,vec3)
textureGrad(samplerCube,vec3,vec3,vec3)	function	servers/rendering/shader_language.cpp:3276		vec4	(samplerCube,vec3,vec3,vec3)
textureGrad(samplerCubeArray,vec4,vec3,vec3)	function	servers/rendering/shader_language.cpp:3277		vec4	(samplerCubeArray,vec4,vec3,vec3)
textureProjGrad(sampler2D,vec3,vec2,vec2)	function	servers/rendering/shader_language.cpp:3281		vec4	(sampler2D,vec3,vec2,vec2)
textureProjGrad(sampler2D,vec4,vec2,vec2)	function	servers/rendering/shader_language.cpp:3282		vec4	(sampler2D,vec4,vec2,vec2)
textureProjGrad(isampler2D,vec3,vec2,vec2)	function	servers/rendering/shader_language.cpp:3283		ivec4	(isampler2D,vec3,vec2,vec2)
textureProjGrad(isampler2D,vec4,vec2,vec2)	function	servers/rendering/shader_language.cpp:3284		ivec4	(isampler2D,vec4,vec2,vec2)
textureProjGrad(usampler2D,vec3,vec2,vec2)	function	servers/rendering/shader_language.cpp:3285		uvec4	(usampler2D,vec3,vec2,vec2)
textureProjGrad(usampler2D,vec4,vec2,vec2)	function	servers/rendering/shader_language.cpp:3286		uvec4	(usampler2D,vec4,vec2,vec2)
textureProjGrad(sampler3D,vec4,vec3,vec3)	function	servers/rendering/shader_language.cpp:3287		vec4	(sampler3D,vec4,vec3,vec3)
textureProjGrad(isampler3D,vec4,vec3,vec3)	function	servers/rendering/shader_language.cpp:3288		ivec4	(isampler3D,vec4,vec3,vec3)
textureProjGrad(usampler3D,vec4,vec3,vec3)	function	servers/rendering/shader_language.cpp:3289		uvec4	(usampler3D,vec4,vec3,vec3)
textureGather(sampler2D,vec2)	function	servers/rendering/shader_language.cpp:3293		vec4	(sampler2D,vec2)
textureGather(isampler2D,vec2)	function	servers/rendering/shader_language.cpp:3294		ivec4	(isampler2D,vec2)
textureGather(usampler2D,vec2)	function	servers/rendering/shader_language.cpp:3295		uvec4	(usampler2D,vec2)
textureGather(sampler2D,vec2,int)	function	servers/rendering/shader_language.cpp:3296		vec4	(sampler2D,vec2,int)
textureGather(isampler2D,vec2,int)	function	servers/rendering/shader_language.cpp:3297		ivec4	(isampler2D,vec2,int)
textureGather(usampler2D,vec2,int)	function	servers/rendering/shader_language.cpp:3298		uvec4	(usampler2D,vec2,int)
textureGather(sampler2DArray,vec3)	function	servers/rendering/shader_language.cpp:3299		vec4	(sampler2DArray,vec3)
textureGather(isampler2DArray,vec3)	function	servers/rendering/shader_language.cpp:3300		ivec4	(isampler2DArray,vec3)
textureGather(usampler2DArray,vec3)	function	servers/rendering/shader_language.cpp:3301		uvec4	(usampler2DArray,vec3)
textureGather(sampler2DArray,vec3,int)	function	servers/rendering/shader_language.cpp:3302		vec4	(sampler2DArray,vec3,int)
textureGather(isampler2DArray,vec3,int)	function	servers/rendering/shader_language.cpp:3303		ivec4	(isampler2DArray,vec3,int)
textureGather(usampler2DArray,vec3,int)	function	servers/rendering/shader_language.cpp:3304		uvec4	(usampler2DArray,vec3,int)
textureGather(samplerCube,vec3)	function	servers/rendering/shader_language.cpp:3305		vec4	(samplerCube,vec3)
textureGather(samplerCube,vec3,int)	function	servers/rendering/shader_language.cpp:3306		vec4	(samplerCube,vec3,int)
textureQueryLod(sampler2D,vec2)	function (high_end)	servers/rendering/shader_language.cpp:3310		vec2	(sampler2D,vec2)
textureQueryLod(isampler2D,vec2)	function (high_end)	servers/rendering/shader_language.cpp:3311		vec2	(isampler2D,vec2)
textureQueryLod(usampler2D,vec2)	function (high_end)	servers/rendering/shader_language.cpp:3312		vec2	(usampler2D,vec2)
textureQueryLod(sampler2DArray,vec2)	function (high_end)	servers/rendering/shader_language.cpp:3313		vec2	(sampler2DArray,vec2)
textureQueryLod(isampler2DArray,vec2)	function (high_end)	servers/rendering/shader_language.cpp:3314		vec2	(isampler2DArray,vec2)
textureQueryLod(usampler2DArray,vec2)	function (high_end)	servers/rendering/shader_language.cpp:3315		vec2	(usampler2DArray,vec2)
textureQueryLod(sampler3D,vec3)	function (high_end)	servers/rendering/shader_language.cpp:3316		vec2	(sampler3D,vec3)
textureQueryLod(isampler3D,vec3)	function (high_end)	servers/rendering/shader_language.cpp:3317		vec2	(isampler3D,vec3)
textureQueryLod(usampler3D,vec3)	function (high_end)	servers/rendering/shader_language.cpp:3318		vec2	(usampler3D,vec3)
textureQueryLod(samplerCube,vec3)	function (high_end)	servers/rendering/shader_language.cpp:3319		vec2	(samplerCube,vec3)
textureQueryLevels(sampler2D)	function (high_end)	servers/rendering/shader_language.cpp:3323		int	(sampler2D)
textureQueryLevels(isampler2D)	function (high_end)	servers/rendering/shader_language.cpp:3324		int	(isampler2D)
textureQueryLevels(usampler2D)	function (high_end)	servers/rendering/shader_language.cpp:3325		int	(usampler2D)
textureQueryLevels(sampler2DArray)	function (high_end)	servers/rendering/shader_language.cpp:3326		int	(sampler2DArray)
textureQueryLevels(isampler2DArray)	function (high_end)	servers/rendering/shader_language.cpp:3327		int	(isampler2DArray)
textureQueryLevels(usampler2DArray)	function (high_end)	servers/rendering/shader_language.cpp:3328		int	(usampler2DArray)
textureQueryLevels(sampler3D)	function (high_end)	servers/rendering/shader_language.cpp:3329		int	(sampler3D)
textureQueryLevels(isampler3D)	function (high_end)	servers/rendering/shader_language.cpp:3330		int	(isampler3D)
textureQueryLevels(usampler3D)	function (high_end)	servers/rendering/shader_language.cpp:3331		int	(usampler3D)
textureQueryLevels(samplerCube)	function (high_end)	servers/rendering/shader_language.cpp:3332		int	(samplerCube)
dFdx(float)	function	servers/rendering/shader_language.cpp:3336		float	(float)
dFdx(vec2)	function	servers/rendering/shader_language.cpp:3337		vec2	(vec2)
dFdx(vec3)	function	servers/rendering/shader_language.cpp:3338		vec3	(vec3)
dFdx(vec4)	function	servers/rendering/shader_language.cpp:3339		vec4	(vec4)
dFdxCoarse(float)	function (high_end)	servers/rendering/shader_language.cpp:3343		float	(float)
dFdxCoarse(vec2)	function (high_end)	servers/rendering/shader_language.cpp:3344		vec2	(vec2)
dFdxCoarse(vec3)	function (high_end)	servers/rendering/shader_language.cpp:3345		vec3	(vec3)
dFdxCoarse(vec4)	function (high_end)	servers/rendering/shader_language.cpp:3346		vec4	(vec4)
dFdxFine(float)	function (high_end)	servers/rendering/shader_language.cpp:3350		float	(float)
dFdxFine(vec2)	function (high_end)	servers/rendering/shader_language.cpp:3351		vec2	(vec2)
dFdxFine(vec3)	function (high_end)	servers/rendering/shader_language.cpp:3352		vec3	(vec3)
dFdxFine(vec4)	function (high_end)	servers/rendering/shader_language.cpp:3353		vec4	(vec4)
dFdy(float)	function	servers/rendering/shader_language.cpp:3357		float	(float)
dFdy(vec2)	function	servers/rendering/shader_language.cpp:3358		vec2	(vec2)
dFdy(vec3)	function	servers/rendering/shader_language.cpp:3359		vec3	(vec3)
dFdy(vec4)	function	servers/rendering/shader_language.cpp:3360		vec4	(vec4)
dFdyCoarse(float)	function (high_end)	servers/rendering/shader_language.cpp:3364		float	(float)
dFdyCoarse(vec2)	function (high_end)	servers/rendering/shader_language.cpp:3365		vec2	(vec2)
dFdyCoarse(vec3)	function (high_end)	servers/rendering/shader_language.cpp:3366		vec3	(vec3)
dFdyCoarse(vec4)	function (high_end)	servers/rendering/shader_language.cpp:3367		vec4	(vec4)
dFdyFine(float)	function (high_end)	servers/rendering/shader_language.cpp:3371		float	(float)
dFdyFine(vec2)	function (high_end)	servers/rendering/shader_language.cpp:3372		vec2	(vec2)
dFdyFine(vec3)	function (high_end)	servers/rendering/shader_language.cpp:3373		vec3	(vec3)
dFdyFine(vec4)	function (high_end)	servers/rendering/shader_language.cpp:3374		vec4	(vec4)
fwidth(float)	function	servers/rendering/shader_language.cpp:3378		float	(float)
fwidth(vec2)	function	servers/rendering/shader_language.cpp:3379		vec2	(vec2)
fwidth(vec3)	function	servers/rendering/shader_language.cpp:3380		vec3	(vec3)
fwidth(vec4)	function	servers/rendering/shader_language.cpp:3381		vec4	(vec4)
fwidthCoarse(float)	function (high_end)	servers/rendering/shader_language.cpp:3385		float	(float)
fwidthCoarse(vec2)	function (high_end)	servers/rendering/shader_language.cpp:3386		vec2	(vec2)
fwidthCoarse(vec3)	function (high_end)	servers/rendering/shader_language.cpp:3387		vec3	(vec3)
fwidthCoarse(vec4)	function (high_end)	servers/rendering/shader_language.cpp:3388		vec4	(vec4)
fwidthFine(float)	function (high_end)	servers/rendering/shader_language.cpp:3392		float	(float)
fwidthFine(vec2)	function (high_end)	servers/rendering/shader_language.cpp:3393		vec2	(vec2)
fwidthFine(vec3)	function (high_end)	servers/rendering/shader_language.cpp:3394		vec3	(vec3)
fwidthFine(vec4)	function (high_end)	servers/rendering/shader_language.cpp:3395		vec4	(vec4)
length[array]()	function	servers/rendering/shader_language.cpp:3400		int	()
fma(float,float,float)	function (high_end)	servers/rendering/shader_language.cpp:3405		float	(float,float,float)
fma(vec2,vec2,vec2)	function (high_end)	servers/rendering/shader_language.cpp:3406		vec2	(vec2,vec2,vec2)
fma(vec3,vec3,vec3)	function (high_end)	servers/rendering/shader_language.cpp:3407		vec3	(vec3,vec3,vec3)
fma(vec4,vec4,vec4)	function (high_end)	servers/rendering/shader_language.cpp:3408		vec4	(vec4,vec4,vec4)
packHalf2x16(vec2)	function	servers/rendering/shader_language.cpp:3412		uint	(vec2)
packUnorm2x16(vec2)	function	servers/rendering/shader_language.cpp:3413		uint	(vec2)
packSnorm2x16(vec2)	function	servers/rendering/shader_language.cpp:3414		uint	(vec2)
packUnorm4x8(vec4)	function	servers/rendering/shader_language.cpp:3415		uint	(vec4)
packSnorm4x8(vec4)	function	servers/rendering/shader_language.cpp:3416		uint	(vec4)
unpackHalf2x16(uint)	function	servers/rendering/shader_language.cpp:3418		vec2	(uint)
unpackUnorm2x16(uint)	function	servers/rendering/shader_language.cpp:3419		vec2	(uint)
unpackSnorm2x16(uint)	function	servers/rendering/shader_language.cpp:3420		vec2	(uint)
unpackUnorm4x8(uint)	function	servers/rendering/shader_language.cpp:3421		vec4	(uint)
unpackSnorm4x8(uint)	function	servers/rendering/shader_language.cpp:3422		vec4	(uint)
bitfieldExtract(int,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3426		int	(int,int,int)
bitfieldExtract(ivec2,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3427		ivec2	(ivec2,int,int)
bitfieldExtract(ivec3,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3428		ivec3	(ivec3,int,int)
bitfieldExtract(ivec4,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3429		ivec4	(ivec4,int,int)
bitfieldExtract(uint,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3431		uint	(uint,int,int)
bitfieldExtract(uvec2,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3432		uvec2	(uvec2,int,int)
bitfieldExtract(uvec3,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3433		uvec3	(uvec3,int,int)
bitfieldExtract(uvec4,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3434		uvec4	(uvec4,int,int)
bitfieldInsert(int,int,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3438		int	(int,int,int,int)
bitfieldInsert(ivec2,ivec2,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3439		ivec2	(ivec2,ivec2,int,int)
bitfieldInsert(ivec3,ivec3,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3440		ivec3	(ivec3,ivec3,int,int)
bitfieldInsert(ivec4,ivec4,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3441		ivec4	(ivec4,ivec4,int,int)
bitfieldInsert(uint,uint,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3443		uint	(uint,uint,int,int)
bitfieldInsert(uvec2,uvec2,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3444		uvec2	(uvec2,uvec2,int,int)
bitfieldInsert(uvec3,uvec3,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3445		uvec3	(uvec3,uvec3,int,int)
bitfieldInsert(uvec4,uvec4,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3446		uvec4	(uvec4,uvec4,int,int)
bitfieldReverse(int)	function (high_end)	servers/rendering/shader_language.cpp:3450		int	(int)
bitfieldReverse(ivec2)	function (high_end)	servers/rendering/shader_language.cpp:3451		ivec2	(ivec2)
bitfieldReverse(ivec3)	function (high_end)	servers/rendering/shader_language.cpp:3452		ivec3	(ivec3)
bitfieldReverse(ivec4)	function (high_end)	servers/rendering/shader_language.cpp:3453		ivec4	(ivec4)
bitfieldReverse(uint)	function (high_end)	servers/rendering/shader_language.cpp:3455		uint	(uint)
bitfieldReverse(uvec2)	function (high_end)	servers/rendering/shader_language.cpp:3456		uvec2	(uvec2)
bitfieldReverse(uvec3)	function (high_end)	servers/rendering/shader_language.cpp:3457		uvec3	(uvec3)
bitfieldReverse(uvec4)	function (high_end)	servers/rendering/shader_language.cpp:3458		uvec4	(uvec4)
bitCount(int)	function (high_end)	servers/rendering/shader_language.cpp:3462		int	(int)
bitCount(ivec2)	function (high_end)	servers/rendering/shader_language.cpp:3463		ivec2	(ivec2)
bitCount(ivec3)	function (high_end)	servers/rendering/shader_language.cpp:3464		ivec3	(ivec3)
bitCount(ivec4)	function (high_end)	servers/rendering/shader_language.cpp:3465		ivec4	(ivec4)
bitCount(uint)	function (high_end)	servers/rendering/shader_language.cpp:3467		uint	(uint)
bitCount(uvec2)	function (high_end)	servers/rendering/shader_language.cpp:3468		uvec2	(uvec2)
bitCount(uvec3)	function (high_end)	servers/rendering/shader_language.cpp:3469		uvec3	(uvec3)
bitCount(uvec4)	function (high_end)	servers/rendering/shader_language.cpp:3470		uvec4	(uvec4)
findLSB(int)	function (high_end)	servers/rendering/shader_language.cpp:3474		int	(int)
findLSB(ivec2)	function (high_end)	servers/rendering/shader_language.cpp:3475		ivec2	(ivec2)
findLSB(ivec3)	function (high_end)	servers/rendering/shader_language.cpp:3476		ivec3	(ivec3)
findLSB(ivec4)	function (high_end)	servers/rendering/shader_language.cpp:3477		ivec4	(ivec4)
findLSB(uint)	function (high_end)	servers/rendering/shader_language.cpp:3479		uint	(uint)
findLSB(uvec2)	function (high_end)	servers/rendering/shader_language.cpp:3480		uvec2	(uvec2)
findLSB(uvec3)	function (high_end)	servers/rendering/shader_language.cpp:3481		uvec3	(uvec3)
findLSB(uvec4)	function (high_end)	servers/rendering/shader_language.cpp:3482		uvec4	(uvec4)
findMSB(int)	function (high_end)	servers/rendering/shader_language.cpp:3486		int	(int)
findMSB(ivec2)	function (high_end)	servers/rendering/shader_language.cpp:3487		ivec2	(ivec2)
findMSB(ivec3)	function (high_end)	servers/rendering/shader_language.cpp:3488		ivec3	(ivec3)
findMSB(ivec4)	function (high_end)	servers/rendering/shader_language.cpp:3489		ivec4	(ivec4)
findMSB(uint)	function (high_end)	servers/rendering/shader_language.cpp:3491		uint	(uint)
findMSB(uvec2)	function (high_end)	servers/rendering/shader_language.cpp:3492		uvec2	(uvec2)
findMSB(uvec3)	function (high_end)	servers/rendering/shader_language.cpp:3493		uvec3	(uvec3)
findMSB(uvec4)	function (high_end)	servers/rendering/shader_language.cpp:3494		uvec4	(uvec4)
umulExtended(uint,uint,uint,uint)	function (high_end)	servers/rendering/shader_language.cpp:3498		void	(uint,uint,uint,uint)
umulExtended(uvec2,uvec2,uvec2,uvec2)	function (high_end)	servers/rendering/shader_language.cpp:3499		void	(uvec2,uvec2,uvec2,uvec2)
umulExtended(uvec3,uvec3,uvec3,uvec3)	function (high_end)	servers/rendering/shader_language.cpp:3500		void	(uvec3,uvec3,uvec3,uvec3)
umulExtended(uvec4,uvec4,uvec4,uvec4)	function (high_end)	servers/rendering/shader_language.cpp:3501		void	(uvec4,uvec4,uvec4,uvec4)
imulExtended(int,int,int,int)	function (high_end)	servers/rendering/shader_language.cpp:3505		void	(int,int,int,int)
imulExtended(ivec2,ivec2,ivec2,ivec2)	function (high_end)	servers/rendering/shader_language.cpp:3506		void	(ivec2,ivec2,ivec2,ivec2)
imulExtended(ivec3,ivec3,ivec3,ivec3)	function (high_end)	servers/rendering/shader_language.cpp:3507		void	(ivec3,ivec3,ivec3,ivec3)
imulExtended(ivec4,ivec4,ivec4,ivec4)	function (high_end)	servers/rendering/shader_language.cpp:3508		void	(ivec4,ivec4,ivec4,ivec4)
uaddCarry(uint,uint,uint)	function (high_end)	servers/rendering/shader_language.cpp:3512		uint	(uint,uint,uint)
uaddCarry(uvec2,uvec2,uvec2)	function (high_end)	servers/rendering/shader_language.cpp:3513		uvec2	(uvec2,uvec2,uvec2)
uaddCarry(uvec3,uvec3,uvec3)	function (high_end)	servers/rendering/shader_language.cpp:3514		uvec3	(uvec3,uvec3,uvec3)
uaddCarry(uvec4,uvec4,uvec4)	function (high_end)	servers/rendering/shader_language.cpp:3515		uvec4	(uvec4,uvec4,uvec4)
usubBorrow(uint,uint,uint)	function (high_end)	servers/rendering/shader_language.cpp:3519		uint	(uint,uint,uint)
usubBorrow(uvec2,uvec2,uvec2)	function (high_end)	servers/rendering/shader_language.cpp:3520		uvec2	(uvec2,uvec2,uvec2)
usubBorrow(uvec3,uvec3,uvec3)	function (high_end)	servers/rendering/shader_language.cpp:3521		uvec3	(uvec3,uvec3,uvec3)
usubBorrow(uvec4,uvec4,uvec4)	function (high_end)	servers/rendering/shader_language.cpp:3522		uvec4	(uvec4,uvec4,uvec4)
ldexp(float,int)	function (high_end)	servers/rendering/shader_language.cpp:3526		float	(float,int)
ldexp(vec2,ivec2)	function (high_end)	servers/rendering/shader_language.cpp:3527		vec2	(vec2,ivec2)
ldexp(vec3,ivec3)	function (high_end)	servers/rendering/shader_language.cpp:3528		vec3	(vec3,ivec3)
ldexp(vec4,ivec4)	function (high_end)	servers/rendering/shader_language.cpp:3529		vec4	(vec4,ivec4)
frexp(float,int)	function (high_end)	servers/rendering/shader_language.cpp:3533		float	(float,int)
frexp(vec2,ivec2)	function (high_end)	servers/rendering/shader_language.cpp:3534		vec2	(vec2,ivec2)
frexp(vec3,ivec3)	function (high_end)	servers/rendering/shader_language.cpp:3535		vec3	(vec3,ivec3)
frexp(vec4,ivec4)	function (high_end)	servers/rendering/shader_language.cpp:3536		vec4	(vec4,ivec4)
bvec2.xy	swizzle	servers/rendering/shader_language.cpp:6877			
bvec2.rg	swizzle	servers/rendering/shader_language.cpp:6877			
bvec2.st	swizzle	servers/rendering/shader_language.cpp:6877			
ivec2.xy	swizzle	servers/rendering/shader_language.cpp:6877			
ivec2.rg	swizzle	servers/rendering/shader_language.cpp:6877			
ivec2.st	swizzle	servers/rendering/shader_language.cpp:6877			
uvec2.xy	swizzle	servers/rendering/shader_language.cpp:6877			
uvec2.rg	swizzle	servers/rendering/shader_language.cpp:6877			
uvec2.st	swizzle	servers/rendering/shader_language.cpp:6877			
vec2.xy	swizzle	servers/rendering/shader_language.cpp:6877			
vec2.rg	swizzle	servers/rendering/shader_language.cpp:6877			
vec2.st	swizzle	servers/rendering/shader_language.cpp:6877			
bvec3.xyz	swizzle	servers/rendering/shader_language.cpp:6941			
bvec3.rgb	swizzle	servers/rendering/shader_language.cpp:6941			
bvec3.stp	swizzle	servers/rendering/shader_language.cpp:6941			
ivec3.xyz	swizzle	servers/rendering/shader_language.cpp:6941			
ivec3.rgb	swizzle	servers/rendering/shader_language.cpp:6941			
ivec3.stp	swizzle	servers/rendering/shader_language.cpp:6941			
uvec3.xyz	swizzle	servers/rendering/shader_language.cpp:6941			
uvec3.rgb	swizzle	servers/rendering/shader_language.cpp:6941			
uvec3.stp	swizzle	servers/rendering/shader_language.cpp:6941			
vec3.xyz	swizzle	servers/rendering/shader_language.cpp:6941			
vec3.rgb	swizzle	servers/rendering/shader_language.cpp:6941			
vec3.stp	swizzle	servers/rendering/shader_language.cpp:6941			
bvec4.xyzw	swizzle	servers/rendering/shader_language.cpp:7008			
bvec4.rgba	swizzle	servers/rendering/shader_language.cpp:7008			
bvec4.stpq	swizzle	servers/rendering/shader_language.cpp:7008			
ivec4.xyzw	swizzle	servers/rendering/shader_language.cpp:7008			
ivec4.rgba	swizzle	servers/rendering/shader_language.cpp:7008			
ivec4.stpq	swizzle	servers/rendering/shader_language.cpp:7008			
uvec4.xyzw	swizzle	servers/rendering/shader_language.cpp:7008			
uvec4.rgba	swizzle	servers/rendering/shader_language.cpp:7008			
uvec4.stpq	swizzle	servers/rendering/shader_language.cpp:7008			
vec4.xyzw	swizzle	servers/rendering/shader_language.cpp:7008			
vec4.rgba	swizzle	servers/rendering/shader_language.cpp:7008			
vec4.stpq	swizzle	servers/rendering/shader_language.cpp:7008			
shader_type spatial	shader head	servers/rendering/shader_types.cpp:523			
shader_type canvas_item	shader head	servers/rendering/shader_types.cpp:524			
shader_type particles	shader head	servers/rendering/shader_types.cpp:525			
shader_type sky	shader head	servers/rendering/shader_types.cpp:526			
shader_type fog	shader head	servers/rendering/shader_types.cpp:527			
spatial.global.TIME	built-in (read only)	servers/rendering/shader_types.cpp:79		float	
spatial.global.EXPOSURE	built-in (read only)	servers/rendering/shader_types.cpp:80		float	
spatial.global.IN_SHADOW_PASS	built-in (read only)	servers/rendering/shader_types.cpp:81		bool	
spatial.constants.PI	built-in (read only)	servers/rendering/shader_types.cpp:82		float	
spatial.constants.TAU	built-in (read only)	servers/rendering/shader_types.cpp:83		float	
spatial.constants.E	built-in (read only)	servers/rendering/shader_types.cpp:84		float	
spatial.constants.OUTPUT_IS_SRGB	built-in (read only)	servers/rendering/shader_types.cpp:85		bool	
spatial.constants.CLIP_SPACE_FAR	built-in (read only)	servers/rendering/shader_types.cpp:86		float	
spatial.constants.IS_MULTIVIEW	built-in (read only)	servers/rendering/shader_types.cpp:87		bool	
spatial.vertex.VERTEX	built-in	servers/rendering/shader_types.cpp:89		vec3	
spatial.vertex.NORMAL	built-in	servers/rendering/shader_types.cpp:90		vec3	
spatial.vertex.TANGENT	built-in	servers/rendering/shader_types.cpp:91		vec3	
spatial.vertex.BINORMAL	built-in	servers/rendering/shader_types.cpp:92		vec3	
spatial.vertex.POSITION	built-in	servers/rendering/shader_types.cpp:93		vec4	
spatial.vertex.UV	built-in	servers/rendering/shader_types.cpp:94		vec2	
spatial.vertex.UV2	built-in	servers/rendering/shader_types.cpp:95		vec2	
spatial.vertex.COLOR	built-in	servers/rendering/shader_types.cpp:96		vec4	
spatial.vertex.POINT_SIZE	built-in	servers/rendering/shader_types.cpp:97		float	
spatial.vertex.Z_CLIP_SCALE	built-in	servers/rendering/shader_types.cpp:98		float	
spatial.vertex.INSTANCE_ID	built-in (read only)	servers/rendering/shader_types.cpp:99		int	
spatial.vertex.INSTANCE_CUSTOM	built-in (read only)	servers/rendering/shader_types.cpp:100		vec4	
spatial.vertex.VERTEX_ID	built-in (read only)	servers/rendering/shader_types.cpp:101		int	
spatial.vertex.ROUGHNESS	built-in	servers/rendering/shader_types.cpp:102		float	
spatial.vertex.BONE_INDICES	built-in (read only)	servers/rendering/shader_types.cpp:103		uvec4	
spatial.vertex.BONE_WEIGHTS	built-in (read only)	servers/rendering/shader_types.cpp:104		vec4	
spatial.vertex.CUSTOM0	built-in (read only)	servers/rendering/shader_types.cpp:105		vec4	
spatial.vertex.CUSTOM1	built-in (read only)	servers/rendering/shader_types.cpp:106		vec4	
spatial.vertex.CUSTOM2	built-in (read only)	servers/rendering/shader_types.cpp:107		vec4	
spatial.vertex.CUSTOM3	built-in (read only)	servers/rendering/shader_types.cpp:108		vec4	
spatial.vertex.MODEL_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:113		mat4	
spatial.vertex.MODEL_NORMAL_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:114		mat3	
spatial.vertex.VIEW_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:115		mat4	
spatial.vertex.INV_VIEW_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:116		mat4	
spatial.vertex.PROJECTION_MATRIX	built-in	servers/rendering/shader_types.cpp:117		mat4	
spatial.vertex.INV_PROJECTION_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:118		mat4	
spatial.vertex.MODELVIEW_MATRIX	built-in	servers/rendering/shader_types.cpp:119		mat4	
spatial.vertex.MODELVIEW_NORMAL_MATRIX	built-in	servers/rendering/shader_types.cpp:120		mat3	
spatial.vertex.VIEWPORT_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:121		vec2	
spatial.vertex.MAIN_CAM_INV_VIEW_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:122		mat4	
spatial.vertex.NODE_POSITION_WORLD	built-in (read only)	servers/rendering/shader_types.cpp:124		vec3	
spatial.vertex.CAMERA_POSITION_WORLD	built-in (read only)	servers/rendering/shader_types.cpp:125		vec3	
spatial.vertex.CAMERA_DIRECTION_WORLD	built-in (read only)	servers/rendering/shader_types.cpp:126		vec3	
spatial.vertex.CAMERA_VISIBLE_LAYERS	built-in (read only)	servers/rendering/shader_types.cpp:127		uint	
spatial.vertex.NODE_POSITION_VIEW	built-in (read only)	servers/rendering/shader_types.cpp:128		vec3	
spatial.vertex.VIEW_INDEX	built-in (read only)	servers/rendering/shader_types.cpp:130		int	
spatial.vertex.VIEW_MONO_LEFT	built-in (read only)	servers/rendering/shader_types.cpp:131		int	
spatial.vertex.VIEW_RIGHT	built-in (read only)	servers/rendering/shader_types.cpp:132		int	
spatial.vertex.EYE_OFFSET	built-in (read only)	servers/rendering/shader_types.cpp:133		vec3	
spatial.fragment.VERTEX	built-in (read only)	servers/rendering/shader_types.cpp:135		vec3	
spatial.fragment.LIGHT_VERTEX	built-in	servers/rendering/shader_types.cpp:136		vec3	
spatial.fragment.FRAGCOORD	built-in (read only)	servers/rendering/shader_types.cpp:137		vec4	
spatial.fragment.FRONT_FACING	built-in (read only)	servers/rendering/shader_types.cpp:138		bool	
spatial.fragment.NORMAL	built-in	servers/rendering/shader_types.cpp:139		vec3	
spatial.fragment.TANGENT	built-in	servers/rendering/shader_types.cpp:140		vec3	
spatial.fragment.BINORMAL	built-in	servers/rendering/shader_types.cpp:141		vec3	
spatial.fragment.VIEW	built-in (read only)	servers/rendering/shader_types.cpp:142		vec3	
spatial.fragment.NORMAL_MAP	built-in	servers/rendering/shader_types.cpp:143		vec3	
spatial.fragment.NORMAL_MAP_DEPTH	built-in	servers/rendering/shader_types.cpp:144		float	
spatial.fragment.BENT_NORMAL_MAP	built-in	servers/rendering/shader_types.cpp:145		vec3	
spatial.fragment.UV	built-in (read only)	servers/rendering/shader_types.cpp:146		vec2	
spatial.fragment.UV2	built-in (read only)	servers/rendering/shader_types.cpp:147		vec2	
spatial.fragment.COLOR	built-in (read only)	servers/rendering/shader_types.cpp:148		vec4	
spatial.fragment.ALBEDO	built-in	servers/rendering/shader_types.cpp:149		vec3	
spatial.fragment.PREMUL_ALPHA_FACTOR	built-in	servers/rendering/shader_types.cpp:150		float	
spatial.fragment.ALPHA	built-in	servers/rendering/shader_types.cpp:151		float	
spatial.fragment.METALLIC	built-in	servers/rendering/shader_types.cpp:152		float	
spatial.fragment.SPECULAR	built-in	servers/rendering/shader_types.cpp:153		float	
spatial.fragment.ROUGHNESS	built-in	servers/rendering/shader_types.cpp:154		float	
spatial.fragment.RIM	built-in	servers/rendering/shader_types.cpp:155		float	
spatial.fragment.RIM_TINT	built-in	servers/rendering/shader_types.cpp:156		float	
spatial.fragment.CLEARCOAT	built-in	servers/rendering/shader_types.cpp:157		float	
spatial.fragment.CLEARCOAT_ROUGHNESS	built-in	servers/rendering/shader_types.cpp:158		float	
spatial.fragment.ANISOTROPY	built-in	servers/rendering/shader_types.cpp:159		float	
spatial.fragment.ANISOTROPY_FLOW	built-in	servers/rendering/shader_types.cpp:160		vec2	
spatial.fragment.SSS_STRENGTH	built-in	servers/rendering/shader_types.cpp:161		float	
spatial.fragment.SSS_TRANSMITTANCE_COLOR	built-in	servers/rendering/shader_types.cpp:162		vec4	
spatial.fragment.SSS_TRANSMITTANCE_DEPTH	built-in	servers/rendering/shader_types.cpp:163		float	
spatial.fragment.SSS_TRANSMITTANCE_BOOST	built-in	servers/rendering/shader_types.cpp:164		float	
spatial.fragment.BACKLIGHT	built-in	servers/rendering/shader_types.cpp:165		vec3	
spatial.fragment.AO	built-in	servers/rendering/shader_types.cpp:166		float	
spatial.fragment.AO_LIGHT_AFFECT	built-in	servers/rendering/shader_types.cpp:167		float	
spatial.fragment.EMISSION	built-in	servers/rendering/shader_types.cpp:168		vec3	
spatial.fragment.DEPTH	built-in	servers/rendering/shader_types.cpp:169		float	
spatial.fragment.SCREEN_UV	built-in (read only)	servers/rendering/shader_types.cpp:170		vec2	
spatial.fragment.POINT_COORD	built-in (read only)	servers/rendering/shader_types.cpp:171		vec2	
spatial.fragment.NODE_POSITION_WORLD	built-in (read only)	servers/rendering/shader_types.cpp:173		vec3	
spatial.fragment.CAMERA_POSITION_WORLD	built-in (read only)	servers/rendering/shader_types.cpp:174		vec3	
spatial.fragment.CAMERA_DIRECTION_WORLD	built-in (read only)	servers/rendering/shader_types.cpp:175		vec3	
spatial.fragment.CAMERA_VISIBLE_LAYERS	built-in (read only)	servers/rendering/shader_types.cpp:176		uint	
spatial.fragment.NODE_POSITION_VIEW	built-in (read only)	servers/rendering/shader_types.cpp:177		vec3	
spatial.fragment.VIEW_INDEX	built-in (read only)	servers/rendering/shader_types.cpp:179		int	
spatial.fragment.VIEW_MONO_LEFT	built-in (read only)	servers/rendering/shader_types.cpp:180		int	
spatial.fragment.VIEW_RIGHT	built-in (read only)	servers/rendering/shader_types.cpp:181		int	
spatial.fragment.EYE_OFFSET	built-in (read only)	servers/rendering/shader_types.cpp:182		vec3	
spatial.fragment.MODEL_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:184		mat4	
spatial.fragment.MODEL_NORMAL_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:185		mat3	
spatial.fragment.VIEW_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:186		mat4	
spatial.fragment.INV_VIEW_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:187		mat4	
spatial.fragment.PROJECTION_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:188		mat4	
spatial.fragment.INV_PROJECTION_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:189		mat4	
spatial.fragment.VIEWPORT_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:190		vec2	
spatial.fragment.FOG	built-in	servers/rendering/shader_types.cpp:191		vec4	
spatial.fragment.RADIANCE	built-in	servers/rendering/shader_types.cpp:192		vec4	
spatial.fragment.IRRADIANCE	built-in	servers/rendering/shader_types.cpp:193		vec4	
spatial.fragment.ALPHA_SCISSOR_THRESHOLD	built-in	servers/rendering/shader_types.cpp:197		float	
spatial.fragment.ALPHA_HASH_SCALE	built-in	servers/rendering/shader_types.cpp:198		float	
spatial.fragment.ALPHA_ANTIALIASING_EDGE	built-in	servers/rendering/shader_types.cpp:199		float	
spatial.fragment.ALPHA_TEXTURE_COORDINATE	built-in	servers/rendering/shader_types.cpp:200		vec2	
spatial.light.MODEL_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:202		mat4	
spatial.light.VIEW_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:203		mat4	
spatial.light.INV_VIEW_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:204		mat4	
spatial.light.PROJECTION_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:205		mat4	
spatial.light.INV_PROJECTION_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:206		mat4	
spatial.light.VIEWPORT_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:207		vec2	
spatial.light.FRAGCOORD	built-in (read only)	servers/rendering/shader_types.cpp:209		vec4	
spatial.light.NORMAL	built-in (read only)	servers/rendering/shader_types.cpp:210		vec3	
spatial.light.UV	built-in (read only)	servers/rendering/shader_types.cpp:211		vec2	
spatial.light.UV2	built-in (read only)	servers/rendering/shader_types.cpp:212		vec2	
spatial.light.VIEW	built-in (read only)	servers/rendering/shader_types.cpp:213		vec3	
spatial.light.SPECULAR_AMOUNT	built-in (read only)	servers/rendering/shader_types.cpp:214		float	
spatial.light.LIGHT	built-in (read only)	servers/rendering/shader_types.cpp:215		vec3	
spatial.light.LIGHT_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:216		vec3	
spatial.light.LIGHT_IS_DIRECTIONAL	built-in (read only)	servers/rendering/shader_types.cpp:217		bool	
spatial.light.ATTENUATION	built-in (read only)	servers/rendering/shader_types.cpp:218		float	
spatial.light.ALBEDO	built-in (read only)	servers/rendering/shader_types.cpp:219		vec3	
spatial.light.BACKLIGHT	built-in (read only)	servers/rendering/shader_types.cpp:220		vec3	
spatial.light.METALLIC	built-in (read only)	servers/rendering/shader_types.cpp:221		float	
spatial.light.ROUGHNESS	built-in (read only)	servers/rendering/shader_types.cpp:222		float	
spatial.light.DIFFUSE_LIGHT	built-in	servers/rendering/shader_types.cpp:223		vec3	
spatial.light.SPECULAR_LIGHT	built-in	servers/rendering/shader_types.cpp:224		vec3	
spatial.light.ALPHA	built-in	servers/rendering/shader_types.cpp:225		float	
spatial.light.SCREEN_UV	built-in (read only)	servers/rendering/shader_types.cpp:226		vec2	
canvas_item.global.TIME	built-in (read only)	servers/rendering/shader_types.cpp:264		float	
canvas_item.constants.PI	built-in (read only)	servers/rendering/shader_types.cpp:265		float	
canvas_item.constants.TAU	built-in (read only)	servers/rendering/shader_types.cpp:266		float	
canvas_item.constants.E	built-in (read only)	servers/rendering/shader_types.cpp:267		float	
canvas_item.vertex.VERTEX	built-in	servers/rendering/shader_types.cpp:269		vec2	
canvas_item.vertex.UV	built-in	servers/rendering/shader_types.cpp:270		vec2	
canvas_item.vertex.COLOR	built-in	servers/rendering/shader_types.cpp:271		vec4	
canvas_item.vertex.POINT_SIZE	built-in	servers/rendering/shader_types.cpp:272		float	
canvas_item.vertex.MODEL_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:274		mat4	
canvas_item.vertex.CANVAS_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:275		mat4	
canvas_item.vertex.SCREEN_MATRIX	built-in (read only)	servers/rendering/shader_types.cpp:276		mat4	
canvas_item.vertex.INSTANCE_CUSTOM	built-in (read only)	servers/rendering/shader_types.cpp:277		vec4	
canvas_item.vertex.INSTANCE_ID	built-in (read only)	servers/rendering/shader_types.cpp:278		int	
canvas_item.vertex.VERTEX_ID	built-in (read only)	servers/rendering/shader_types.cpp:279		int	
canvas_item.vertex.AT_LIGHT_PASS	built-in (read only)	servers/rendering/shader_types.cpp:280		bool	
canvas_item.vertex.TEXTURE_PIXEL_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:281		vec2	
canvas_item.vertex.CUSTOM0	built-in (read only)	servers/rendering/shader_types.cpp:282		vec4	
canvas_item.vertex.CUSTOM1	built-in (read only)	servers/rendering/shader_types.cpp:283		vec4	
canvas_item.fragment.VERTEX	built-in	servers/rendering/shader_types.cpp:287		vec2	
canvas_item.fragment.SHADOW_VERTEX	built-in	servers/rendering/shader_types.cpp:288		vec2	
canvas_item.fragment.LIGHT_VERTEX	built-in	servers/rendering/shader_types.cpp:289		vec3	
canvas_item.fragment.FRAGCOORD	built-in (read only)	servers/rendering/shader_types.cpp:290		vec4	
canvas_item.fragment.NORMAL	built-in	servers/rendering/shader_types.cpp:291		vec3	
canvas_item.fragment.NORMAL_MAP	built-in	servers/rendering/shader_types.cpp:292		vec3	
canvas_item.fragment.NORMAL_MAP_DEPTH	built-in	servers/rendering/shader_types.cpp:293		float	
canvas_item.fragment.UV	built-in (read only)	servers/rendering/shader_types.cpp:294		vec2	
canvas_item.fragment.COLOR	built-in	servers/rendering/shader_types.cpp:295		vec4	
canvas_item.fragment.TEXTURE	built-in (read only)	servers/rendering/shader_types.cpp:296		sampler2D	
canvas_item.fragment.TEXTURE_PIXEL_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:297		vec2	
canvas_item.fragment.NORMAL_TEXTURE	built-in (read only)	servers/rendering/shader_types.cpp:298		sampler2D	
canvas_item.fragment.SPECULAR_SHININESS_TEXTURE	built-in (read only)	servers/rendering/shader_types.cpp:299		sampler2D	
canvas_item.fragment.SPECULAR_SHININESS	built-in (read only)	servers/rendering/shader_types.cpp:300		vec4	
canvas_item.fragment.SCREEN_UV	built-in (read only)	servers/rendering/shader_types.cpp:301		vec2	
canvas_item.fragment.REGION_RECT	built-in (read only)	servers/rendering/shader_types.cpp:302		vec4	
canvas_item.fragment.SCREEN_PIXEL_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:303		vec2	
canvas_item.fragment.POINT_COORD	built-in (read only)	servers/rendering/shader_types.cpp:304		vec2	
canvas_item.fragment.AT_LIGHT_PASS	built-in (read only)	servers/rendering/shader_types.cpp:305		bool	
canvas_item.light.FRAGCOORD	built-in (read only)	servers/rendering/shader_types.cpp:332		vec4	
canvas_item.light.NORMAL	built-in (read only)	servers/rendering/shader_types.cpp:333		vec3	
canvas_item.light.COLOR	built-in (read only)	servers/rendering/shader_types.cpp:334		vec4	
canvas_item.light.UV	built-in (read only)	servers/rendering/shader_types.cpp:335		vec2	
canvas_item.light.SPECULAR_SHININESS	built-in (read only)	servers/rendering/shader_types.cpp:336		vec4	
canvas_item.light.LIGHT_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:337		vec4	
canvas_item.light.LIGHT_POSITION	built-in (read only)	servers/rendering/shader_types.cpp:338		vec3	
canvas_item.light.LIGHT_DIRECTION	built-in (read only)	servers/rendering/shader_types.cpp:339		vec3	
canvas_item.light.LIGHT_ENERGY	built-in (read only)	servers/rendering/shader_types.cpp:340		float	
canvas_item.light.LIGHT_IS_DIRECTIONAL	built-in (read only)	servers/rendering/shader_types.cpp:341		bool	
canvas_item.light.LIGHT_VERTEX	built-in (read only)	servers/rendering/shader_types.cpp:342		vec3	
canvas_item.light.LIGHT	built-in	servers/rendering/shader_types.cpp:343		vec4	
canvas_item.light.SHADOW_MODULATE	built-in	servers/rendering/shader_types.cpp:344		vec4	
canvas_item.light.SCREEN_UV	built-in (read only)	servers/rendering/shader_types.cpp:345		vec2	
canvas_item.light.TEXTURE	built-in (read only)	servers/rendering/shader_types.cpp:346		sampler2D	
canvas_item.light.TEXTURE_PIXEL_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:347		vec2	
canvas_item.light.POINT_COORD	built-in (read only)	servers/rendering/shader_types.cpp:348		vec2	
particles.global.TIME	built-in (read only)	servers/rendering/shader_types.cpp:363		float	
particles.constants.PI	built-in (read only)	servers/rendering/shader_types.cpp:364		float	
particles.constants.TAU	built-in (read only)	servers/rendering/shader_types.cpp:365		float	
particles.constants.E	built-in (read only)	servers/rendering/shader_types.cpp:366		float	
particles.start.COLOR	built-in	servers/rendering/shader_types.cpp:368		vec4	
particles.start.VELOCITY	built-in	servers/rendering/shader_types.cpp:369		vec3	
particles.start.MASS	built-in	servers/rendering/shader_types.cpp:370		float	
particles.start.ACTIVE	built-in	servers/rendering/shader_types.cpp:371		bool	
particles.start.CUSTOM	built-in	servers/rendering/shader_types.cpp:372		vec4	
particles.start.USERDATA1	built-in	servers/rendering/shader_types.cpp:373		vec4	
particles.start.USERDATA2	built-in	servers/rendering/shader_types.cpp:374		vec4	
particles.start.USERDATA3	built-in	servers/rendering/shader_types.cpp:375		vec4	
particles.start.USERDATA4	built-in	servers/rendering/shader_types.cpp:376		vec4	
particles.start.USERDATA5	built-in	servers/rendering/shader_types.cpp:377		vec4	
particles.start.USERDATA6	built-in	servers/rendering/shader_types.cpp:378		vec4	
particles.start.TRANSFORM	built-in	servers/rendering/shader_types.cpp:379		mat4	
particles.start.LIFETIME	built-in (read only)	servers/rendering/shader_types.cpp:380		float	
particles.start.DELTA	built-in (read only)	servers/rendering/shader_types.cpp:381		float	
particles.start.NUMBER	built-in (read only)	servers/rendering/shader_types.cpp:382		uint	
particles.start.INDEX	built-in (read only)	servers/rendering/shader_types.cpp:383		uint	
particles.start.EMISSION_TRANSFORM	built-in (read only)	servers/rendering/shader_types.cpp:384		mat4	
particles.start.EMITTER_VELOCITY	built-in (read only)	servers/rendering/shader_types.cpp:385		vec3	
particles.start.INTERPOLATE_TO_END	built-in (read only)	servers/rendering/shader_types.cpp:386		float	
particles.start.RANDOM_SEED	built-in (read only)	servers/rendering/shader_types.cpp:387		uint	
particles.start.FLAG_EMIT_POSITION	built-in (read only)	servers/rendering/shader_types.cpp:388		uint	
particles.start.FLAG_EMIT_ROT_SCALE	built-in (read only)	servers/rendering/shader_types.cpp:389		uint	
particles.start.FLAG_EMIT_VELOCITY	built-in (read only)	servers/rendering/shader_types.cpp:390		uint	
particles.start.FLAG_EMIT_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:391		uint	
particles.start.FLAG_EMIT_CUSTOM	built-in (read only)	servers/rendering/shader_types.cpp:392		uint	
particles.start.RESTART_POSITION	built-in (read only)	servers/rendering/shader_types.cpp:393		bool	
particles.start.RESTART_ROT_SCALE	built-in (read only)	servers/rendering/shader_types.cpp:394		bool	
particles.start.RESTART_VELOCITY	built-in (read only)	servers/rendering/shader_types.cpp:395		bool	
particles.start.RESTART_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:396		bool	
particles.start.RESTART_CUSTOM	built-in (read only)	servers/rendering/shader_types.cpp:397		bool	
particles.start.AMOUNT_RATIO	built-in (read only)	servers/rendering/shader_types.cpp:398		float	
particles.process.COLOR	built-in	servers/rendering/shader_types.cpp:401		vec4	
particles.process.VELOCITY	built-in	servers/rendering/shader_types.cpp:402		vec3	
particles.process.MASS	built-in	servers/rendering/shader_types.cpp:403		float	
particles.process.ACTIVE	built-in	servers/rendering/shader_types.cpp:404		bool	
particles.process.RESTART	built-in (read only)	servers/rendering/shader_types.cpp:405		bool	
particles.process.CUSTOM	built-in	servers/rendering/shader_types.cpp:406		vec4	
particles.process.USERDATA1	built-in	servers/rendering/shader_types.cpp:407		vec4	
particles.process.USERDATA2	built-in	servers/rendering/shader_types.cpp:408		vec4	
particles.process.USERDATA3	built-in	servers/rendering/shader_types.cpp:409		vec4	
particles.process.USERDATA4	built-in	servers/rendering/shader_types.cpp:410		vec4	
particles.process.USERDATA5	built-in	servers/rendering/shader_types.cpp:411		vec4	
particles.process.USERDATA6	built-in	servers/rendering/shader_types.cpp:412		vec4	
particles.process.TRANSFORM	built-in	servers/rendering/shader_types.cpp:413		mat4	
particles.process.LIFETIME	built-in (read only)	servers/rendering/shader_types.cpp:414		float	
particles.process.DELTA	built-in (read only)	servers/rendering/shader_types.cpp:415		float	
particles.process.NUMBER	built-in (read only)	servers/rendering/shader_types.cpp:416		uint	
particles.process.INDEX	built-in (read only)	servers/rendering/shader_types.cpp:417		uint	
particles.process.EMISSION_TRANSFORM	built-in (read only)	servers/rendering/shader_types.cpp:418		mat4	
particles.process.EMITTER_VELOCITY	built-in (read only)	servers/rendering/shader_types.cpp:419		vec3	
particles.process.INTERPOLATE_TO_END	built-in (read only)	servers/rendering/shader_types.cpp:420		float	
particles.process.RANDOM_SEED	built-in (read only)	servers/rendering/shader_types.cpp:421		uint	
particles.process.FLAG_EMIT_POSITION	built-in (read only)	servers/rendering/shader_types.cpp:422		uint	
particles.process.FLAG_EMIT_ROT_SCALE	built-in (read only)	servers/rendering/shader_types.cpp:423		uint	
particles.process.FLAG_EMIT_VELOCITY	built-in (read only)	servers/rendering/shader_types.cpp:424		uint	
particles.process.FLAG_EMIT_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:425		uint	
particles.process.FLAG_EMIT_CUSTOM	built-in (read only)	servers/rendering/shader_types.cpp:426		uint	
particles.process.COLLIDED	built-in (read only)	servers/rendering/shader_types.cpp:427		bool	
particles.process.COLLISION_NORMAL	built-in (read only)	servers/rendering/shader_types.cpp:428		vec3	
particles.process.COLLISION_DEPTH	built-in (read only)	servers/rendering/shader_types.cpp:429		float	
particles.process.ATTRACTOR_FORCE	built-in (read only)	servers/rendering/shader_types.cpp:430		vec3	
particles.process.AMOUNT_RATIO	built-in (read only)	servers/rendering/shader_types.cpp:431		float	
sky.global.TIME	built-in (read only)	servers/rendering/shader_types.cpp:456		float	
sky.constants.PI	built-in (read only)	servers/rendering/shader_types.cpp:457		float	
sky.constants.TAU	built-in (read only)	servers/rendering/shader_types.cpp:458		float	
sky.constants.E	built-in (read only)	servers/rendering/shader_types.cpp:459		float	
sky.global.POSITION	built-in (read only)	servers/rendering/shader_types.cpp:460		vec3	
sky.global.RADIANCE	built-in (read only)	servers/rendering/shader_types.cpp:461		samplerCube	
sky.global.AT_HALF_RES_PASS	built-in (read only)	servers/rendering/shader_types.cpp:462		bool	
sky.global.AT_QUARTER_RES_PASS	built-in (read only)	servers/rendering/shader_types.cpp:463		bool	
sky.global.AT_CUBEMAP_PASS	built-in (read only)	servers/rendering/shader_types.cpp:464		bool	
sky.global.LIGHT0_ENABLED	built-in (read only)	servers/rendering/shader_types.cpp:465		bool	
sky.global.LIGHT0_DIRECTION	built-in (read only)	servers/rendering/shader_types.cpp:466		vec3	
sky.global.LIGHT0_ENERGY	built-in (read only)	servers/rendering/shader_types.cpp:467		float	
sky.global.LIGHT0_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:468		vec3	
sky.global.LIGHT0_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:469		float	
sky.global.LIGHT1_ENABLED	built-in (read only)	servers/rendering/shader_types.cpp:470		bool	
sky.global.LIGHT1_DIRECTION	built-in (read only)	servers/rendering/shader_types.cpp:471		vec3	
sky.global.LIGHT1_ENERGY	built-in (read only)	servers/rendering/shader_types.cpp:472		float	
sky.global.LIGHT1_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:473		vec3	
sky.global.LIGHT1_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:474		float	
sky.global.LIGHT2_ENABLED	built-in (read only)	servers/rendering/shader_types.cpp:475		bool	
sky.global.LIGHT2_DIRECTION	built-in (read only)	servers/rendering/shader_types.cpp:476		vec3	
sky.global.LIGHT2_ENERGY	built-in (read only)	servers/rendering/shader_types.cpp:477		float	
sky.global.LIGHT2_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:478		vec3	
sky.global.LIGHT2_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:479		float	
sky.global.LIGHT3_ENABLED	built-in (read only)	servers/rendering/shader_types.cpp:480		bool	
sky.global.LIGHT3_DIRECTION	built-in (read only)	servers/rendering/shader_types.cpp:481		vec3	
sky.global.LIGHT3_ENERGY	built-in (read only)	servers/rendering/shader_types.cpp:482		float	
sky.global.LIGHT3_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:483		vec3	
sky.global.LIGHT3_SIZE	built-in (read only)	servers/rendering/shader_types.cpp:484		float	
sky.sky.COLOR	built-in	servers/rendering/shader_types.cpp:486		vec3	
sky.sky.ALPHA	built-in	servers/rendering/shader_types.cpp:487		float	
sky.sky.EYEDIR	built-in (read only)	servers/rendering/shader_types.cpp:488		vec3	
sky.sky.SCREEN_UV	built-in (read only)	servers/rendering/shader_types.cpp:489		vec2	
sky.sky.FRAGCOORD	built-in (read only)	servers/rendering/shader_types.cpp:490		vec4	
sky.sky.SKY_COORDS	built-in (read only)	servers/rendering/shader_types.cpp:491		vec2	
sky.sky.HALF_RES_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:492		vec4	
sky.sky.QUARTER_RES_COLOR	built-in (read only)	servers/rendering/shader_types.cpp:493		vec4	
sky.sky.FOG	built-in	servers/rendering/shader_types.cpp:494		vec4	
fog.global.TIME	built-in (read only)	servers/rendering/shader_types.cpp:507		float	
fog.constants.PI	built-in (read only)	servers/rendering/shader_types.cpp:508		float	
fog.constants.TAU	built-in (read only)	servers/rendering/shader_types.cpp:509		float	
fog.constants.E	built-in (read only)	servers/rendering/shader_types.cpp:510		float	
fog.fog.WORLD_POSITION	built-in (read only)	servers/rendering/shader_types.cpp:512		vec3	
fog.fog.OBJECT_POSITION	built-in (read only)	servers/rendering/shader_types.cpp:513		vec3	
fog.fog.UVW	built-in (read only)	servers/rendering/shader_types.cpp:514		vec3	
fog.fog.SIZE	built-in (read only)	servers/rendering/shader_types.cpp:515		vec3	
fog.fog.SDF	built-in (read only)	servers/rendering/shader_types.cpp:516		float	
fog.fog.ALBEDO	built-in	servers/rendering/shader_types.cpp:517		vec3	
fog.fog.DENSITY	built-in	servers/rendering/shader_types.cpp:518		float	
fog.fog.EMISSION	built-in	servers/rendering/shader_types.cpp:519		vec3	
canvas_item.fragment.texture_sdf(vec2)	stage function	servers/rendering/shader_types.cpp:314		float	(vec2)
canvas_item.light.texture_sdf(vec2)	stage function	servers/rendering/shader_types.cpp:315		float	(vec2)
canvas_item.fragment.sdf_to_screen_uv(vec2)	stage function	servers/rendering/shader_types.cpp:317		vec2	(vec2)
canvas_item.light.sdf_to_screen_uv(vec2)	stage function	servers/rendering/shader_types.cpp:318		vec2	(vec2)
canvas_item.fragment.texture_sdf_normal(vec2)	stage function	servers/rendering/shader_types.cpp:319		vec2	(vec2)
canvas_item.light.texture_sdf_normal(vec2)	stage function	servers/rendering/shader_types.cpp:320		vec2	(vec2)
canvas_item.fragment.screen_uv_to_sdf(vec2)	stage function	servers/rendering/shader_types.cpp:328		vec2	(vec2)
canvas_item.light.screen_uv_to_sdf(vec2)	stage function	servers/rendering/shader_types.cpp:329		vec2	(vec2)
particles.start.emit_subparticle(mat4,vec3,vec4,vec4,uint)	stage function	servers/rendering/shader_types.cpp:442		bool	(mat4,vec3,vec4,vec4,uint)
particles.process.emit_subparticle(mat4,vec3,vec4,vec4,uint)	stage function	servers/rendering/shader_types.cpp:443		bool	(mat4,vec3,vec4,vec4,uint)
spatial render_mode blend_mix	render mode	servers/rendering/shader_types.cpp:233			
spatial render_mode blend_add	render mode	servers/rendering/shader_types.cpp:233			
spatial render_mode blend_sub	render mode	servers/rendering/shader_types.cpp:233			
spatial render_mode blend_mul	render mode	servers/rendering/shader_types.cpp:233			
spatial render_mode blend_premul_alpha	render mode	servers/rendering/shader_types.cpp:233			
spatial render_mode depth_draw_opaque	render mode	servers/rendering/shader_types.cpp:234			
spatial render_mode depth_draw_always	render mode	servers/rendering/shader_types.cpp:234			
spatial render_mode depth_draw_never	render mode	servers/rendering/shader_types.cpp:234			
spatial render_mode depth_prepass_alpha	render mode	servers/rendering/shader_types.cpp:235			
spatial render_mode depth_test_default	render mode	servers/rendering/shader_types.cpp:236			
spatial render_mode depth_test_disabled	render mode	servers/rendering/shader_types.cpp:236			
spatial render_mode depth_test_inverted	render mode	servers/rendering/shader_types.cpp:236			
spatial render_mode sss_mode_skin	render mode	servers/rendering/shader_types.cpp:237			
spatial render_mode cull_back	render mode	servers/rendering/shader_types.cpp:238			
spatial render_mode cull_front	render mode	servers/rendering/shader_types.cpp:238			
spatial render_mode cull_disabled	render mode	servers/rendering/shader_types.cpp:238			
spatial render_mode unshaded	render mode	servers/rendering/shader_types.cpp:239			
spatial render_mode wireframe	render mode	servers/rendering/shader_types.cpp:240			
spatial render_mode diffuse_lambert	render mode	servers/rendering/shader_types.cpp:241			
spatial render_mode diffuse_lambert_wrap	render mode	servers/rendering/shader_types.cpp:241			
spatial render_mode diffuse_burley	render mode	servers/rendering/shader_types.cpp:241			
spatial render_mode diffuse_toon	render mode	servers/rendering/shader_types.cpp:241			
spatial render_mode specular_schlick_ggx	render mode	servers/rendering/shader_types.cpp:242			
spatial render_mode specular_toon	render mode	servers/rendering/shader_types.cpp:242			
spatial render_mode specular_disabled	render mode	servers/rendering/shader_types.cpp:242			
spatial render_mode skip_vertex_transform	render mode	servers/rendering/shader_types.cpp:243			
spatial render_mode world_vertex_coords	render mode	servers/rendering/shader_types.cpp:244			
spatial render_mode ensure_correct_normals	render mode	servers/rendering/shader_types.cpp:245			
spatial render_mode shadows_disabled	render mode	servers/rendering/shader_types.cpp:246			
spatial render_mode ambient_light_disabled	render mode	servers/rendering/shader_types.cpp:247			
spatial render_mode shadow_to_opacity	render mode	servers/rendering/shader_types.cpp:248			
spatial render_mode vertex_lighting	render mode	servers/rendering/shader_types.cpp:249			
spatial render_mode particle_trails	render mode	servers/rendering/shader_types.cpp:250			
spatial render_mode alpha_to_coverage	render mode	servers/rendering/shader_types.cpp:251			
spatial render_mode alpha_to_coverage_and_one	render mode	servers/rendering/shader_types.cpp:252			
spatial render_mode debug_shadow_splits	render mode	servers/rendering/shader_types.cpp:253			
spatial render_mode fog_disabled	render mode	servers/rendering/shader_types.cpp:254			
spatial render_mode specular_occlusion_disabled	render mode	servers/rendering/shader_types.cpp:255			
spatial stencil_mode read	stencil mode	servers/rendering/shader_types.cpp:256			
spatial stencil_mode write	stencil mode	servers/rendering/shader_types.cpp:257			
spatial stencil_mode write_depth_fail	stencil mode	servers/rendering/shader_types.cpp:258			
spatial stencil_mode compare_always	stencil mode	servers/rendering/shader_types.cpp:259			
spatial stencil_mode compare_less	stencil mode	servers/rendering/shader_types.cpp:259			
spatial stencil_mode compare_equal	stencil mode	servers/rendering/shader_types.cpp:259			
spatial stencil_mode compare_less_or_equal	stencil mode	servers/rendering/shader_types.cpp:259			
spatial stencil_mode compare_greater	stencil mode	servers/rendering/shader_types.cpp:259			
spatial stencil_mode compare_not_equal	stencil mode	servers/rendering/shader_types.cpp:259			
spatial stencil_mode compare_greater_or_equal	stencil mode	servers/rendering/shader_types.cpp:259			
canvas_item render_mode skip_vertex_transform	render mode	servers/rendering/shader_types.cpp:354			
canvas_item render_mode blend_mix	render mode	servers/rendering/shader_types.cpp:355			
canvas_item render_mode blend_add	render mode	servers/rendering/shader_types.cpp:355			
canvas_item render_mode blend_sub	render mode	servers/rendering/shader_types.cpp:355			
canvas_item render_mode blend_mul	render mode	servers/rendering/shader_types.cpp:355			
canvas_item render_mode blend_premul_alpha	render mode	servers/rendering/shader_types.cpp:355			
canvas_item render_mode blend_disabled	render mode	servers/rendering/shader_types.cpp:355			
canvas_item render_mode unshaded	render mode	servers/rendering/shader_types.cpp:356			
canvas_item render_mode light_only	render mode	servers/rendering/shader_types.cpp:357			
canvas_item render_mode world_vertex_coords	render mode	servers/rendering/shader_types.cpp:358			
particles render_mode collision_use_scale	render mode	servers/rendering/shader_types.cpp:448			
particles render_mode disable_force	render mode	servers/rendering/shader_types.cpp:449			
particles render_mode disable_velocity	render mode	servers/rendering/shader_types.cpp:450			
particles render_mode keep_data	render mode	servers/rendering/shader_types.cpp:451			
sky render_mode use_half_res_pass	render mode	servers/rendering/shader_types.cpp:499			
sky render_mode use_quarter_res_pass	render mode	servers/rendering/shader_types.cpp:500			
sky render_mode disable_fog	render mode	servers/rendering/shader_types.cpp:501			
sky render_mode use_debanding	render mode	servers/rendering/shader_types.cpp:502			
#if	preprocessor	servers/rendering/shader_preprocessor.cpp:384			
#ifdef	preprocessor	servers/rendering/shader_preprocessor.cpp:386			
#ifndef	preprocessor	servers/rendering/shader_preprocessor.cpp:388			
#elif	preprocessor	servers/rendering/shader_preprocessor.cpp:390			
#else	preprocessor	servers/rendering/shader_preprocessor.cpp:392			
#endif	preprocessor	servers/rendering/shader_preprocessor.cpp:394			
#error	preprocessor	servers/rendering/shader_preprocessor.cpp:396			
#define	preprocessor	servers/rendering/shader_preprocessor.cpp:398			
#undef	preprocessor	servers/rendering/shader_preprocessor.cpp:400			
#include	preprocessor	servers/rendering/shader_preprocessor.cpp:402			
#pragma	preprocessor	servers/rendering/shader_preprocessor.cpp:404			
defined	preprocessor	servers/rendering/shader_preprocessor.cpp:910			
#pragma disable_preprocessor	preprocessor	servers/rendering/shader_preprocessor.cpp:803			
`;

function readRow(line: string): InstructionRow {
  const [id = '', family = '', source = '', token, returns, args] = line.split('\t');
  return {
    id,
    family,
    source,
    ...(token ? { token } : {}),
    ...(returns ? { returns } : {}),
    ...(args ? { args: args === '()' ? [] : args.slice(1, -1).split(',') } : {}),
  };
}

export const INSTRUCTION_TABLE: readonly InstructionRow[] = ROWS.trim().split('\n').map(readRow);
