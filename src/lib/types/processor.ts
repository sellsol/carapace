import type { CollectionType, EntityType } from "$lib/types/graph";

export class NodeDescriptor {
	nodeType: EntityType | null = null;
	isSubject = false;
	isLocal = false;
	isHidden = false;
	isBlank = false;
	isList = false;

	isChain = false;
	chainFirst: string | null = null;
	chainFirstType: string | null = null;
	chainNext: string | null = null;
	isChainRest = false;

	isCollection = false;
	collectionType: CollectionType | null = null;
	collectionSource: string | null = null;

	isBridge = true;
	bridgeTarget: string | null = null;
}

export interface CollectionDescriptor {
	headUri: string;
	collectionType: CollectionType;
	members: { uri: string; type: string }[];
}
