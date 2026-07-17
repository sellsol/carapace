import { OWL_NS, RDFS_NS, RDF_NS } from "$lib/constants/namespaces";
import { tabsStore } from "$lib/stores/tabs.svelte";
import type { GraphSettings } from "$lib/types/tabs";

export function defaultGraphSettings(): GraphSettings {
	return {
		duplicateExternalNodes: false,
		hiddenNamespaces: [RDF_NS, RDFS_NS, OWL_NS],
		hiddenEntityTypes: ["blank"],
		hiddenPredicateUris: [],
		hiddenInstanceOfUris: [OWL_NS + "Ontology"]
	};
}

export function inHiddenNamespace(uri: string): boolean {
	const hiddenNamespaces = tabsStore.getActiveTab()?.settings.hiddenNamespaces;
	if (!hiddenNamespaces) return false;

	for (const ns of hiddenNamespaces) {
		if (uri.startsWith(ns)) return true;
	}
	return false;
}

export function makeSettingsHash(s: GraphSettings): string {
	return JSON.stringify([
		s.hiddenNamespaces,
		s.hiddenEntityTypes,
		s.hiddenPredicateUris,
		s.hiddenInstanceOfUris,
		s.duplicateExternalNodes
	]);
}
