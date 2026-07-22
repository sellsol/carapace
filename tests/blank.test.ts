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

const { namedNode, blankNode, quad } = DataFactory;

describe("blank nodes", () => {
	it("simple blank object - creates blank target node", () => {
		const { nodes, edges } = build({
			triples: [quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), blankNode("b1"))],
			settings: { hiddenEntityTypes: [] }
		});

		expect(nodes).toHaveLength(2);
		expect(edges).toHaveLength(1);

		const source = nodes.find((n) => n.uri === "http://ex.com/s");
		expect(source).toBeDefined();
		expect(source!.blank).toBe(false);

		const blankNodes = nodes.filter((n) => n.blank === true);
		expect(blankNodes).toHaveLength(1);
		expect(blankNodes[0].uri).toBe("b1");
		expect(blankNodes[0].nodeType).toBe("blank");
		expect(blankNodes[0].label).toBe("");
		expect(blankNodes[0].prefix).toBeNull();

		expect(edges[0].source.uri).toBe("http://ex.com/s");
		expect(edges[0].target.uri).toBe("b1");
		expect(edges[0].label).toBe("p");
		expect(edges[0].collectionEdge).toBe(false);
	});

	it("simple blank subject - creates blank source node", () => {
		const { nodes, edges } = build({
			triples: [quad(blankNode("b2"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o"))],
			settings: { hiddenEntityTypes: [] }
		});

		expect(nodes).toHaveLength(2);
		expect(edges).toHaveLength(1);

		const blankNodes = nodes.filter((n) => n.blank === true);
		expect(blankNodes).toHaveLength(1);
		expect(blankNodes[0].uri).toBe("b2");
		expect(blankNodes[0].nodeType).toBe("blank");
		expect(blankNodes[0].label).toBe("");
		expect(blankNodes[0].external).toBe(false);

		const target = nodes.find((n) => n.uri === "http://ex.com/o");
		expect(target).toBeDefined();
		expect(target!.blank).toBe(false);

		expect(edges[0].source.uri).toBe("b2");
		expect(edges[0].target.uri).toBe("http://ex.com/o");
	});

	it("reused subject - creates single source with two outgoing edges", () => {
		const { nodes, edges } = build({
			triples: [
				quad(blankNode("b"), namedNode("http://ex.com/p1"), namedNode("http://ex.com/o1")),
				quad(blankNode("b"), namedNode("http://ex.com/p2"), namedNode("http://ex.com/o2"))
			],
			settings: { hiddenEntityTypes: [] }
		});

		expect(nodes).toHaveLength(3);
		expect(edges).toHaveLength(2);

		const blankNodes = nodes.filter((n) => n.blank === true);
		expect(blankNodes).toHaveLength(1);
		expect(blankNodes[0].uri).toBe("b");

		for (const edge of edges) {
			expect(edge.source.uri).toBe("b");
		}
	});

	it("reused object - creates single target with two incoming edges", () => {
		const { nodes, edges } = build({
			triples: [
				quad(namedNode("http://ex.com/s1"), namedNode("http://ex.com/p"), blankNode("b")),
				quad(namedNode("http://ex.com/s2"), namedNode("http://ex.com/p"), blankNode("b"))
			],
			settings: { hiddenEntityTypes: [] }
		});

		expect(nodes).toHaveLength(3);
		expect(edges).toHaveLength(2);

		const blankNodes = nodes.filter((n) => n.blank === true);
		expect(blankNodes).toHaveLength(1);
		expect(blankNodes[0].uri).toBe("b");

		for (const edge of edges) {
			expect(edge.target.uri).toBe("b");
		}
	});

	it("reused subject/object - creates single node with both incoming and outgoing edges", () => {
		const { nodes, edges } = build({
			triples: [
				quad(blankNode("a"), namedNode("http://ex.com/p"), blankNode("b")),
				quad(blankNode("b"), namedNode("http://ex.com/q"), namedNode("http://ex.com/o"))
			],
			settings: { hiddenEntityTypes: [] }
		});

		expect(nodes).toHaveLength(3);
		expect(edges).toHaveLength(2);

		const mid = nodes.find((n) => n.uri === "b");
		expect(mid).toBeDefined();
		expect(mid!.blank).toBe(true);

		expect(edges[0].source.uri).toBe("a");
		expect(edges[0].target.uri).toBe("b");
		expect(edges[1].source.uri).toBe("b");
		expect(edges[1].target.uri).toBe("http://ex.com/o");
	});

	it("reused subject and object - merges multiple predicates for same pair into label on one edge", () => {
		const { nodes, edges } = build({
			triples: [
				quad(blankNode("b1"), namedNode("http://ex.com/p"), blankNode("b2")),
				quad(blankNode("b1"), namedNode("http://www.w3.org/2000/01/rdf-schema#label"), blankNode("b2"))
			],
			settings: { hiddenEntityTypes: [] },
			namespacePrefixes: { "http://ex.com/": "ex" }
		});

		expect(nodes).toHaveLength(2);
		expect(edges).toHaveLength(1);

		expect(edges[0].source.uri).toBe("b1");
		expect(edges[0].target.uri).toBe("b2");
		expect(edges[0].label).toBe("ex:p\nrdfs:label");
		expect(edges[0].label).toBe("ex:p\nrdfs:label");
		expect(edges[0].collectionEdge).toBe(false);
	});

	it("self-loop - creates self-referencing edge for same subject and object on single predicate", () => {
		const { nodes, edges } = build({
			triples: [quad(blankNode("b1"), namedNode("http://ex.com/p"), blankNode("b1"))],
			settings: { hiddenEntityTypes: [] }
		});

		expect(nodes).toHaveLength(1);
		expect(edges).toHaveLength(1);

		expect(edges[0].source.id).toBe(edges[0].target.id);
		expect(edges[0].source.uri).toBe("b1");
		expect(edges[0].target.uri).toBe("b1");
		expect(edges[0].label).toBe("p");
		expect(edges[0].collectionEdge).toBe(false);
	});

	it("self-loop - creates self-referencing edge with merged predicate labels", () => {
		const { nodes, edges } = build({
			triples: [
				quad(blankNode("b1"), namedNode("http://ex.com/p1"), blankNode("b1")),
				quad(blankNode("b1"), namedNode("http://ex.com/p2"), blankNode("b1"))
			],
			settings: { hiddenEntityTypes: [] }
		});

		expect(nodes).toHaveLength(1);
		expect(edges).toHaveLength(1);

		expect(edges[0].source.id).toBe(edges[0].target.id);
		expect(edges[0].source.uri).toBe("b1");
		expect(edges[0].target.uri).toBe("b1");
		expect(edges[0].label).toBe("p1\np2");
		expect(edges[0].collectionEdge).toBe(false);
	});

	// Note: Current expected behaviour is to distinguish blank untyped external nodes with yellow colour
	// Not too sure about this - could be less confusing to just set all blank nodes to internal
	it("internal definitions - resolves external only on nodes with no outgoing edges", () => {
		const { nodes } = build({
			triples: [
				quad(blankNode("s"), namedNode("http://ex.com/p"), blankNode("mid")),
				quad(blankNode("mid"), namedNode("http://ex.com/q"), blankNode("http://ex.com/o"))
			],
			settings: { hiddenEntityTypes: [] }
		});

		expect(nodes).toHaveLength(3);

		const source = nodes.find((n) => n.uri === "s");
		expect(source).toBeDefined();
		expect(source!.external).toBe(false);

		const mid = nodes.find((n) => n.uri === "mid");
		expect(mid).toBeDefined();
		expect(mid!.external).toBe(false);

		const target = nodes.find((n) => n.uri === "http://ex.com/o");
		expect(target).toBeDefined();
		expect(target!.external).toBe(true);
	});

	describe("typing", () => {
		it("typed only - creates orphan by default if only type predicate used for blank", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						blankNode("b"),
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
						namedNode("http://www.w3.org/2002/07/owl#Class")
					)
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(1);
			expect(edges).toHaveLength(0);

			expect(nodes[0]).toBeDefined();
			expect(nodes[0].uri).toBe("b");
			expect(nodes[0].nodeType).toBe("class");
			expect(nodes[0].blank).toBe(true);
		});

		it("typed blank - resolves node type from explicit type annotation", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						blankNode("b"),
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
						namedNode("http://www.w3.org/2002/07/owl#Class")
					),
					quad(blankNode("b"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o"))
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);

			const blankNodes = nodes.filter((n) => n.blank === true);
			expect(blankNodes).toHaveLength(1);
			expect(blankNodes[0].uri).toBe("b");
			expect(blankNodes[0].nodeType).toBe("class");
			expect(blankNodes[0].blank).toBe(true);

			expect(edges[0].source.uri).toBe("b");
			expect(edges[0].target.uri).toBe("http://ex.com/o");
		});
	});

	describe("settings", () => {
		it("setting blank hidden - remove untyped blank node and edge", () => {
			const { nodes, edges } = build({
				triples: [quad(blankNode("b"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o"))],
				settings: { hiddenEntityTypes: ["blank"] }
			});

			expect(nodes).toHaveLength(0);
			expect(edges).toHaveLength(0);
		});

		it("setting blank hidden - remove typed blank node and edge", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						blankNode("b"),
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
						namedNode("http://www.w3.org/2002/07/owl#Class")
					),
					quad(blankNode("b"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o"))
				],
				settings: { hiddenEntityTypes: ["blank"] }
			});

			expect(nodes).toHaveLength(0);
			expect(edges).toHaveLength(0);
		});

		it("setting class hidden - preserve untyped blank node by blank fallback", () => {
			const { nodes, edges } = build({
				triples: [quad(blankNode("b"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o"))],
				settings: { hiddenEntityTypes: ["class"] }
			});

			expect(nodes).toHaveLength(1);
			expect(edges).toHaveLength(0);

			expect(nodes[0].uri).toBe("b");
			expect(nodes[0].blank).toBe(true);
		});

		it("setting class hidden - remove typed blank node by class type", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						blankNode("b"),
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
						namedNode("http://www.w3.org/2002/07/owl#Class")
					),
					quad(blankNode("b"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o"))
				],
				settings: { hiddenEntityTypes: ["class"] }
			});

			expect(nodes).toHaveLength(0);
			expect(edges).toHaveLength(0);
		});

		it("setting instance hidden - remove typed blank node by instance type", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						blankNode("b"),
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
						namedNode("http://www.w3.org/2002/07/owl#NamedIndividual")
					),
					quad(blankNode("b"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o"))
				],
				settings: { hiddenEntityTypes: ["instance"] }
			});

			expect(nodes).toHaveLength(0);
			expect(edges).toHaveLength(0);
		});
	});

	describe("editing", () => {
		// Tests here use turtle parsing instead of writing out the triples
		// to properly simulate resolution of n3's internal uri generation between runs

		it("anonymous node unrelated - preserve anon node position when another anon node is inserted in front", () => {
			const base = `@prefix ex: <http://ex.com/> .\n[] ex:name "Alice" .`;
			const modified = `@prefix ex: <http://ex.com/> .\n[] ex:age 42 .\n[] ex:name "Alice" .`;

			const graph1 = build({ triples: parseTurtle(base).triples, settings: { hiddenEntityTypes: [] } });
			const alice1 = graph1.nodes.find((n) => n.blank)!;

			const graph2 = build({
				triples: parseTurtle(modified).triples,
				settings: { hiddenEntityTypes: [] },
				existingNodes: [{ uri: alice1.uri, x: alice1.x, y: alice1.y }]
			});

			const alice2 = graph2.nodes.find((n) => n.uri === alice1.uri);
			expect(alice2).toBeDefined();
			expect(alice2!.x).toBe(alice1.x);
			expect(alice2!.y).toBe(alice1.y);
		});

		it("anonymous node neighbour - preserve anon node position when related literal value is edited", () => {
			const base = `@prefix ex: <http://ex.com/> .\n[] ex:name "Alice" .`;
			const modified = `@prefix ex: <http://ex.com/> .\n[] ex:name "Bob" .`;

			const graph1 = build({ triples: parseTurtle(base).triples, settings: { hiddenEntityTypes: [] } });
			const alice1 = graph1.nodes.find((n) => n.blank)!;

			const graph2 = build({
				triples: parseTurtle(modified).triples,
				settings: { hiddenEntityTypes: [] },
				existingNodes: [{ uri: alice1.uri, x: alice1.x, y: alice1.y }] // Note: simulates what currently happens with hardcoding, may or may not need to improve this later
			});

			const alice2 = graph2.nodes.find((n) => n.uri === alice1.uri);
			expect(alice2).toBeDefined();
			expect(alice2!.x).toBe(alice1.x);
			expect(alice2!.y).toBe(alice1.y);
		});
	});
});
