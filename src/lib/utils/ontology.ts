import type { Quad } from "n3";

import { INFERRED_TYPES, OWL_NS, RDFS_NS, TYPE_PREDICATE } from "$lib/constants/namespaces";
import { BUILTIN_DATATYPE, BUILTIN_NS_TO_PREFIX, BUILTIN_URI_TO_PROPERTY, XSD_NS } from "$lib/constants/namespaces";
import type { EntityType } from "$lib/types/graph";
import type { GraphSettings } from "$lib/types/tabs";
import { inHiddenNamespace } from "$lib/utils/settings";

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
	if (uri === OWL_NS + "NamedIndividual") return "instance";
	if (hasBuiltinPrefix(uri)) return "class";

	return null;
}

const TYPE_URI_TO_SUBJECT_TYPE: Record<string, EntityType> = {
	[OWL_NS + "NamedIndividual"]: "instance",
	[OWL_NS + "Thing"]: "instance",
	[RDFS_NS + "Resource"]: "instance"
};

export function classifyTypesLocal(
	triples: Quad[],
	settings: GraphSettings,
	uriToType: Map<string, EntityType>,
	hiddenUris: Set<string>,
	localUris: Set<string>,
	inferredUris: Set<string>
): void {
	for (const quad of triples) {
		const subjectUri = quad.subject.value;
		const predicateUri = quad.predicate.value;
		const objectUri = quad.object.value;

		if (!TYPE_PREDICATE.has(predicateUri)) continue;

		if (!hasBuiltinPrefix(subjectUri)) {
			localUris.add(subjectUri);
		}

		const objectType = TYPE_URI_TO_SUBJECT_TYPE[objectUri] ?? classifyUriType(objectUri);
		if (objectType) {
			uriToType.set(subjectUri, objectType);
		} else {
			uriToType.set(subjectUri, "instance");
			if (!uriToType.has(objectUri)) {
				uriToType.set(objectUri, "class");
				inferredUris.add(objectUri);
			}
		}

		if (settings.hiddenInstanceOfUris.includes(objectUri)) {
			hiddenUris.add(subjectUri);
		}
	}
}

export function classifyTypesInferred(
	triples: Quad[],
	settings: GraphSettings,
	uriToType: Map<string, EntityType>,
	hiddenUris: Set<string>,
	inferredUris: Set<string>
): void {
	for (const quad of triples) {
		const mapping = INFERRED_TYPES.get(quad.predicate.value);
		if (!mapping) continue;
		if (quad.subject.termType === "BlankNode" || quad.object.termType === "BlankNode") continue;

		const subj = quad.subject.value;
		if (!uriToType.has(subj) && !inHiddenNamespace(subj, settings.hiddenNamespaces) && !hiddenUris.has(subj)) {
			uriToType.set(subj, classifyUriType(subj) ?? mapping.subjectType);
			inferredUris.add(subj);
		}

		const obj = quad.object.value;
		if (!uriToType.has(obj) && !inHiddenNamespace(obj, settings.hiddenNamespaces) && !hiddenUris.has(obj)) {
			uriToType.set(obj, classifyUriType(obj) ?? mapping.objectType);
			inferredUris.add(obj);
		}
	}
}
