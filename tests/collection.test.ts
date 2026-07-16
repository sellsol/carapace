import { describe, expect, it, vi } from "vitest";

import { DataFactory, build } from "./helpers";

vi.mock("$lib/utils/settings", () => {
	const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
	const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
	const OWL_NS = "http://www.w3.org/2002/07/owl#";

	return {
		inHiddenNamespace: (uri: string) => uri.startsWith(RDF_NS) || uri.startsWith(RDFS_NS) || uri.startsWith(OWL_NS)
	};
});

const RDF_FIRST = "http://www.w3.org/1999/02/22-rdf-syntax-ns#first";
const RDF_REST = "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest";
const RDF_NIL = "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil";
const OWL_UNION_OF = "http://www.w3.org/2002/07/owl#unionOf";
const OWL_INTERSECTION_OF = "http://www.w3.org/2002/07/owl#intersectionOf";
const OWL_ONE_OF = "http://www.w3.org/2002/07/owl#oneOf";

const { namedNode, blankNode, literal, quad } = DataFactory;

describe("collection nodes", () => {
	describe("lists", () => {
		it("simple list - creates collection node with multiple members from rdf:first/rdf:rest chain", () => {
			const { nodes, edges } = build({
				triples: [
					quad(blankNode("l1"), namedNode(RDF_FIRST), namedNode("http://ex.com/A")),
					quad(blankNode("l1"), namedNode(RDF_REST), blankNode("l2")),
					quad(blankNode("l2"), namedNode(RDF_FIRST), namedNode("http://ex.com/B")),
					quad(blankNode("l2"), namedNode(RDF_REST), blankNode("l3")),
					quad(blankNode("l3"), namedNode(RDF_FIRST), namedNode("http://ex.com/C")),
					quad(blankNode("l3"), namedNode(RDF_REST), namedNode(RDF_NIL))
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(4);
			expect(edges).toHaveLength(3);

			const collectionNodes = nodes.filter((n) => n.collection === true);
			expect(collectionNodes).toHaveLength(1);
			expect(nodes.find((n) => n.uri === RDF_NIL)).toBeUndefined();

			const col = collectionNodes[0];
			expect(col.blank).toBe(true);
			expect(col.nodeType).toBe("list");
			expect(col.collectionType).toBe("list");
			expect(col.label).toBe("");
			expect(col.prefix).toBeNull();
			expect(col.external).toBe(false);

			const memberUris = ["http://ex.com/A", "http://ex.com/B", "http://ex.com/C"];
			for (const uri of memberUris) {
				expect(nodes.find((n) => n.uri === uri)).toBeDefined();
			}

			for (const edge of edges) {
				expect(edge.collectionEdge).toBe(true);
				expect(edge.source.uri).toBe(col.uri);
			}
		});

		it("single element list - creates collection node with one member", () => {
			const { nodes, edges } = build({
				triples: [
					quad(blankNode("l1"), namedNode(RDF_FIRST), namedNode("http://ex.com/A")),
					quad(blankNode("l1"), namedNode(RDF_REST), namedNode(RDF_NIL))
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);

			const collectionNodes = nodes.filter((n) => n.collection === true);
			expect(collectionNodes).toHaveLength(1);

			expect(edges[0].collectionEdge).toBe(true);
			expect(edges[0].target.uri).toBe("http://ex.com/A");
		});

		it("empty list - creates collection node with no members", () => {
			const { nodes, edges } = build({
				triples: [
					quad(blankNode("l1"), namedNode(RDF_FIRST), namedNode(RDF_NIL)),
					quad(blankNode("l1"), namedNode(RDF_REST), namedNode(RDF_NIL))
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(1);
			expect(edges).toHaveLength(0);

			const collectionNodes = nodes.filter((n) => n.collection === true);
			expect(collectionNodes).toHaveLength(1);
			expect(nodes.find((n) => n.uri === RDF_NIL)).toBeUndefined();
		});

		it("two separate lists - creates two independent collection nodes", () => {
			const { nodes, edges } = build({
				triples: [
					quad(blankNode("a1"), namedNode(RDF_FIRST), namedNode("http://ex.com/A")),
					quad(blankNode("a1"), namedNode(RDF_REST), blankNode("a2")),
					quad(blankNode("a2"), namedNode(RDF_FIRST), namedNode("http://ex.com/B")),
					quad(blankNode("a2"), namedNode(RDF_REST), namedNode(RDF_NIL)),
					quad(blankNode("b1"), namedNode(RDF_FIRST), namedNode("http://ex.com/C")),
					quad(blankNode("b1"), namedNode(RDF_REST), namedNode(RDF_NIL))
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(5);
			expect(edges).toHaveLength(3);

			const collectionNodes = nodes.filter((n) => n.collection === true);
			expect(collectionNodes).toHaveLength(2);
			expect(collectionNodes[0].uri).not.toBe(collectionNodes[1].uri);

			const memberUris = ["http://ex.com/A", "http://ex.com/B", "http://ex.com/C"];
			for (const uri of memberUris) {
				expect(nodes.find((n) => n.uri === uri)).toBeDefined();
			}
		});
	});

	describe("collections", () => {
		it("simple union collection - creates collection node with type union", () => {
			const { nodes, edges } = build({
				triples: [
					quad(namedNode("http://ex.com/C"), namedNode(OWL_UNION_OF), blankNode("l1")),
					quad(blankNode("l1"), namedNode(RDF_FIRST), namedNode("http://ex.com/A")),
					quad(blankNode("l1"), namedNode(RDF_REST), blankNode("l2")),
					quad(blankNode("l2"), namedNode(RDF_FIRST), namedNode("http://ex.com/B")),
					quad(blankNode("l2"), namedNode(RDF_REST), namedNode(RDF_NIL))
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(4);
			expect(edges).toHaveLength(3);

			expect(nodes.find((n) => n.uri === "http://ex.com/C")).toBeDefined();
			expect(nodes.find((n) => n.uri === "http://ex.com/A")).toBeDefined();
			expect(nodes.find((n) => n.uri === "http://ex.com/B")).toBeDefined();

			const collectionNodes = nodes.filter((n) => n.collection === true);
			expect(collectionNodes).toHaveLength(1);

			expect(collectionNodes[0].blank).toBe(true);
			expect(collectionNodes[0].nodeType).toBe("list");
			expect(collectionNodes[0].collectionType).toBe("union");
			expect(collectionNodes[0].label).toBe("");
			expect(collectionNodes[0].prefix).toBeNull();
			expect(collectionNodes[0].external).toBe(false);

			const relationEdge = edges.find((e) => !e.collectionEdge);
			expect(relationEdge).toBeDefined();
			expect(relationEdge!.source.uri).toBe("http://ex.com/C");
			expect(relationEdge!.target.uri).toBe(collectionNodes[0].uri);
			expect(relationEdge!.label).toBe("unionOf");
		});

		it("simple intersection collection - creates collection node with collectionType intersection", () => {
			const { nodes, edges } = build({
				triples: [
					quad(namedNode("http://ex.com/C"), namedNode(OWL_INTERSECTION_OF), blankNode("l1")),
					quad(blankNode("l1"), namedNode(RDF_FIRST), namedNode("http://ex.com/A")),
					quad(blankNode("l1"), namedNode(RDF_REST), blankNode("l2")),
					quad(blankNode("l2"), namedNode(RDF_FIRST), namedNode("http://ex.com/B")),
					quad(blankNode("l2"), namedNode(RDF_REST), namedNode(RDF_NIL))
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(4);
			expect(edges).toHaveLength(3);

			const collectionNodes = nodes.filter((n) => n.collection === true);
			expect(collectionNodes).toHaveLength(1);
			expect(collectionNodes[0].collectionType).toBe("intersection");
		});

		it("simple enumeration collection - creates collection node with collectionType enumeration", () => {
			const { nodes, edges } = build({
				triples: [
					quad(namedNode("http://ex.com/C"), namedNode(OWL_ONE_OF), blankNode("l1")),
					quad(blankNode("l1"), namedNode(RDF_FIRST), namedNode("http://ex.com/A")),
					quad(blankNode("l1"), namedNode(RDF_REST), blankNode("l2")),
					quad(blankNode("l2"), namedNode(RDF_FIRST), namedNode("http://ex.com/B")),
					quad(blankNode("l2"), namedNode(RDF_REST), namedNode(RDF_NIL))
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(4);
			expect(edges).toHaveLength(3);

			const collectionNodes = nodes.filter((n) => n.collection === true);
			expect(collectionNodes).toHaveLength(1);
			expect(collectionNodes[0].collectionType).toBe("enumeration");
		});
	});

	describe("members", () => {
		it("literal member - creates literal node as list member", () => {
			const { nodes, edges } = build({
				triples: [
					quad(blankNode("l1"), namedNode(RDF_FIRST), literal("hello")),
					quad(blankNode("l1"), namedNode(RDF_REST), namedNode(RDF_NIL))
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);

			const collectionNodes = nodes.filter((n) => n.collection === true);
			expect(collectionNodes).toHaveLength(1);

			const memberLiterals = nodes.filter((n) => n.nodeType === "literal" && n.collection === false);
			expect(memberLiterals).toHaveLength(1);
			expect(memberLiterals[0].label).toBe("hello");

			expect(edges[0].collectionEdge).toBe(true);
			expect(edges[0].target.nodeType).toBe("literal");
		});

		it("blank member - creates blank node as list member", () => {
			const { nodes, edges } = build({
				triples: [
					quad(blankNode("l1"), namedNode(RDF_FIRST), blankNode("m1")),
					quad(blankNode("l1"), namedNode(RDF_REST), namedNode(RDF_NIL))
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);

			const collectionNodes = nodes.filter((n) => n.collection === true);
			expect(collectionNodes).toHaveLength(1);

			const memberBlanks = nodes.filter((n) => n.blank === true && n.collection === false);
			expect(memberBlanks).toHaveLength(1);
			expect(memberBlanks[0].uri).toBe("m1");
			expect(memberBlanks[0].nodeType).toBe("blank");

			expect(edges[0].collectionEdge).toBe(true);
			expect(edges[0].target.uri).toBe("m1");
		});

		it("typed blank member - creates typed blank node as member", () => {
			const { nodes, edges } = build({
				triples: [
					quad(blankNode("l1"), namedNode(RDF_FIRST), blankNode("m1")),
					quad(blankNode("l1"), namedNode(RDF_REST), namedNode(RDF_NIL)),
					quad(
						blankNode("m1"),
						namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),
						namedNode("http://www.w3.org/2002/07/owl#Class")
					)
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);

			const memberBlanks = nodes.filter((n) => n.blank === true && n.collection === false);
			expect(memberBlanks).toHaveLength(1);
			expect(memberBlanks[0].uri).toBe("m1");
			expect(memberBlanks[0].nodeType).toBe("class");
		});

		it("namespace-hidden member - creates member regardless of hidden namespace", () => {
			const { nodes, edges } = build({
				triples: [
					quad(blankNode("l1"), namedNode(RDF_FIRST), namedNode("http://www.w3.org/2002/07/owl#Thing")),
					quad(blankNode("l1"), namedNode(RDF_REST), namedNode(RDF_NIL))
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);

			const member = nodes.find((n) => n.uri === "http://www.w3.org/2002/07/owl#Thing");
			expect(member).toBeDefined();
			expect(member!.prefix).toBe("owl");
			expect(member!.label).toBe("Thing");

			expect(edges[0].collectionEdge).toBe(true);
			expect(edges[0].target.uri).toBe("http://www.w3.org/2002/07/owl#Thing");
		});
	});

	describe("bridges", () => {
		it("blank source object - removes bridge node and redirects edge target to collection node", () => {
			const { nodes, edges } = build({
				triples: [
					quad(
						namedNode("http://ex.com/C"),
						namedNode("http://www.w3.org/2000/01/rdf-schema#subClassOf"),
						blankNode("b1")
					),
					quad(blankNode("b1"), namedNode(OWL_INTERSECTION_OF), blankNode("l1")),
					quad(blankNode("l1"), namedNode(RDF_FIRST), namedNode("http://ex.com/Restriction")),
					quad(blankNode("l1"), namedNode(RDF_REST), namedNode(RDF_NIL))
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(3);
			expect(edges).toHaveLength(2);

			expect(nodes.find((n) => n.uri === "b1")).toBeUndefined();
			expect(nodes.find((n) => n.uri === "http://ex.com/C")).toBeDefined();
			expect(nodes.find((n) => n.uri === "http://ex.com/Restriction")).toBeDefined();

			const collectionNodes = nodes.filter((n) => n.collection === true);
			expect(collectionNodes).toHaveLength(1);
			expect(collectionNodes[0].collectionType).toBe("intersection");

			const relationEdge = edges.find((e) => !e.collectionEdge);
			expect(relationEdge).toBeDefined();
			expect(relationEdge!.source.uri).toBe("http://ex.com/C");
			expect(relationEdge!.target.uri).toBe(collectionNodes[0].uri);
			expect(relationEdge!.label).toBe("subClassOf");
		});

		// Note: Considering showing these as well, but hidden for now
		it("blank source subject - removes blank node and just shows collection", () => {
			const { nodes, edges } = build({
				triples: [
					quad(blankNode("b1"), namedNode(OWL_UNION_OF), blankNode("l1")),
					quad(blankNode("l1"), namedNode(RDF_FIRST), namedNode("http://ex.com/A")),
					quad(blankNode("l1"), namedNode(RDF_REST), namedNode(RDF_NIL))
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(2);
			expect(edges).toHaveLength(1);

			expect(nodes.find((n) => n.uri === "b1")).toBeUndefined();
			expect(nodes.find((n) => n.uri === "http://ex.com/A")).toBeDefined();

			const collectionNodes = nodes.filter((n) => n.collection === true);
			expect(collectionNodes).toHaveLength(1);
			expect(collectionNodes[0].collectionType).toBe("union");

			expect(edges[0].collectionEdge).toBe(true);
		});

		it("blank source subject - preserves blank node that has other predicates", () => {
			const { nodes, edges } = build({
				triples: [
					quad(blankNode("b1"), namedNode(OWL_UNION_OF), blankNode("l1")),
					quad(blankNode("l1"), namedNode(RDF_FIRST), namedNode("http://ex.com/A")),
					quad(blankNode("l1"), namedNode(RDF_REST), namedNode(RDF_NIL)),
					quad(blankNode("b1"), namedNode("http://www.w3.org/2000/01/rdf-schema#label"), literal("a union"))
				],
				settings: { hiddenEntityTypes: [] }
			});

			expect(nodes).toHaveLength(4);
			expect(edges).toHaveLength(3);

			const blank = nodes.find((n) => n.uri === "b1");
			expect(blank).toBeDefined();
			expect(blank!.blank).toBe(true);
			expect(blank!.nodeType).toBe("blank");
			expect(blank!.external).toBe(false);

			const collectionNodes = nodes.filter((n) => n.collection === true);
			expect(collectionNodes).toHaveLength(1);
			expect(collectionNodes[0].collectionType).toBe("union");

			expect(nodes.find((n) => n.uri === "http://ex.com/A")).toBeDefined();

			const literalNodes = nodes.filter((n) => n.nodeType === "literal");
			expect(literalNodes).toHaveLength(1);
			expect(literalNodes[0].label).toBe("a union");

			const relationEdges = edges.filter((e) => !e.collectionEdge);
			expect(relationEdges).toHaveLength(2);

			const unionEdge = relationEdges.find((e) => e.label === "unionOf");
			expect(unionEdge).toBeDefined();
			expect(unionEdge!.source.uri).toBe("b1");
			expect(unionEdge!.target.collection).toBe(true);

			const labelEdge = relationEdges.find((e) => e.label === "label");
			expect(labelEdge).toBeDefined();
			expect(labelEdge!.source.uri).toBe("b1");
			expect(labelEdge!.target.nodeType).toBe("literal");
		});
	});

	describe("settings", () => {
		it("setting blank hidden - removes list entirely", () => {
			const { nodes, edges } = build({
				triples: [
					quad(blankNode("l1"), namedNode(RDF_FIRST), namedNode("http://ex.com/A")),
					quad(blankNode("l1"), namedNode(RDF_REST), namedNode(RDF_NIL))
				]
			});

			expect(nodes).toHaveLength(0);
			expect(edges).toHaveLength(0);
		});

		it("setting blank hidden - removes collection but preserves named source", () => {
			const { nodes, edges } = build({
				triples: [
					quad(namedNode("http://ex.com/C"), namedNode(OWL_UNION_OF), blankNode("l1")),
					quad(blankNode("l1"), namedNode(RDF_FIRST), namedNode("http://ex.com/A")),
					quad(blankNode("l1"), namedNode(RDF_REST), namedNode(RDF_NIL))
				]
			});

			expect(nodes).toHaveLength(1);
			expect(edges).toHaveLength(0);
			expect(nodes[0].uri).toBe("http://ex.com/C");
		});
	});
});
