export type EntityType =
	| "class"
	| "datatype"
	| "objectProperty"
	| "dataProperty"
	| "annotationProperty"
	| "instance"
	| "literal"
	| "blank";

export type Node = {
	id: string;
	uri: string;
	label: string;
	prefix: string | null;
	nodeType: EntityType;
	external: boolean;
	blank: boolean;
	x: number;
	y: number;
	width: number;
	height: number;
	bodyLines: string[];
	badgeWidth: number;
};

export type Edge = {
	id: string;
	source: Node;
	target: Node;
	label: string;
	prefix: string | null;
};
