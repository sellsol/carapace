import { DataFactory, Quad, Writer } from "n3";

const { namedNode, blankNode, literal, quad } = DataFactory;

const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
const OWL_NS = "http://www.w3.org/2002/07/owl#";
const XSD_NS = "http://www.w3.org/2001/XMLSchema#";

const constants: Record<string, string> = {
	RDF_NS,
	RDFS_NS,
	OWL_NS,
	XSD_NS,
	RDF_FIRST: RDF_NS + "first",
	RDF_REST: RDF_NS + "rest",
	RDF_NIL: RDF_NS + "nil",
	RDF_TYPE: RDF_NS + "type",
	RDF_LIST: RDF_NS + "List",
	OWL_UNION_OF: OWL_NS + "unionOf",
	OWL_INTERSECTION_OF: OWL_NS + "intersectionOf",
	OWL_ONE_OF: OWL_NS + "oneOf",
	OWL_CLASS: OWL_NS + "Class",
	OWL_THING: OWL_NS + "Thing",
	OWL_NAMED_INDIVIDUAL: OWL_NS + "NamedIndividual",
	OWL_ONTOLOGY: OWL_NS + "Ontology",
	RDFS_SUBCLASS_OF: RDFS_NS + "subClassOf",
	RDFS_SUBPROPERTY_OF: RDFS_NS + "subPropertyOf",
	RDFS_DOMAIN: RDFS_NS + "domain",
	RDFS_RANGE: RDFS_NS + "range",
	RDFS_LABEL: RDFS_NS + "label"
};

const input = process.argv.slice(2).join(" ");
const paramNames = ["namedNode", "blankNode", "literal", "quad", ...Object.keys(constants)];
const paramValues = [namedNode, blankNode, literal, quad, ...Object.values(constants)];
const triples: ReturnType<typeof quad>[] = new Function(...paramNames, `return [${input}];`)(...paramValues);

const writer = new Writer({ format: "text/turtle" });
triples.forEach((t) => writer.addQuad(t as Quad));
writer.end((_, result) => console.log("\n" + result));
