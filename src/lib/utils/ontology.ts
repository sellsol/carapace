import {
	BUILTIN_DATATYPE,
	BUILTIN_INSTANCE,
	BUILTIN_NS_TO_PREFIX,
	BUILTIN_URI_TO_PROPERTY,
	XSD_NS
} from "$lib/constants/namespaces";
import type { EntityType } from "$lib/types/graph";

export function hasBuiltinPrefix(uri: string): boolean {
	for (const ns of Object.keys(BUILTIN_NS_TO_PREFIX)) {
		if (uri.startsWith(ns)) return true;
	}
	return false;
}

export function resolvePrefix(uri: string, customPrefixes: Record<string, string> = {}): string | null {
	for (const [ns, prefix] of Object.entries(customPrefixes)) {
		if (uri.startsWith(ns)) return prefix;
	}

	for (const [ns, prefix] of Object.entries(BUILTIN_NS_TO_PREFIX)) {
		if (uri.startsWith(ns)) return prefix;
	}

	return null;
}

export function resolveLocalName(uri: string): string {
	const hashIndex = uri.indexOf("#");
	if (hashIndex !== -1) return uri.substring(hashIndex + 1);

	const slashIndex = uri.lastIndexOf("/");
	if (slashIndex !== -1) return uri.substring(slashIndex + 1);

	return uri;
}

export function classifyUriType(uri: string): EntityType | null {
	const propertyType = BUILTIN_URI_TO_PROPERTY[uri];
	if (propertyType) return propertyType as EntityType;

	if (uri.startsWith(XSD_NS) || BUILTIN_DATATYPE.has(uri)) return "datatype";
	if (BUILTIN_INSTANCE.has(uri)) return "instance";
	if (hasBuiltinPrefix(uri)) return "class";

	return null;
}
