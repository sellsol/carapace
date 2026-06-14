export type EntityType =
	| "class"
	| "datatype"
	| "objectProperty"
	| "dataProperty"
	| "annotationProperty"
	| "instance"
	| "literal"
	| "blank"
	| "list";

export type CollectionType = "list" | "union" | "intersection" | "enumeration";

export type Node = {
	id: string;
	uri: string;
	prefix: string | null;
	label: string;

	x: number;
	y: number;
	width: number;
	height: number;
	bodyLines: string[];
	badgeWidth: number;

	nodeType: EntityType;
	external: boolean;
	blank: boolean;
	collection: boolean;
	collectionType: CollectionType | null;
};

export type Edge = {
	id: string;
	source: Node;
	target: Node;
	prefix: string | null;
	label: string;

	collectionEdge: boolean;
};
