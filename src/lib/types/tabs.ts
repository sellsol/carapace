import type { Quad } from "n3";

import type { EntityType } from "$lib/types/graph";

export type GraphSettings = {
	duplicateExternalNodes: boolean;
	// showLabels: boolean; // TODO: add back later with synx to hiddenPredicateUris
	hiddenNamespaces: string[];
	hiddenEntityTypes: EntityType[];
	hiddenPredicateUris: string[];
	hiddenInstanceOfUris: string[];
};

export type Tab = {
	id: string;
	name: string;
	ttlContent: string;
	parsedTriples?: Quad[];
	parsedPrefixMap?: Record<string, string>;
	settings: GraphSettings;
	locked: boolean;
	nodePositions?: Array<{ id: string; x: number; y: number; nodeType?: EntityType }>;
	camera?: { x: number; y: number; k: number };
};
