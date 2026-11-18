import { PACKED_ARRAY_METHODS } from './packedArrayMethods.js';
import { PACKED_BYTE_ARRAY_METHODS } from './packedByteArrayMethods.js';
import type { VariantTypeName } from '../value/variant.js';
import { AABB_METHODS } from './aabbMethods.js';
import { ARRAY_METHODS } from './arrayMethods.js';
import { BASIS_METHODS } from './basisMethods.js';
import { CALLABLE_METHODS, CALLABLE_VARARG_METHODS } from './callableMethods.js';
import { COLOR_METHODS } from './colorMethods.js';
import { DICTIONARY_METHODS } from './dictionaryMethods.js';
import { VECTOR2I_METHODS, VECTOR3I_METHODS, VECTOR4I_METHODS } from './intVectorMethods.js';
import type { MethodPort, VarargPort } from './methodPort.js';
import { NODE_PATH_METHODS } from './nodePathMethods.js';
import { PLANE_METHODS } from './planeMethods.js';
import { PROJECTION_METHODS } from './projectionMethods.js';
import { QUATERNION_METHODS } from './quaternionMethods.js';
import { RECT2_METHODS, RECT2I_METHODS } from './rectMethods.js';
import { RID_METHODS } from './ridMethods.js';
import { SIGNAL_METHODS, SIGNAL_VARARG_METHODS } from './signalMethods.js';
import { STRING_METHODS, STRING_NAME_METHODS } from './stringMethods.js';
import { TRANSFORM2D_METHODS } from './transform2DMethods.js';
import { TRANSFORM3D_METHODS } from './transform3DMethods.js';
import { VECTOR2_METHODS } from './vector2Methods.js';
import { VECTOR3_METHODS } from './vector3Methods.js';
import { VECTOR4_METHODS } from './vector4Methods.js';

/** The method ports of each type, by type: a type with none yet is refused with its row. */
export const METHOD_PORTS: Readonly<Partial<Record<VariantTypeName, Readonly<Record<string, MethodPort>>>>> =
  {
    STRING: STRING_METHODS,
    VECTOR2: VECTOR2_METHODS,
    VECTOR2I: VECTOR2I_METHODS,
    VECTOR3: VECTOR3_METHODS,
    VECTOR3I: VECTOR3I_METHODS,
    VECTOR4: VECTOR4_METHODS,
    VECTOR4I: VECTOR4I_METHODS,
    RECT2: RECT2_METHODS,
    RECT2I: RECT2I_METHODS,
    COLOR: COLOR_METHODS,
    PLANE: PLANE_METHODS,
    AABB: AABB_METHODS,
    QUATERNION: QUATERNION_METHODS,
    BASIS: BASIS_METHODS,
    TRANSFORM2D: TRANSFORM2D_METHODS,
    TRANSFORM3D: TRANSFORM3D_METHODS,
    PROJECTION: PROJECTION_METHODS,
    STRING_NAME: STRING_NAME_METHODS,
    NODE_PATH: NODE_PATH_METHODS,
    ...PACKED_ARRAY_METHODS,
    PACKED_BYTE_ARRAY: PACKED_BYTE_ARRAY_METHODS,
    DICTIONARY: DICTIONARY_METHODS,
    ARRAY: ARRAY_METHODS,
    CALLABLE: CALLABLE_METHODS,
    SIGNAL: SIGNAL_METHODS,
    RID: RID_METHODS,
  };

/** The vararg method ports of each type, by type. */
export const VARARG_PORTS: Readonly<Partial<Record<VariantTypeName, Readonly<Record<string, VarargPort>>>>> =
  {
    CALLABLE: CALLABLE_VARARG_METHODS,
    SIGNAL: SIGNAL_VARARG_METHODS,
  };
