import { BlankNode, Parser, Quad } from "n3";
import type { Term } from "n3";

import { createLogger } from "$lib/logger";

const logger = createLogger("turtle");

function stabilizeTerm(term: Term, uriToStableNode: Map<string, BlankNode>, anonCounter: { value: number }): Term {
	if (term.termType !== "BlankNode") return term;

	let cachedNode = uriToStableNode.get(term.value);
	if (cachedNode) return cachedNode;

	const matchBlank = term.value.match(/^b\d+_(.+)$/); // blank node is in format b0_label, anon will be like n3-0
	const stableNode = matchBlank ? new BlankNode(matchBlank[1]) : new BlankNode(`anon-${anonCounter.value++}`); // counter makes uris position dependent and will shift when add/delete in middle of file, but temporary solution for now

	uriToStableNode.set(term.value, stableNode);
	return stableNode;
}

function stabilizeBlankNodeIds(triples: Quad[]): Quad[] {
	const anonCounter = { value: 0 }; // own counter, n3.js will increment all the blank node ids to different ones at each parse
	const uriToStableNode = new Map<string, BlankNode>();

	return triples.map((quad) => {
		const subject = stabilizeTerm(quad.subject, uriToStableNode, anonCounter);
		const object = stabilizeTerm(quad.object, uriToStableNode, anonCounter);
		return subject === quad.subject && object === quad.object
			? quad
			: new Quad(subject, quad.predicate, object, quad.graph);
	});
}

export function parseTurtle(content: string): {
	triples: Quad[];
	prefixMap: Record<string, string>;
	parseError: string;
} {
	let parseError = "";
	let rawTriples: Quad[] = [];
	const prefixMap: Record<string, string> = {};

	logger.info("Parsing TTL To Triples");
	const parser = new Parser();
	try {
		rawTriples = parser.parse(content);
	} catch (e) {
		parseError = e instanceof Error ? e.message : "Invalid TTL";
	}

	const prefixes = (parser as unknown as { _prefixes?: Record<string, string> })._prefixes;
	if (prefixes) {
		for (const [prefix, iri] of Object.entries(prefixes)) {
			prefixMap[iri] = prefix;
		}
	}

	const triples = stabilizeBlankNodeIds(rawTriples);

	logger.trace("Parsing TTL To Triples - Triples", triples);
	logger.trace("Parsing TTL To Triples - prefixMap", prefixMap);

	return { triples, prefixMap, parseError };
}
