import type { Quad } from "n3";

import { RDF_FIRST, RDF_NIL } from "$lib/constants/namespaces";
import { BLANK_NODE_RADIUS, CANVAS_HEIGHT, CANVAS_WIDTH, COLLECTION_NODE_RADIUS } from "$lib/constants/visualisation";
import type { CollectionType, Edge, EntityType, Node } from "$lib/types/graph";
import type { CollectionDescriptor } from "$lib/types/processor";
import type { NodeDescriptor } from "$lib/types/processor";
import type { GraphSettings } from "$lib/types/tabs";
import { measureBlankNodeDimensions, measureNodeDimensions } from "$lib/utils/layout";
import { classifyUriType, resolveLocalName, resolvePrefix } from "$lib/utils/ontology";
import { inHiddenNamespace } from "$lib/utils/settings";

export class Builder {
	settings: GraphSettings;
	namespacePrefixes: Record<string, string>;
	cachedPositions: Map<string, { x: number; y: number }[]>;
	literalGroups: Map<string, { value: string; position: { x: number; y: number }; claimed: boolean }[]>;

	triples: Quad[];
	nodeDescriptors: Map<string, NodeDescriptor>;
	collectionDescriptors: CollectionDescriptor[];

	edges: Edge[] = [];
	uriToNode = new Map<string, Node>();
	nextNodeId = 0;
	nextExternalId = 0;

	constructor(
		settings: GraphSettings,
		namespacePrefixes: Record<string, string>,
		cachedPositions: Map<string, { x: number; y: number }[]>,
		literalGroups: Map<string, { value: string; position: { x: number; y: number }; claimed: boolean }[]>,
		triples: Quad[],
		nodeDescriptors: Map<string, NodeDescriptor>,
		collectionDescriptors: CollectionDescriptor[]
	) {
		this.settings = settings;
		this.namespacePrefixes = namespacePrefixes;
		this.cachedPositions = cachedPositions;
		this.literalGroups = literalGroups;
		this.triples = triples;
		this.nodeDescriptors = nodeDescriptors;
		this.collectionDescriptors = collectionDescriptors;
	}

	build(): { nodes: Node[]; edges: Edge[] } {
		this.processCollections();
		this.processRelations();

		return {
			nodes: Array.from(this.uriToNode.values()),
			edges: this.edges
		};
	}

	private processCollections() {
		for (const descriptor of this.collectionDescriptors) {
			if (this.settings.hiddenEntityTypes.includes("blank")) continue;

			const collectionNode = this.addCollectionNode(descriptor.headUri, descriptor.collectionType);

			for (const member of descriptor.members) {
				if (member.uri === RDF_NIL) continue;

				let memberNode: Node;
				if (member.type === "BlankNode") {
					memberNode = this.addBlankNode(member.uri);
				} else if (member.type === "Literal") {
					memberNode = this.addLiteralNode(member.uri, member.subjectUri, RDF_FIRST);
				} else {
					memberNode = this.addNode(member.uri);
				}

				this.addCollectionEdge(collectionNode, memberNode);
			}
		}
	}

	private processRelations() {
		for (const quad of this.triples) {
			const subjectDescriptor = this.nodeDescriptors.get(quad.subject.value);

			if (subjectDescriptor?.isChain) continue;
			if (subjectDescriptor?.isBlank && subjectDescriptor?.isBridge) continue;

			const subjectType =
				subjectDescriptor?.nodeType ??
				classifyUriType(quad.subject.value) ??
				(quad.subject.termType === "BlankNode" ? "blank" : "class");
			if (inHiddenNamespace(quad.subject.value) || subjectDescriptor?.isHidden) continue;
			if (this.settings.hiddenEntityTypes.includes("blank") && quad.subject.termType === "BlankNode") continue;
			if (this.settings.hiddenEntityTypes.includes(subjectType)) continue;

			// Create source node
			let source: Node;
			if (quad.subject.termType === "BlankNode") {
				source = this.addBlankNode(quad.subject.value);
			} else {
				source = this.addNode(quad.subject.value);
			}

			// Create edge and target node
			if (this.settings.hiddenPredicateUris.includes(quad.predicate.value)) continue;
			if (quad.object.termType === "BlankNode") {
				if (this.settings.hiddenEntityTypes.includes("blank")) continue;

				const objectDescriptor = this.nodeDescriptors.get(quad.object.value);

				let objectUri = quad.object.value;
				if (objectDescriptor?.isBridge && objectDescriptor.bridgeTarget) {
					objectUri = objectDescriptor.bridgeTarget;
				}

				const target: Node = this.addBlankNode(objectUri);
				this.addEdge(source, target, quad.predicate.value);
			} else if (quad.object.termType === "Literal") {
				if (this.settings.hiddenEntityTypes.includes("literal")) continue;

				const target: Node = this.addLiteralNode(quad.object.value, quad.subject.value, quad.predicate.value);
				this.addEdge(source, target, quad.predicate.value);
			} else {
				const objectDescriptor = this.nodeDescriptors.get(quad.object.value);
				if (inHiddenNamespace(quad.object.value) || objectDescriptor?.isHidden) continue;

				const objectType = objectDescriptor?.nodeType ?? classifyUriType(quad.object.value) ?? "class";
				if (this.settings.hiddenEntityTypes.includes(objectType)) continue;

				let target: Node;
				if (this.settings.duplicateExternalNodes && !objectDescriptor?.isLocal) {
					target = this.addExternalNode(quad.object.value, objectType);
				} else {
					target = this.addNode(quad.object.value);
				}
				this.addEdge(source, target, quad.predicate.value);
			}
		}
	}

	private addNode(uri: string): Node {
		if (this.uriToNode.has(uri)) return this.uriToNode.get(uri)!;

		const descriptor = this.nodeDescriptors.get(uri);
		const type = descriptor?.nodeType ?? classifyUriType(uri) ?? "class";
		const label = resolveLocalName(uri);
		const prefix = resolvePrefix(uri, this.namespacePrefixes);
		const position = this.cachedPositions.get(uri)?.shift();
		const dimensions = measureNodeDimensions(label, prefix, type, false);

		const node: Node = {
			id: `node-${this.nextNodeId++}`,
			uri,
			label,
			prefix,
			nodeType: type,
			external: type !== "literal" && !descriptor?.isSubject,
			blank: false,
			collection: false,
			collectionType: null,
			x: position ? position.x : Math.random() * CANVAS_WIDTH,
			y: position ? position.y : Math.random() * CANVAS_HEIGHT,
			width: dimensions.width,
			height: dimensions.height,
			bodyLines: dimensions.bodyLines,
			badgeWidth: dimensions.badgeWidth
		};
		this.uriToNode.set(uri, node);
		return node;
	}

	private addBlankNode(uri: string): Node {
		if (this.uriToNode.has(uri)) return this.uriToNode.get(uri)!;

		const position = this.cachedPositions.get(uri)?.shift();
		const descriptor = this.nodeDescriptors.get(uri);

		if (descriptor?.nodeType) {
			const dimensions = measureBlankNodeDimensions(descriptor.nodeType);

			const node: Node = {
				id: `node-${this.nextNodeId++}`,
				uri,
				label: "",
				prefix: null,
				nodeType: descriptor.nodeType,
				external: !descriptor.isSubject,
				blank: true,
				collection: false,
				collectionType: null,
				x: position ? position.x : Math.random() * CANVAS_WIDTH,
				y: position ? position.y : Math.random() * CANVAS_HEIGHT,
				width: dimensions.width,
				height: dimensions.height,
				bodyLines: [],
				badgeWidth: 0
			};
			this.uriToNode.set(uri, node);
			return node;
		} else {
			const diameter = BLANK_NODE_RADIUS * 2;

			const node: Node = {
				id: `node-${this.nextNodeId++}`,
				uri,
				label: "",
				prefix: null,
				nodeType: "blank",
				external: !descriptor?.isSubject,
				blank: true,
				collection: false,
				collectionType: null,
				x: position ? position.x : Math.random() * CANVAS_WIDTH,
				y: position ? position.y : Math.random() * CANVAS_HEIGHT,
				width: diameter,
				height: diameter,
				bodyLines: [],
				badgeWidth: 0
			};
			this.uriToNode.set(uri, node);
			return node;
		}
	}

	private addCollectionNode(uri: string, collectionType: CollectionType): Node {
		if (this.uriToNode.has(uri)) return this.uriToNode.get(uri)!;

		const position = this.cachedPositions.get(uri)?.shift();
		const diameter = COLLECTION_NODE_RADIUS * 2;

		const node: Node = {
			id: `node-${this.nextNodeId++}`,
			uri,
			label: "",
			prefix: null,
			nodeType: "list",
			external: !this.nodeDescriptors.get(uri)?.isSubject,
			blank: true,
			collection: true,
			collectionType,
			x: position ? position.x : Math.random() * CANVAS_WIDTH,
			y: position ? position.y : Math.random() * CANVAS_HEIGHT,
			width: diameter,
			height: diameter,
			bodyLines: [],
			badgeWidth: 0
		};
		this.uriToNode.set(uri, node);
		return node;
	}

	private addLiteralNode(value: string, subjectUri: string, predicateUri: string): Node {
		const key = `${subjectUri}|${predicateUri}|${value}`;
		const groupKey = `${subjectUri}|${predicateUri}`;

		let position = this.cachedPositions.get(key)?.shift();
		if (!position) {
			const candidatePositions = this.literalGroups.get(groupKey);
			if (candidatePositions) {
				const unclaimed = candidatePositions.find((c) => !c.claimed);
				if (unclaimed) {
					unclaimed.claimed = true;
					position = unclaimed.position;
				}
			}
		}

		const dimensions = measureNodeDimensions(value, null, "literal", false);

		const node: Node = {
			id: `node-${this.nextNodeId++}`,
			uri: key,
			label: value,
			prefix: null,
			nodeType: "literal",
			external: false,
			blank: false,
			collection: false,
			collectionType: null,
			x: position ? position.x : Math.random() * CANVAS_WIDTH,
			y: position ? position.y : Math.random() * CANVAS_HEIGHT,
			width: dimensions.width,
			height: dimensions.height,
			bodyLines: dimensions.bodyLines,
			badgeWidth: dimensions.badgeWidth
		};
		this.uriToNode.set(key, node);
		return node;
	}

	private addExternalNode(uri: string, type: EntityType): Node {
		const key = `ext-${this.nextExternalId++}`;
		const label = resolveLocalName(uri);
		const prefix = resolvePrefix(uri, this.namespacePrefixes);
		const position = this.cachedPositions.get(key)?.shift();
		const dimensions = measureNodeDimensions(label, prefix, type, false);

		const node: Node = {
			id: `node-${this.nextNodeId++}`,
			uri,
			label,
			prefix,
			nodeType: type,
			external: true,
			blank: false,
			collection: false,
			collectionType: null,
			x: position ? position.x : Math.random() * CANVAS_WIDTH,
			y: position ? position.y : Math.random() * CANVAS_HEIGHT,
			width: dimensions.width,
			height: dimensions.height,
			bodyLines: dimensions.bodyLines,
			badgeWidth: dimensions.badgeWidth
		};
		this.uriToNode.set(key, node);
		return node;
	}

	private addEdge(source: Node, target: Node, predicateUri: string) {
		const prefix = resolvePrefix(predicateUri, this.namespacePrefixes);

		const edge: Edge = {
			id: `edge-${this.edges.length}`,
			source,
			target,
			label: resolveLocalName(predicateUri),
			prefix,
			collectionEdge: false
		};
		this.edges.push(edge);
	}

	private addCollectionEdge(source: Node, target: Node) {
		const edge: Edge = {
			id: `edge-${this.edges.length}`,
			source,
			target,
			label: "",
			prefix: null,
			collectionEdge: true
		};
		this.edges.push(edge);
	}
}
