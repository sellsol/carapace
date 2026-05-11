import { OWL_NS, RDFS_NS, RDF_NS, XSD_NS } from "$lib/constants/namespaces";
import type { GraphSettings } from "$lib/types/tabs";

export function defaultGraphSettings(): GraphSettings {
	return {
		duplicateExternalNodes: false,
		hiddenNamespaces: [RDF_NS, RDFS_NS, OWL_NS, XSD_NS],
		hiddenEntityTypes: [],
		hiddenPredicateUris: [],
		hiddenInstanceOfUris: [OWL_NS + "Ontology", OWL_NS + "Restriction", OWL_NS + "Axiom"]
	};
}

export function inHiddenNamespace(uri: string, hiddenNamespaces: string[]): boolean {
	for (const ns of hiddenNamespaces) {
		if (uri.startsWith(ns)) return true;
	}
	return false;
}

export function settingsHash(s: GraphSettings): string {
	return JSON.stringify([
		s.hiddenNamespaces,
		s.hiddenEntityTypes,
		s.hiddenPredicateUris,
		s.hiddenInstanceOfUris,
		s.duplicateExternalNodes
	]);
}
