import type { Quad } from "n3";
import { DataFactory } from "n3";

import type { Edge, Node } from "$lib/types/graph";
import type { GraphSettings } from "$lib/types/tabs";
import { buildGraph } from "$lib/utils/graph";

export { DataFactory };

const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
const OWL_NS = "http://www.w3.org/2002/07/owl#";

export function defaultSettings(): GraphSettings {
	return {
		duplicateExternalNodes: false,
		hiddenNamespaces: [RDF_NS, RDFS_NS, OWL_NS],
		hiddenEntityTypes: ["blank"],
		hiddenPredicateUris: [],
		hiddenInstanceOfUris: [OWL_NS + "Ontology"]
	};
}

export interface BuildOptions {
	triples: Quad[];
	settings?: Partial<GraphSettings>;
	existingNodes?: Array<{ uri: string; x: number; y: number }>;
	namespacePrefixes?: Record<string, string>;
}
export function build(options: BuildOptions): { nodes: Node[]; edges: Edge[] } {
	const settings = { ...defaultSettings(), ...options.settings };
	return buildGraph(options.triples, settings, options.existingNodes ?? [], options.namespacePrefixes ?? {});
}
