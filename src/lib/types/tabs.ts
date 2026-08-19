import type { Quad } from "n3";

import type { EntityType } from "$lib/types/graph";
import type { LineMapping } from "$lib/utils/lines";

export type GraphSettings = {
	duplicateExternalNodes: boolean;
	hiddenNamespaces: string[];
	hiddenEntityTypes: EntityType[];
	hiddenPredicateUris: string[];
	hiddenInstanceOfUris: string[];
	nodeNamePredicate: string;
};

export type Tab = {
	id: string;
	name: string;

	ttlContent: string;
	parsedTriples?: Quad[];
	parsedPrefixMap?: Record<string, string>;
	nodePositions?: Array<{ id: string; x: number; y: number; nodeType?: EntityType }>;
	lineMapping?: LineMapping;

	settings: GraphSettings;
	locked: boolean;

	camera?: { x: number; y: number; k: number };
	editorCursorLine?: number;
};
