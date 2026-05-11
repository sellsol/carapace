import { Parser } from "n3";
import type { Quad } from "n3";

import { createLogger } from "$lib/logger";

const logger = createLogger("turtle");
const parser = new Parser();

export function parseTurtle(content: string): {
	triples: Quad[];
	prefixMap: Record<string, string>;
	parseError: string;
} {
	let parseError = "";
	let triples: Quad[] = [];
	const prefixMap: Record<string, string> = {};

	logger.info("Parsing TTL To Triples");
	try {
		// using parse() instead of explicit n3 error, quad, prefixes callbacks for synchronous behaviour
		triples = parser.parse(content);
	} catch (e) {
		parseError = e instanceof Error ? e.message : "Invalid TTL";
	}

	const prefixes = (parser as unknown as { _prefixes?: Record<string, string> })._prefixes; // need to access this way for parse()
	if (prefixes) {
		for (const [prefix, iri] of Object.entries(prefixes)) {
			prefixMap[iri] = prefix;
		}
	}
	logger.trace("Parsing TTL To Triples - Triples", triples);
	logger.trace("Parsing TTL To Triples - prefixMap", prefixMap);

	return { triples, prefixMap, parseError };
}
