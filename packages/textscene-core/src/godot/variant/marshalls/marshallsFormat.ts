/** `Variant::MAX_RECURSION_DEPTH` (variant.h:150): a deeper container fails to encode or decode. */
export const MAX_RECURSION_DEPTH = 1024;

export const HEADER_TYPE_MASK = 0xff;
export const FLAG_64 = 1 << 16;
export const FLAG_OBJECT_AS_ID = 1 << 16;
export const TYPED_ARRAY_SHIFT = 16;
export const DICTIONARY_KEY_SHIFT = 16;
export const DICTIONARY_VALUE_SHIFT = 18;

/** `ContainerTypeKind` (marshalls.cpp:81), two header bits for each element type. */
export const CONTAINER_KIND = { NONE: 0b00, BUILTIN: 0b01, CLASS_NAME: 0b10, SCRIPT: 0b11 } as const;

/** The class a container of objects names when the bytes carry no objects. */
export const ENCODED_OBJECT_CLASS = 'EncodedObjectAsID';
