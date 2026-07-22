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

const { namedNode, quad } = DataFactory;

describe("named nodes", () => {
	it("simple triple - creates source and target nodes", () => {
		const { nodes, edges } = build({
			triples: [quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o"))]
		});

		expect(nodes).toHaveLength(2);
		expect(edges).toHaveLength(1);

		const source = nodes.find((n) => n.uri === "http://ex.com/s");
		expect(source).toBeDefined();
		expect(source!.blank).toBe(false);

		const target = nodes.find((n) => n.uri === "http://ex.com/o");
		expect(target).toBeDefined();
		expect(target!.blank).toBe(false);

		expect(edges[0].source.uri).toBe("http://ex.com/s");
		expect(edges[0].target.uri).toBe("http://ex.com/o");
		expect(edges[0].label).toBe("p");
		expect(edges[0].collectionEdge).toBe(false);
	});

	it("reused subject - creates single source with two outgoing edges", () => {
		const { nodes, edges } = build({
			triples: [
				quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p1"), namedNode("http://ex.com/o1")),
				quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p2"), namedNode("http://ex.com/o2"))
			]
		});

		expect(nodes).toHaveLength(3);
		expect(edges).toHaveLength(2);

		const source = nodes.find((n) => n.uri === "http://ex.com/s");
		expect(source).toBeDefined();

		const target1 = nodes.find((n) => n.uri === "http://ex.com/o1");
		expect(target1).toBeDefined();
		const target2 = nodes.find((n) => n.uri === "http://ex.com/o2");
		expect(target2).toBeDefined();

		for (const edge of edges) {
			expect(edge.source.uri).toBe("http://ex.com/s");
		}
	});

	it("reused object - creates single target with two incoming edges", () => {
		const { nodes, edges } = build({
			triples: [
				quad(namedNode("http://ex.com/s1"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o")),
				quad(namedNode("http://ex.com/s2"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o"))
			]
		});

		expect(nodes).toHaveLength(3);
		expect(edges).toHaveLength(2);

		const source1 = nodes.find((n) => n.uri === "http://ex.com/s1");
		expect(source1).toBeDefined();
		const source2 = nodes.find((n) => n.uri === "http://ex.com/s2");
		expect(source2).toBeDefined();

		const target = nodes.find((n) => n.uri === "http://ex.com/o");
		expect(target).toBeDefined();

		for (const edge of edges) {
			expect(edge.target.uri).toBe("http://ex.com/o");
		}
	});

	it("reused subject/object - creates single node with both with incoming and outgoing edges", () => {
		const { nodes, edges } = build({
			triples: [
				quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), namedNode("http://ex.com/mid")),
				quad(namedNode("http://ex.com/mid"), namedNode("http://ex.com/q"), namedNode("http://ex.com/o"))
			]
		});

		expect(nodes).toHaveLength(3);
		expect(edges).toHaveLength(2);

		const mid = nodes.find((n) => n.uri === "http://ex.com/mid");
		expect(mid).toBeDefined();

		expect(edges[0].source.uri).toBe("http://ex.com/s");
		expect(edges[0].target.uri).toBe("http://ex.com/mid");
		expect(edges[1].source.uri).toBe("http://ex.com/mid");
		expect(edges[1].target.uri).toBe("http://ex.com/o");
	});

	it("reused subject and object - merges multiple predicates for same pair into label on one edge", () => {
		const { nodes, edges } = build({
			triples: [
				quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o")),
				quad(
					namedNode("http://ex.com/s"),
					namedNode("http://www.w3.org/2000/01/rdf-schema#label"),
					namedNode("http://ex.com/o")
				)
			],
			namespacePrefixes: { "http://ex.com/": "ex" }
		});

		expect(nodes).toHaveLength(2);
		expect(edges).toHaveLength(1);

		expect(edges[0].source.uri).toBe("http://ex.com/s");
		expect(edges[0].target.uri).toBe("http://ex.com/o");
		expect(edges[0].label).toBe("ex:p\nrdfs:label");
		expect(edges[0].label).toBe("ex:p\nrdfs:label");
		expect(edges[0].collectionEdge).toBe(false);
	});

	it("self-loop - creates self-referencing edge for same subject and object on single predicate", () => {
		const { nodes, edges } = build({
			triples: [quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), namedNode("http://ex.com/s"))]
		});

		expect(nodes).toHaveLength(1);
		expect(edges).toHaveLength(1);

		expect(edges[0].source.id).toBe(edges[0].target.id);
		expect(edges[0].source.uri).toBe("http://ex.com/s");
		expect(edges[0].target.uri).toBe("http://ex.com/s");
		expect(edges[0].label).toBe("p");
		expect(edges[0].collectionEdge).toBe(false);
	});

	it("self-loop - creates self-referencing edge with merged predicate labels", () => {
		const { nodes, edges } = build({
			triples: [
				quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p1"), namedNode("http://ex.com/s")),
				quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p2"), namedNode("http://ex.com/s"))
			]
		});

		expect(nodes).toHaveLength(1);
		expect(edges).toHaveLength(1);

		expect(edges[0].source.id).toBe(edges[0].target.id);
		expect(edges[0].source.uri).toBe("http://ex.com/s");
		expect(edges[0].target.uri).toBe("http://ex.com/s");
		expect(edges[0].label).toBe("p1\np2");
		expect(edges[0].collectionEdge).toBe(false);
	});

	it("internal definitions - resolves external only on nodes with no outgoing edges", () => {
		const { nodes } = build({
			triples: [
				quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), namedNode("http://ex.com/mid")),
				quad(namedNode("http://ex.com/mid"), namedNode("http://ex.com/q"), namedNode("http://ex.com/o"))
			]
		});

		expect(nodes).toHaveLength(3);

		const source = nodes.find((n) => n.uri === "http://ex.com/s");
		expect(source).toBeDefined();
		expect(source!.external).toBe(false);

		const mid = nodes.find((n) => n.uri === "http://ex.com/mid");
		expect(mid).toBeDefined();
		expect(mid!.external).toBe(false);

		const target = nodes.find((n) => n.uri === "http://ex.com/o");
		expect(target).toBeDefined();
		expect(target!.external).toBe(true);
	});

	describe("prefixes", () => {
		it("custom prefix map - resolves prefix and localName on nodes and edge", () => {
			const { nodes, edges } = build({
				triples: [
					quad(namedNode("http://ex.com/Foo"), namedNode("http://ex.com/bar"), namedNode("http://ex.com/Baz"))
				],
				namespacePrefixes: { "http://ex.com/": "ex" }
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);

			const source = nodes.find((n) => n.uri === "http://ex.com/Foo");
			expect(source).toBeDefined();
			expect(source!.prefix).toBe("ex");
			expect(source!.label).toBe("Foo");

			const target = nodes.find((n) => n.uri === "http://ex.com/Baz");
			expect(target).toBeDefined();
			expect(target!.prefix).toBe("ex");
			expect(target!.label).toBe("Baz");

			expect(edges[0].label).toBe("ex:bar");
		});

		it("built-in prefix map - resolves prefix and localName on nodes and edge", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						namedNode("http://ex.com/s"),
						namedNode("http://www.w3.org/2000/01/rdf-schema#label"),
						namedNode("http://www.w3.org/2001/XMLSchema#string")
					)
				]
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);

			const source = nodes.find((n) => n.uri === "http://ex.com/s");
			expect(source).toBeDefined();
			expect(source!.prefix).toBeNull();

			const target = nodes.find((n) => n.uri === "http://www.w3.org/2001/XMLSchema#string");
			expect(target).toBeDefined();
			expect(target!.prefix).toBe("xsd");
			expect(target!.label).toBe("string");

			expect(edges[0].label).toBe("rdfs:label");
		});
	});

	describe("typing", () => {
		it("typed only - creates orphan by default if only type predicate used for node", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						namedNode("http://ex.com/Foo"),
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
						namedNode("http://www.w3.org/2002/07/owl#Class")
					),
					quad(
						namedNode("http://ex.com/Bar"),
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
						namedNode("http://www.w3.org/2002/07/owl#NamedIndividual")
					)
				]
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(0);

			const orphan1 = nodes.find((n) => n.uri === "http://ex.com/Foo");
			expect(orphan1).toBeDefined();
			expect(orphan1!.nodeType).toBe("class");

			const orphan2 = nodes.find((n) => n.uri === "http://ex.com/Bar");
			expect(orphan2).toBeDefined();
			expect(orphan2!.nodeType).toBe("instance");

			expect(nodes.find((n) => n.uri === "http://www.w3.org/2002/07/owl#Class")).toBeUndefined();
		});

		it("typed explicit - resolves instance type for rdf:type subject", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						namedNode("http://ex.com/s"),
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
						namedNode("http://ex.com/CustomType")
					)
				]
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);

			const subject = nodes.find((n) => n.uri === "http://ex.com/s");
			expect(subject).toBeDefined();
			expect(subject!.nodeType).toBe("instance");

			const object = nodes.find((n) => n.uri === "http://ex.com/CustomType");
			expect(object).toBeDefined();
			expect(object!.nodeType).toBe("class");
		});

		it("typed inferred - resolves class type for rdfs:subClassOf subject and object", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						namedNode("http://ex.com/s"),
						namedNode("http://www.w3.org/2000/01/rdf-schema#subClassOf"),
						namedNode("http://ex.com/o")
					)
				]
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);
			expect(nodes.every((n) => n.nodeType === "class")).toBe(true);
		});

		it("typed inferred - resolves objectProperty type for rdfs:subPropertyOf subject and object", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						namedNode("http://ex.com/s"),
						namedNode("http://www.w3.org/2000/01/rdf-schema#subPropertyOf"),
						namedNode("http://ex.com/o")
					)
				]
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);
			expect(nodes.every((n) => n.nodeType === "objectProperty")).toBe(true);
		});

		it("typed inferred - resolves objectProperty on subject and class on object for rdfs:domain", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						namedNode("http://ex.com/p"),
						namedNode("http://www.w3.org/2000/01/rdf-schema#domain"),
						namedNode("http://ex.com/C")
					)
				]
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);

			const subject = nodes.find((n) => n.uri === "http://ex.com/p");
			expect(subject).toBeDefined();
			expect(subject!.nodeType).toBe("objectProperty");

			const object = nodes.find((n) => n.uri === "http://ex.com/C");
			expect(object).toBeDefined();
			expect(object!.nodeType).toBe("class");
		});

		it("typed inferred - resolves objectProperty on subject and class on object for rdfs:range", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						namedNode("http://ex.com/p"),
						namedNode("http://www.w3.org/2000/01/rdf-schema#range"),
						namedNode("http://ex.com/C")
					)
				]
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);

			const subject = nodes.find((n) => n.uri === "http://ex.com/p");
			expect(subject).toBeDefined();
			expect(subject!.nodeType).toBe("objectProperty");

			const object = nodes.find((n) => n.uri === "http://ex.com/C");
			expect(object).toBeDefined();
			expect(object!.nodeType).toBe("class");
		});

		it("typed explicit - preserves explicit type when inference would differ", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						namedNode("http://ex.com/I"),
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
						namedNode("http://www.w3.org/2002/07/owl#NamedIndividual")
					),
					quad(
						namedNode("http://ex.com/I"),
						namedNode("http://www.w3.org/2000/01/rdf-schema#subClassOf"),
						namedNode("http://ex.com/P")
					)
				]
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);

			const subject = nodes.find((n) => n.uri === "http://ex.com/I");
			expect(subject).toBeDefined();
			expect(subject!.nodeType).toBe("instance");

			const object = nodes.find((n) => n.uri === "http://ex.com/P");
			expect(object).toBeDefined();
			expect(object!.nodeType).toBe("class");
		});
	});

	describe("settings", () => {
		it("setting class hidden - remove untyped subject by class fallback", () => {
			const { nodes, edges } = build({
				triples: [
					quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o"))
				],
				settings: { hiddenEntityTypes: ["class"] }
			});

			expect(nodes).toHaveLength(0);
			expect(edges).toHaveLength(0);
		});

		it("setting class hidden - remove typed class subject by class type", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						namedNode("http://ex.com/s"),
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
						namedNode("http://www.w3.org/2002/07/owl#Class")
					),
					quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o"))
				],
				settings: { hiddenEntityTypes: ["class"] }
			});

			expect(nodes).toHaveLength(0);
			expect(edges).toHaveLength(0);
		});

		it("setting instance hidden - remove typed instance subject by instance type", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						namedNode("http://ex.com/s"),
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
						namedNode("http://www.w3.org/2002/07/owl#NamedIndividual")
					),
					quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o"))
				],
				settings: { hiddenEntityTypes: ["instance"] }
			});

			expect(nodes).toHaveLength(0); // external object also removed
			expect(edges).toHaveLength(0);
		});

		it("setting instance hidden - preserve untyped subject by class fallback", () => {
			const { nodes, edges } = build({
				triples: [
					quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o"))
				],
				settings: { hiddenEntityTypes: ["instance"] }
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);

			expect(nodes.find((n) => n.uri === "http://ex.com/s")).toBeDefined();
			expect(nodes.find((n) => n.uri === "http://ex.com/o")).toBeDefined();
		});

		it("setting predicate hidden - remove edge and object", () => {
			const { nodes, edges } = build({
				triples: [
					quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o"))
				],
				settings: { hiddenPredicateUris: ["http://ex.com/p"] }
			});

			expect(nodes).toHaveLength(1);
			expect(edges).toHaveLength(0);

			expect(nodes[0].uri).toBe("http://ex.com/s");
		});

		it("setting namespace hidden - remove subject in hidden namespace along with external object", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#foo"),
						namedNode("http://ex.com/p"),
						namedNode("http://ex.com/o")
					)
				]
			});

			expect(nodes).toHaveLength(0);
			expect(edges).toHaveLength(0);
		});

		it("setting namespace hidden - remove object in hidden namespace but preserve subject", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						namedNode("http://ex.com/s"),
						namedNode("http://ex.com/p"),
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#foo")
					)
				]
			});

			expect(nodes).toHaveLength(1);
			expect(edges).toHaveLength(0);

			expect(nodes[0].uri).toBe("http://ex.com/s");
		});

		it("setting instanceOf hidden - remove typed subject along with object", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						namedNode("http://ex.com/s"),
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
						namedNode("http://www.w3.org/2002/07/owl#Ontology")
					),
					quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o"))
				]
			});

			expect(nodes).toHaveLength(0);
			expect(edges).toHaveLength(0);
		});

		it("setting instanceOf hidden - remove typed subject by custom filter along with object", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						namedNode("http://ex.com/s"),
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
						namedNode("http://ex.com/CustomType")
					),
					quad(namedNode("http://ex.com/s"), namedNode("http://ex.com/p"), namedNode("http://ex.com/o")),
					quad(namedNode("http://ex.com/s2"), namedNode("http://ex.com/p"), namedNode("http://ex.com/s"))
				],
				settings: { hiddenInstanceOfUris: ["http://ex.com/CustomType"] }
			});

			expect(nodes).toHaveLength(1);
			expect(edges).toHaveLength(0);

			expect(nodes[0].uri).toBe("http://ex.com/s2");
		});
	});

	describe("editing", () => {
		it("duplicate external node unrelated - preserve duplicate external node position when another is inserted in front", () => {
			const base = `@prefix ex: <http://ex.com/> .\nex:A ex:knows ex:Person .`;
			const modified = `@prefix ex: <http://ex.com/> .\nex:B ex:knows ex:Person .\nex:A ex:knows ex:Person .`;

			const graph1 = build({
				triples: parseTurtle(base).triples,
				settings: { hiddenEntityTypes: [], duplicateExternalNodes: true }
			});
			const externalNode1 = graph1.nodes.find((n) => n.external)!;

			const graph2 = build({
				triples: parseTurtle(modified).triples,
				settings: { hiddenEntityTypes: [], duplicateExternalNodes: true },
				existingNodes: [{ uri: externalNode1.uri, x: externalNode1.x, y: externalNode1.y }]
			});

			const externalNode2 = graph2.nodes.find((n) => n.uri === externalNode1.uri);
			expect(externalNode2).toBeDefined();
			expect(externalNode2!.x).toBe(externalNode1.x);
			expect(externalNode2!.y).toBe(externalNode1.y);
		});
	});
});
