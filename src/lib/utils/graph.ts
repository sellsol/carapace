import type { Quad } from "n3";

import type { Edge, Node } from "$lib/types/graph";
import type { GraphSettings } from "$lib/types/tabs";
import { Builder } from "$lib/utils/builder";
import { Preprocessor } from "$lib/utils/preprocess";

export function makeTriplesHash(t: Quad[]): string {
	return JSON.stringify(t.map((q) => q.subject.value + q.predicate.value + q.object.value));
}

export function buildGraph(
	triples: Quad[],
	settings: GraphSettings,
	existingNodes: Array<{ uri: string; x: number; y: number }> = [],
	namespacePrefixes: Record<string, string> = {}
): { nodes: Node[]; edges: Edge[] } {
	const preprocessor = new Preprocessor(settings);
	preprocessor.process(triples);

	const cachedPositions = new Map<string, { x: number; y: number }[]>();
	for (const node of existingNodes) {
		if (!cachedPositions.has(node.uri)) cachedPositions.set(node.uri, []);
		cachedPositions.get(node.uri)!.push({ x: node.x, y: node.y });
	}

	const builder = new Builder(
		settings,
		namespacePrefixes,
		cachedPositions,
		triples,
		preprocessor.nodeDescriptors,
		preprocessor.collectionDescriptors
	);
	return builder.build();
}
