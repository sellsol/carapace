import { describe, expect, it, vi } from "vitest";

import { parseTurtle } from "$lib/utils/turtle";

import { DataFactory, build } from "./helpers";

vi.mock("$lib/utils/settings", () => {
	const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
	const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
	const OWL_NS = "http://www.w3.org/2002/07/owl#";

	return {
		inHiddenNamespace: (uri: string) => uri.startsWith(RDF_NS) || uri.startsWith(RDFS_NS) || uri.startsWith(OWL_NS)
	};
});

const { namedNode, literal, quad } = DataFactory;

describe("literal nodes", () => {
	it("simple literal - creates literal target node with correct label", () => {
		const { nodes, edges } = build({
			triples: [quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), literal("hello"))]
		});

		expect(nodes).toHaveLength(2);
		expect(edges).toHaveLength(1);

		const source = nodes.find((n) => n.uri === "http://ex.com/s");
		expect(source).toBeDefined();
		expect(source!.nodeType).not.toBe("literal");

		const literalNodes = nodes.filter((n) => n.nodeType === "literal");
		expect(literalNodes).toHaveLength(1);
		expect(literalNodes[0].label).toBe("hello");
		expect(literalNodes[0].external).toBe(false);
		expect(literalNodes[0].blank).toBe(false);
		expect(literalNodes[0].prefix).toBeNull();

		expect(edges[0].source.uri).toBe("http://ex.com/s");
		expect(edges[0].target.uri).toBe(literalNodes[0].uri);
		expect(edges[0].label).toBe("p");
		expect(edges[0].collectionEdge).toBe(false);
	});

	it("type tagged - resolves lexical value as label", () => {
		const { nodes, edges } = build({
			triples: [
				quad(
					namedNode("http://ex.com/s"),
					namedNode("http://ex.com/p"),
					literal("42", namedNode("http://www.w3.org/2001/XMLSchema#int"))
				)
			]
		});

		expect(nodes).toHaveLength(2);
		expect(edges).toHaveLength(1);

		const literalNodes = nodes.filter((n) => n.nodeType === "literal");
		expect(literalNodes).toHaveLength(1);
		expect(literalNodes[0].label).toBe("42");
	});

	it("language tagged - resolves lexical value as label", () => {
		const { nodes, edges } = build({
			triples: [quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), literal("hello", "en"))]
		});

		expect(nodes).toHaveLength(2);
		expect(edges).toHaveLength(1);

		const literalNodes = nodes.filter((n) => n.nodeType === "literal");
		expect(literalNodes).toHaveLength(1);
		expect(literalNodes[0].label).toBe("hello");
	});

	it("identical values - duplicated as separate nodes", () => {
		const { nodes, edges } = build({
			triples: [
				quad(namedNode("http://ex.com/s1"), namedNode("http://ex.com/p"), literal("hello")),
				quad(namedNode("http://ex.com/s2"), namedNode("http://ex.com/p"), literal("hello"))
			]
		});

		expect(nodes).toHaveLength(4);
		expect(edges).toHaveLength(2);

		const literalNodes = nodes.filter((n) => n.nodeType === "literal");
		expect(literalNodes).toHaveLength(2);
		expect(literalNodes[0].uri).not.toBe(literalNodes[1].uri);
		expect(literalNodes[0].label).toBe("hello");
		expect(literalNodes[1].label).toBe("hello");
	});

	describe("settings", () => {
		it("setting literal hidden - remove literal node and edge", () => {
			const { nodes, edges } = build({
				triples: [quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), literal("hello"))],
				settings: { hiddenEntityTypes: ["literal"] }
			});

			expect(nodes).toHaveLength(1);
			expect(edges).toHaveLength(0);

			const source = nodes.find((n) => n.uri === "http://ex.com/s");
			expect(source).toBeDefined();
		});
	});

	describe("editing", () => {
		it("literal node value - preserve literal node position when its literal value is edited", () => {
			const base = `@prefix ex: <http://ex.com/> .\n[] ex:name "Alice" .`;
			const modified = `@prefix ex: <http://ex.com/> .\n[] ex:name "Bob" .`;

			const graph1 = build({ triples: parseTurtle(base).triples, settings: { hiddenEntityTypes: [] } });
			const literalNode1 = graph1.nodes.find((n) => n.nodeType === "literal")!;

			const graph2 = build({
				triples: parseTurtle(modified).triples,
				settings: { hiddenEntityTypes: [] },
				existingNodes: [{ uri: literalNode1.uri, x: literalNode1.x, y: literalNode1.y }]
			});

			const literalNode2 = graph2.nodes.find((n) => n.nodeType === "literal")!;
			expect(literalNode2).toBeDefined();
			expect(literalNode2.x).toBe(literalNode2.x);
			expect(literalNode2.y).toBe(literalNode2.y);
		});
	});
});
