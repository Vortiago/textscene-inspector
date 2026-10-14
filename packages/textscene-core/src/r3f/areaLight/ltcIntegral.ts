/**
 * Godot 4.7.2's integral of a rectangle light under a linearly transformed cosine, and its solid
 * angle (`area_lights_inc.glsl:6-11,25-94,137-341`), in GLSL for three's lit programs. It reads
 * three's `ltc_1` and `ltc_2` samplers, which `ltcTextures.ts` fills with Godot's tables, and the
 * light's `area_texture` through `areaTextureFetch.ts`.
 */

/*
 * The integral is derived from Godot Engine (`servers/rendering/renderer_rd/shaders/
 * area_lights_inc.glsl`), used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 * See THIRD-PARTY-NOTICES.md for the full notice.
 */

import { LTC_SIZE } from '../../godot/ltc.js';
import { glslFloat } from '../../resources/environment/glslLiterals.js';
import { AREA_TEXTURE_FETCH } from './areaTextureFetch.js';

/**
 * Each function keeps Godot's operations in Godot's order, so a pixel matches. The clip keeps
 * Godot's sixteen cases, two of them impossible for a rectangle.
 */
export const LTC_INTEGRAL = /* glsl */ `
float godotAcosApprox( const in float value ) {
	float x = abs( value );
	float angle = - 0.156583 * x + ( PI / 2.0 );
	angle *= sqrt( 1.0 - x );
	return ( value >= 0.0 ) ? angle : PI - angle;
}

// Hill and Heitz's fit of the cosine distribution's integral over the arc from one point to another.
vec3 godotEdgeVector( const in vec3 from, const in vec3 to ) {
	float x = dot( from, to );
	float y = abs( x );
	float a = 5.42031 + ( 3.12829 + 0.0902326 * y ) * y;
	float b = 3.45068 + ( 4.18814 + y ) * y;
	float thetaSinTheta = a / b;
	if ( x < 0.0 ) {
		thetaSinTheta = PI * inversesqrt( 1.0 - x * x ) - thetaSinTheta;
	}
	return thetaSinTheta * cross( from, to );
}

float godotEdgeIntegral( const in vec3 from, const in vec3 to ) {
	return godotEdgeVector( from, to ).y;
}

${AREA_TEXTURE_FETCH}
// An edge whose ends lie opposite on the sphere splits at the point closest to the fragment.
float godotIntegrateEdge( const in vec3 projected0, const in vec3 projected1, const in vec3 p0, const in vec3 p1 ) {
	if ( dot( projected0, projected1 ) < - 1.0 + 0.00001 ) {
		vec3 halfPoint = normalize( p0 + normalize( p1 - p0 ) * dot( p0, normalize( p0 - p1 ) ) );
		return godotEdgeIntegral( projected0, halfPoint ) + godotEdgeIntegral( halfPoint, projected1 );
	}
	return godotEdgeIntegral( projected0, projected1 );
}

// The number of corners left above the horizon, which the clip writes first in L.
int godotClipQuadToHorizon( inout vec3 L[ 5 ] ) {
	int config = 0;
	if ( L[ 0 ].y > 0.0 ) config += 1;
	if ( L[ 1 ].y > 0.0 ) config += 2;
	if ( L[ 2 ].y > 0.0 ) config += 4;
	if ( L[ 3 ].y > 0.0 ) config += 8;

	int vertexCount = 0;
	if ( config == 1 ) {
		vertexCount = 3;
		L[ 1 ] = - L[ 1 ].y * L[ 0 ] + L[ 0 ].y * L[ 1 ];
		L[ 2 ] = - L[ 3 ].y * L[ 0 ] + L[ 0 ].y * L[ 3 ];
	} else if ( config == 2 ) {
		vertexCount = 3;
		L[ 0 ] = - L[ 0 ].y * L[ 1 ] + L[ 1 ].y * L[ 0 ];
		L[ 2 ] = - L[ 2 ].y * L[ 1 ] + L[ 1 ].y * L[ 2 ];
	} else if ( config == 3 ) {
		vertexCount = 4;
		L[ 2 ] = - L[ 2 ].y * L[ 1 ] + L[ 1 ].y * L[ 2 ];
		L[ 3 ] = - L[ 3 ].y * L[ 0 ] + L[ 0 ].y * L[ 3 ];
	} else if ( config == 4 ) {
		vertexCount = 3;
		L[ 0 ] = - L[ 3 ].y * L[ 2 ] + L[ 2 ].y * L[ 3 ];
		L[ 1 ] = - L[ 1 ].y * L[ 2 ] + L[ 2 ].y * L[ 1 ];
	} else if ( config == 6 ) {
		vertexCount = 4;
		L[ 0 ] = - L[ 0 ].y * L[ 1 ] + L[ 1 ].y * L[ 0 ];
		L[ 3 ] = - L[ 3 ].y * L[ 2 ] + L[ 2 ].y * L[ 3 ];
	} else if ( config == 7 ) {
		vertexCount = 5;
		L[ 4 ] = - L[ 3 ].y * L[ 0 ] + L[ 0 ].y * L[ 3 ];
		L[ 3 ] = - L[ 3 ].y * L[ 2 ] + L[ 2 ].y * L[ 3 ];
	} else if ( config == 8 ) {
		vertexCount = 3;
		L[ 0 ] = - L[ 0 ].y * L[ 3 ] + L[ 3 ].y * L[ 0 ];
		L[ 1 ] = - L[ 2 ].y * L[ 3 ] + L[ 3 ].y * L[ 2 ];
		L[ 2 ] = L[ 3 ];
	} else if ( config == 9 ) {
		vertexCount = 4;
		L[ 1 ] = - L[ 1 ].y * L[ 0 ] + L[ 0 ].y * L[ 1 ];
		L[ 2 ] = - L[ 2 ].y * L[ 3 ] + L[ 3 ].y * L[ 2 ];
	} else if ( config == 11 ) {
		vertexCount = 5;
		L[ 4 ] = L[ 3 ];
		L[ 3 ] = - L[ 2 ].y * L[ 3 ] + L[ 3 ].y * L[ 2 ];
		L[ 2 ] = - L[ 2 ].y * L[ 1 ] + L[ 1 ].y * L[ 2 ];
	} else if ( config == 12 ) {
		vertexCount = 4;
		L[ 1 ] = - L[ 1 ].y * L[ 2 ] + L[ 2 ].y * L[ 1 ];
		L[ 0 ] = - L[ 0 ].y * L[ 3 ] + L[ 3 ].y * L[ 0 ];
	} else if ( config == 13 ) {
		vertexCount = 5;
		L[ 4 ] = L[ 3 ];
		L[ 3 ] = L[ 2 ];
		L[ 2 ] = - L[ 1 ].y * L[ 2 ] + L[ 2 ].y * L[ 1 ];
		L[ 1 ] = - L[ 1 ].y * L[ 0 ] + L[ 0 ].y * L[ 1 ];
	} else if ( config == 14 ) {
		vertexCount = 5;
		L[ 4 ] = - L[ 0 ].y * L[ 3 ] + L[ 3 ].y * L[ 0 ];
		L[ 0 ] = - L[ 0 ].y * L[ 1 ] + L[ 1 ].y * L[ 0 ];
	} else if ( config == 15 ) {
		vertexCount = 4;
	}

	if ( vertexCount == 3 ) L[ 3 ] = L[ 0 ];
	if ( vertexCount == 4 ) L[ 4 ] = L[ 0 ];
	return vertexCount;
}

float godotIntegrateClippedQuad( const in vec3 L[ 5 ], const in vec3 projected[ 5 ], const in int vertexCount ) {
	float integral = godotIntegrateEdge( projected[ 0 ], projected[ 1 ], L[ 0 ], L[ 1 ] );
	integral += godotIntegrateEdge( projected[ 1 ], projected[ 2 ], L[ 1 ], L[ 2 ] );
	integral += godotIntegrateEdge( projected[ 2 ], projected[ 3 ], L[ 2 ], L[ 3 ] );
	if ( vertexCount >= 4 ) integral += godotIntegrateEdge( projected[ 3 ], projected[ 4 ], L[ 3 ], L[ 4 ] );
	if ( vertexCount == 5 ) integral += godotIntegrateEdge( projected[ 4 ], projected[ 0 ], L[ 4 ], L[ 0 ] );
	return abs( integral );
}

// The rectangle's spherical excess, from the angles between the planes through its edges.
float godotQuadSolidAngle( const in vec3 L[ 4 ] ) {
	vec3 n0 = normalize( cross( L[ 0 ], L[ 1 ] ) );
	vec3 n1 = normalize( cross( L[ 1 ], L[ 2 ] ) );
	vec3 n2 = normalize( cross( L[ 2 ], L[ 3 ] ) );
	vec3 n3 = normalize( cross( L[ 3 ], L[ 0 ] ) );
	float g0 = acos( clamp( dot( - n0, n1 ), - 1.0, 1.0 ) );
	float g1 = acos( clamp( dot( - n1, n2 ), - 1.0, 1.0 ) );
	float g2 = acos( clamp( dot( - n2, n3 ), - 1.0, 1.0 ) );
	float g3 = acos( clamp( dot( - n3, n0 ), - 1.0, 1.0 ) );
	float angleSum = g0 + g1 + g2 + g3;
	return clamp( angleSum - PI2, 0.0, PI2 );
}

// The rectangle's corners, relative to the fragment, under the cosine that mInv transforms, and
// the light's texture where the integral sees it: white for a light without one, or where the
// rectangle lies below the horizon.
float godotLtcIntegral( const in vec3 normal, const in vec3 viewDir, const in mat3 mInv, const in vec3 points[ 4 ], const in vec4 textureRect, const in float maxMipmap, out vec3 textureColor ) {
	textureColor = vec3( 1.0 );
	vec3 z = - normalize( viewDir - normal * dot( viewDir, normal ) );
	vec3 x = cross( normal, z );
	mat3 toCosine = mInv * transpose( mat3( x, normal, z ) );

	vec3 L[ 5 ];
	L[ 0 ] = toCosine * points[ 0 ];
	L[ 1 ] = toCosine * points[ 1 ];
	L[ 2 ] = toCosine * points[ 2 ];
	L[ 3 ] = toCosine * points[ 3 ];
	L[ 4 ] = L[ 0 ];
	vec3 unclipped[ 4 ] = vec3[ 4 ]( L[ 0 ], L[ 1 ], L[ 2 ], L[ 3 ] );

	int vertexCount = godotClipQuadToHorizon( L );
	if ( vertexCount == 0 ) return 0.0;
	if ( textureRect != vec4( 0.0 ) ) textureColor = godotAreaTextureColor( textureRect, maxMipmap, unclipped );

	vec3 projected[ 5 ];
	projected[ 0 ] = normalize( L[ 0 ] );
	projected[ 1 ] = normalize( L[ 1 ] );
	projected[ 2 ] = normalize( L[ 2 ] );
	projected[ 3 ] = normalize( L[ 3 ] );
	projected[ 4 ] = normalize( L[ 4 ] );

	// A fragment in the light's plane reads the whole light where it lies on the rectangle.
	vec3 planeNormal = normalize( cross( projected[ 0 ] - projected[ 1 ], projected[ 2 ] - projected[ 1 ] ) );
	if ( abs( dot( planeNormal, projected[ 0 ] ) ) < 1e-10 ) {
		vec3 r10 = points[ 0 ] - points[ 1 ];
		vec3 r12 = points[ 2 ] - points[ 1 ];
		float alpha = - dot( points[ 1 ], r10 ) / dot( r10, r10 );
		float beta = - dot( points[ 1 ], r12 ) / dot( r12, r12 );
		return ( 0.0 < alpha && alpha < 1.0 && 0.0 < beta && beta < 1.0 ) ? 1.0 : 0.0;
	}

	return godotIntegrateClippedQuad( L, projected, vertexCount ) / ( 2.0 * PI );
}

// The GGX lobe as Godot's fit transforms it, at the texel centre for roughness and view angle.
float godotLtcSpecular( const in vec3 normal, const in vec3 viewDir, const in float roughness, const in vec3 points[ 4 ], const in vec4 textureRect, const in float maxMipmap, out vec2 fresnel, out vec3 textureColor ) {
	float theta = godotAcosApprox( dot( normal, viewDir ) );
	vec2 lutPosition = vec2( max( roughness, 0.02 ), theta / ( 0.5 * PI ) );
	vec2 lutUv = lutPosition * ${glslFloat((LTC_SIZE - 1) / LTC_SIZE)} + vec2( ${glslFloat(0.5 / LTC_SIZE)} );
	vec4 abcd = texture2D( ltc_1, lutUv );
	vec3 eFresnel = texture2D( ltc_2, lutUv ).xyz;
	float scale = 1.0 / ( abcd.x * eFresnel.x - abcd.y * abcd.w );
	mat3 mInv = mat3(
		vec3( 0.0, 0.0, 1.0 / abcd.z ),
		vec3( - abcd.w * scale, abcd.x * scale, 0.0 ),
		vec3( - eFresnel.x * scale, abcd.y * scale, 0.0 )
	);
	fresnel = eFresnel.yz;
	return godotLtcIntegral( normal, viewDir, mInv, points, textureRect, maxMipmap, textureColor );
}
`;
