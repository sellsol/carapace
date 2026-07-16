import type { Quad } from "n3";

import type { Edge, EntityType, Node } from "$lib/types/graph";
import type { GraphSettings } from "$lib/types/tabs";
import { Builder } from "$lib/utils/builder";
import { Preprocessor } from "$lib/utils/preprocess";

export function makeTriplesHash(t: Quad[]): string {
	return JSON.stringify(t.map((q) => q.subject.value + q.predicate.value + q.object.value));
}

export function buildGraph(
	triples: Quad[],
	settings: GraphSettings,
	existingNodes: Array<{ uri: string; x: number; y: number; nodeType?: EntityType }> = [],
	namespacePrefixes: Record<string, string> = {}
): { nodes: Node[]; edges: Edge[] } {
	const preprocessor = new Preprocessor(settings);
	preprocessor.process(triples);

	const cachedPositions = new Map<string, { x: number; y: number }[]>();
	const literalGroups = new Map<string, { value: string; position: { x: number; y: number }; claimed: boolean }[]>();

	for (const node of existingNodes) {
		if (!cachedPositions.has(node.uri)) {
			cachedPositions.set(node.uri, []);
		}
		cachedPositions.get(node.uri)!.push({ x: node.x, y: node.y });

		if (node.nodeType === "literal") {
			// based on keys construction in builder's addLiteralNode()
			const firstSep = node.uri.indexOf("|");
			if (firstSep === -1) continue;

			const secondSep = node.uri.indexOf("|", firstSep + 1);
			if (secondSep === -1) continue;

			const groupKey = node.uri.substring(0, secondSep);
			const value = node.uri.substring(secondSep + 1);
			if (!literalGroups.has(groupKey)) {
				literalGroups.set(groupKey, []);
			}
			literalGroups.get(groupKey)!.push({ value, position: { x: node.x, y: node.y }, claimed: false });
		}
	}

	const builder = new Builder(
		settings,
		namespacePrefixes,
		cachedPositions,
		literalGroups,
		triples,
		preprocessor.nodeDescriptors,
		preprocessor.collectionDescriptors
	);
	return builder.build();
}
