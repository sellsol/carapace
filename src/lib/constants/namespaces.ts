import type { CollectionType, EntityType } from "$lib/types/graph";

export const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
export const OWL_NS = "http://www.w3.org/2002/07/owl#";
export const XSD_NS = "http://www.w3.org/2001/XMLSchema#";

export const BUILTIN_NS_TO_PREFIX: Record<string, string> = {
	[RDF_NS]: "rdf",
	[RDFS_NS]: "rdfs",
	[OWL_NS]: "owl",
	[XSD_NS]: "xsd"
};
export const BUILTIN_PREFIX_TO_NS: Record<string, string> = {
	rdf: RDF_NS,
	rdfs: RDFS_NS,
	owl: OWL_NS,
	xsd: XSD_NS
};

export const TYPE_PREDICATES: ReadonlySet<string> = new Set([RDF_NS + "type", "a"]);
export const BUILTIN_INSTANCES: ReadonlySet<string> = new Set([OWL_NS + "NamedIndividual"]);
export const BUILTIN_DATATYPES: ReadonlySet<string> = new Set([RDFS_NS + "Datatype"]);

export const BUILTIN_URI_TO_PROPERTY: ReadonlyMap<string, EntityType> = new Map([
	[RDF_NS + "Property", "objectProperty"],
	[OWL_NS + "ObjectProperty", "objectProperty"],
	[OWL_NS + "DatatypeProperty", "dataProperty"],
	[OWL_NS + "AnnotationProperty", "annotationProperty"],
	[OWL_NS + "FunctionalProperty", "objectProperty"],
	[OWL_NS + "TransitiveProperty", "objectProperty"],
	[OWL_NS + "SymmetricProperty", "objectProperty"],
	[OWL_NS + "AsymmetricProperty", "objectProperty"],
	[OWL_NS + "ReflexiveProperty", "objectProperty"],
	[OWL_NS + "IrreflexiveProperty", "objectProperty"],
	[OWL_NS + "OntologyProperty", "annotationProperty"]
]);

export const INFERRED_TYPES: ReadonlyMap<string, { subjectType: EntityType; objectType: EntityType }> = new Map([
	[RDFS_NS + "subClassOf", { subjectType: "class", objectType: "class" }],
	[RDFS_NS + "subPropertyOf", { subjectType: "objectProperty", objectType: "objectProperty" }],
	[RDFS_NS + "domain", { subjectType: "objectProperty", objectType: "class" }],
	[RDFS_NS + "range", { subjectType: "objectProperty", objectType: "class" }]
]);

export const RDF_FIRST = RDF_NS + "first";
export const RDF_REST = RDF_NS + "rest";
export const RDF_NIL = RDF_NS + "nil";
export const RDF_LIST = RDF_NS + "List";

export const OWL_UNION_OF = OWL_NS + "unionOf";
export const OWL_INTERSECTION_OF = OWL_NS + "intersectionOf";
export const OWL_ONE_OF = OWL_NS + "oneOf";

export const PREDICATE_TO_COLLECTION: ReadonlyMap<string, CollectionType> = new Map([
	[OWL_UNION_OF, "union"],
	[OWL_INTERSECTION_OF, "intersection"],
	[OWL_ONE_OF, "enumeration"]
]);
export const COLLECTION_TO_PREDICATE: ReadonlyMap<CollectionType, string> = new Map([
	["list", ""],
	["union", OWL_UNION_OF],
	["intersection", OWL_INTERSECTION_OF],
	["enumeration", OWL_ONE_OF]
]);
