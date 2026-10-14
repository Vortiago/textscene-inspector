/**
 * Godot 4.7.2's fetch of an AreaLight3D's `area_texture` from the area light atlas
 * (`area_lights_inc.glsl:13-23,96-134`), in GLSL for the area light's integral. It reads
 * `godotEdgeVector`, which `ltcIntegral.ts` declares before it, and the atlas `areaLightAtlas.ts`
 * builds.
 */

/*
 * The fetch is derived from Godot Engine (`servers/rendering/renderer_rd/shaders/
 * area_lights_inc.glsl`), used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 * See THIRD-PARTY-NOTICES.md for the full notice.
 */

/** The uniform every lit program samples the atlas through. */
export const AREA_LIGHT_ATLAS_UNIFORM = 'godotAreaLightAtlas';

/**
 * A texture rectangle of zero marks a light without a texture, which reads white. The atlas
 * premultiplies nothing, so the fetch weighs the colour by its alpha.
 */
export const AREA_TEXTURE_FETCH = /* glsl */ `
uniform sampler2D ${AREA_LIGHT_ATLAS_UNIFORM};

// The mip for a fragment whose distance to the light's plane is this many times the light's size.
float godotAreaTextureLod( float distanceOverSize ) {
	return log( 2048.0 * distanceOverSize ) / log( 3.0 );
}

// Two whole mips around lod, blended, at uv within the texture's rectangle of the atlas.
vec3 godotAreaTextureAt( const in vec2 uv, const in vec4 textureRect, const in float lod, const in float maxMipmap ) {
	float low = min( max( floor( lod ), 0.0 ), maxMipmap - 1.0 );
	float high = min( max( floor( lod + 1.0 ), 1.0 ), maxMipmap );
	vec2 atlasUv = textureRect.xy + clamp( uv, 0.0, 1.0 ) * textureRect.zw;
	vec4 lowColor = textureLod( ${AREA_LIGHT_ATLAS_UNIFORM}, atlasUv, low );
	vec4 highColor = textureLod( ${AREA_LIGHT_ATLAS_UNIFORM}, atlasUv, high );
	float blend = high - clamp( lod, high - 1.0, high );
	vec4 color = mix( highColor, lowColor, blend );
	return color.rgb * color.a;
}

// The texture where the light's integral looks at it: the point the form factor points to, at
// the mip the corners' distance asks for. L holds the corners under the integral's transform.
vec3 godotAreaTextureColor( const in vec4 textureRect, const in float maxMipmap, const in vec3 L[ 4 ] ) {
	vec3 corner0 = normalize( L[ 0 ] );
	vec3 corner1 = normalize( L[ 1 ] );
	vec3 corner2 = normalize( L[ 2 ] );
	vec3 corner3 = normalize( L[ 3 ] );
	vec3 formFactor = godotEdgeVector( corner0, corner1 );
	formFactor += godotEdgeVector( corner1, corner2 );
	formFactor += godotEdgeVector( corner2, corner3 );
	formFactor += godotEdgeVector( corner3, corner0 );

	if ( dot( formFactor, formFactor ) < 1e-16 ) {
		return godotAreaTextureAt( vec2( 0.5 ), textureRect, maxMipmap, maxMipmap );
	}
	vec3 lx = L[ 1 ] - L[ 0 ];
	vec3 ly = L[ 3 ] - L[ 0 ];
	vec3 ln = cross( lx, ly );
	float distanceTimesArea = dot( L[ 0 ], ln );
	vec3 toIntersection = distanceTimesArea / dot( formFactor, ln ) * formFactor - L[ 0 ];

	float lxDotLy = dot( lx, ly );
	float inverseLxLength = 1.0 / dot( lx, lx );
	vec3 lyOrthogonal = ly - lx * lxDotLy * inverseLxLength;
	vec2 uv;
	uv.y = dot( toIntersection, lyOrthogonal ) / dot( lyOrthogonal, lyOrthogonal );
	uv.x = dot( toIntersection, lx ) * inverseLxLength - lxDotLy * inverseLxLength * uv.y;

	float lod = godotAreaTextureLod( abs( distanceTimesArea ) / pow( dot( ln, ln ), 0.75 ) );
	return godotAreaTextureAt( vec2( 1.0 ) - uv, textureRect, lod, maxMipmap );
}
`;
