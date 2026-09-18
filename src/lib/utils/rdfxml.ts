import { Writer } from "n3";
import type { Quad } from "n3";
import { RdfXmlParser } from "rdfxml-streaming-parser";

import { createLogger } from "$lib/logger";

const logger = createLogger("rdfxml");

function extractXmlPrefixes(content: string): Record<string, string> {
	const prefixes: Record<string, string> = {};

	const xmlnsRegex = /xmlns(:\w[\w.-]*)?\s*=\s*(["'])(.*?)\2/g;
	for (const match of content.matchAll(xmlnsRegex)) {
		prefixes[match[1]?.slice(1) ?? ""] = match[3];
	}

	return prefixes;
}

export function rdfXmlToTurtle(content: string, baseIRI: string, prefixes?: Record<string, string>): Promise<string> {
	const quads: Quad[] = [];

	return new Promise((resolve, reject) => {
		const parser = new RdfXmlParser({ baseIRI });
		parser.on("data", (quad) => quads.push(quad));
		parser.on("error", reject);
		parser.on("end", () => {
			const writer = new Writer({ prefixes: { ...extractXmlPrefixes(content), ...prefixes } });
			writer.addQuads(quads);
			writer.end((error, ttl) => {
				if (error) {
					reject(error);
					return;
				}

				logger.debug("RDF/XML Converted To Turtle", { triples: quads.length });
				resolve(ttl);
			});
		});
		parser.end(content);
	});
}
