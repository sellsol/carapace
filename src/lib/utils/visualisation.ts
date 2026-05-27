import type { Quad } from "n3";

import { entityTypeLabel } from "$lib/constants/entity";
import { BUILTIN_INSTANCE, INFERRED_TYPES, TYPE_PREDICATE } from "$lib/constants/namespaces";
import {
	BLANK_NODE_RADIUS,
	CANVAS_HEIGHT,
	CANVAS_WIDTH,
	NODE_BADGE_FONT_SIZE,
	NODE_BADGE_PADDING_X,
	NODE_BODY_FONT_SIZE,
	NODE_BORDER_WIDTH,
	NODE_CONTENT_PADDING_X,
	NODE_CONTENT_PADDING_Y,
	NODE_HEADER_FONT_SIZE,
	NODE_HEADER_HEIGHT,
	NODE_LABEL_GAP,
	NODE_LINE_HEIGHT,
	NODE_MAX_WIDTH,
	NODE_MIN_WIDTH
} from "$lib/constants/visualisation";
import type { Edge, EntityType, Node } from "$lib/types/graph";
import type { GraphSettings } from "$lib/types/tabs";
import { classifyUriType, hasBuiltinPrefix, resolveLocalName, resolvePrefix } from "$lib/utils/ontology";
import { inHiddenNamespace } from "$lib/utils/settings";

let sharedCtx: CanvasRenderingContext2D | null = null;
function getSharedCtx(): CanvasRenderingContext2D | null {
	if (typeof document === "undefined") return null;

	if (sharedCtx) return sharedCtx;

	const canvas = document.createElement("canvas");
	sharedCtx = canvas.getContext("2d");
	return sharedCtx;
}

function measureCtxWidth(text: string, font: string, ctx: CanvasRenderingContext2D) {
	ctx.font = font;
	return Math.ceil(ctx.measureText(text).width);
}

function breakText(text: string, maxWidth: number, ctx: CanvasRenderingContext2D): string[] {
	const words = text.split(" ");
	const lines: string[] = [];
	let currentLine = "";

	for (const word of words) {
		if (measureCtxWidth(word, ctx.font, ctx) > maxWidth) {
			if (currentLine) lines.push(currentLine);

			let buf = "";
			for (const ch of word) {
				if (measureCtxWidth(buf + ch, ctx.font, ctx) > maxWidth) {
					if (buf) lines.push(buf);
					buf = ch;
				} else {
					buf += ch;
				}
			}
			currentLine = buf;
			continue;
		}

		const candidate = currentLine ? `${currentLine} ${word}` : word;
		if (measureCtxWidth(candidate, ctx.font, ctx) <= maxWidth) {
			currentLine = candidate;
		} else {
			if (currentLine) lines.push(currentLine);
			currentLine = word;
		}
	}

	if (currentLine) lines.push(currentLine);
	return lines.length > 0 ? lines : [text];
}

const NODE_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
function measureNodeDimensions(label: string, prefix: string | null, nodeType: EntityType, inferred: boolean) {
	const ctx = getSharedCtx();
	if (!ctx)
		return {
			width: NODE_MIN_WIDTH,
			height: NODE_HEADER_HEIGHT + NODE_CONTENT_PADDING_Y + NODE_LINE_HEIGHT + NODE_BORDER_WIDTH,
			bodyLines: [label],
			badgeWidth: 0
		};

	const headerFont = `bold ${NODE_HEADER_FONT_SIZE}px ${NODE_FONT_FAMILY}`;
	const bodyFont = `${NODE_BODY_FONT_SIZE}px ${NODE_FONT_FAMILY}`;
	const badgeFont = `${NODE_BADGE_FONT_SIZE}px ${NODE_FONT_FAMILY}`;

	const headerText = entityTypeLabel(nodeType, inferred);
	const headerWidth = measureCtxWidth(headerText, headerFont, ctx);

	const badgeTextWidth = prefix ? measureCtxWidth(prefix, badgeFont, ctx) : 0;
	const badgeWidth = prefix ? badgeTextWidth + NODE_BADGE_PADDING_X * 2 : 0;

	const textWidth = measureCtxWidth(label, bodyFont, ctx) + 5;
	const width = Math.min(
		NODE_MAX_WIDTH,
		Math.max(
			NODE_MIN_WIDTH,
			(prefix ? badgeWidth + NODE_LABEL_GAP : 0) + textWidth + NODE_CONTENT_PADDING_X + NODE_BORDER_WIDTH,
			headerWidth + NODE_CONTENT_PADDING_X
		)
	);

	const availableWidthFull = width - NODE_BORDER_WIDTH - NODE_CONTENT_PADDING_X;
	const availableWidthFirst = availableWidthFull - (prefix ? badgeWidth + NODE_LABEL_GAP : 0);

	ctx.font = bodyFont;
	const firstLines = breakText(label, availableWidthFirst, ctx);
	const bodyLines =
		firstLines.length > 1
			? [firstLines[0], ...breakText(firstLines.slice(1).join(" "), availableWidthFull, ctx)]
			: firstLines;

	const height =
		NODE_HEADER_HEIGHT + NODE_CONTENT_PADDING_Y + bodyLines.length * NODE_LINE_HEIGHT + NODE_BORDER_WIDTH;

	return { width, height, bodyLines, badgeWidth };
}

class GraphBuilder {
	uriToNode = new Map<string, Node>();
	edges: Edge[] = [];

	nodeIdCounter = 0;
	literalIdCounter = 0;
	externalIdCounter = 0;

	settings: GraphSettings;
	nsToPrefix: Record<string, string>;
	uriToCoords: Map<string, { x: number; y: number }[]>;
	uriToType = new Map<string, EntityType>();
	hiddenUris = new Set<string>();
	localUris = new Set<string>();
	inferredUris = new Set<string>();

	constructor(
		settings: GraphSettings,
		nsToPrefix: Record<string, string>,
		uriToCoords: Map<string, { x: number; y: number }[]>
	) {
		this.settings = settings;
		this.nsToPrefix = nsToPrefix;
		this.uriToCoords = uriToCoords;
	}

	classifyTriples(triples: Quad[]) {
		for (const quad of triples) {
			const subjectUri = quad.subject.value;
			const predicateUri = quad.predicate.value;
			const objectUri = quad.object.value;

			if (TYPE_PREDICATE.has(predicateUri)) {
				if (!hasBuiltinPrefix(subjectUri)) {
					this.localUris.add(subjectUri);
				}

				const objectType = BUILTIN_INSTANCE.has(objectUri) ? "instance" : classifyUriType(objectUri);
				if (objectType) {
					this.uriToType.set(subjectUri, objectType);
					this.inferredUris.delete(subjectUri);
				} else {
					this.uriToType.set(subjectUri, "instance");
					this.inferredUris.delete(subjectUri);
					if (!this.uriToType.has(objectUri)) {
						this.uriToType.set(objectUri, "class");
						this.inferredUris.add(objectUri);
					}
				}

				if (this.settings.hiddenInstanceOfUris.includes(objectUri)) {
					this.hiddenUris.add(subjectUri);
				}
			}

			if (quad.subject.termType === "BlankNode" || quad.object.termType === "BlankNode") continue;

			const inference = INFERRED_TYPES.get(predicateUri);
			if (!inference) continue;

			const subj = quad.subject.value;
			if (
				!this.uriToType.has(subj) &&
				!inHiddenNamespace(subj, this.settings.hiddenNamespaces) &&
				!this.hiddenUris.has(subj)
			) {
				this.uriToType.set(subj, classifyUriType(subj) ?? inference.subjectType);
				this.inferredUris.add(subj);
			}

			const obj = quad.object.value;
			if (
				!this.uriToType.has(obj) &&
				!inHiddenNamespace(obj, this.settings.hiddenNamespaces) &&
				!this.hiddenUris.has(obj)
			) {
				this.uriToType.set(obj, classifyUriType(obj) ?? inference.objectType);
				this.inferredUris.add(obj);
			}
		}

		for (const [uri] of this.uriToType) {
			if (hasBuiltinPrefix(uri)) {
				this.inferredUris.add(uri);
			}
		}
	}

	makeNode(uri: string, label: string, prefix: string | null, nodeType: EntityType): Node {
		const pos = this.uriToCoords.get(uri)?.shift();
		const inferred = this.inferredUris.has(uri);
		const dims = measureNodeDimensions(label, prefix, nodeType, inferred);
		return {
			id: `node-${this.nodeIdCounter++}`,
			uri,
			label,
			prefix,
			nodeType,
			inferred,
			x: pos ? pos.x : Math.random() * CANVAS_WIDTH,
			y: pos ? pos.y : Math.random() * CANVAS_HEIGHT,
			width: dims.width,
			height: dims.height,
			bodyLines: dims.bodyLines,
			badgeWidth: dims.badgeWidth
		};
	}

	addNode(uri: string): Node {
		if (this.uriToNode.has(uri)) return this.uriToNode.get(uri)!;

		const type = this.uriToType.get(uri) || classifyUriType(uri) || "class";
		if (!this.uriToType.has(uri) && hasBuiltinPrefix(uri)) {
			this.inferredUris.add(uri);
		}
		const node = this.makeNode(uri, resolveLocalName(uri), resolvePrefix(uri, this.nsToPrefix), type);
		this.uriToNode.set(uri, node);
		return node;
	}

	addBlankNode(uri: string): Node {
		if (this.uriToNode.has(uri)) return this.uriToNode.get(uri)!;

		const pos = this.uriToCoords.get(uri)?.shift();
		const diameter = BLANK_NODE_RADIUS * 2;
		const node: Node = {
			id: `node-${this.nodeIdCounter++}`,
			uri,
			label: "",
			prefix: null,
			nodeType: "blank",
			inferred: false,
			x: pos ? pos.x : Math.random() * CANVAS_WIDTH,
			y: pos ? pos.y : Math.random() * CANVAS_HEIGHT,
			width: diameter,
			height: diameter,
			bodyLines: [],
			badgeWidth: 0
		};
		this.uriToNode.set(uri, node);
		return node;
	}

	addEdge(sourceNode: Node, targetNode: Node, predicateUri: string, edgePrefix: string | null): void {
		this.edges.push({
			id: `edge-${this.edges.length}`,
			source: sourceNode,
			target: targetNode,
			label: resolveLocalName(predicateUri),
			prefix: edgePrefix
		});
	}

	buildBlankEdge(quad: Quad, sourceNode: Node, edgePrefix: string | null): void {
		const predicateUri = quad.predicate.value;

		if (this.settings.hiddenPredicateUris.includes(predicateUri)) return;

		const targetNode = this.addBlankNode(quad.object.value);
		this.addEdge(sourceNode, targetNode, predicateUri, edgePrefix);
	}

	buildLiteralEdge(quad: Quad, sourceNode: Node, edgePrefix: string | null): void {
		const predicateUri = quad.predicate.value;

		if (this.settings.hiddenPredicateUris.includes(predicateUri)) return;
		if (this.settings.hiddenEntityTypes.includes("literal")) return;

		const literalKey = `literal-${this.literalIdCounter++}`;
		const literalNode = this.makeNode(quad.object.value, quad.object.value, null, "literal");
		this.uriToNode.set(literalKey, literalNode);
		this.addEdge(sourceNode, literalNode, predicateUri, edgePrefix);
	}

	buildResourceEdge(quad: Quad, sourceNode: Node, edgePrefix: string | null): void {
		const predicateUri = quad.predicate.value;
		const objectUri = quad.object.value;

		const objType = this.uriToType.get(objectUri);
		const resolvedType = objType || classifyUriType(objectUri);
		if (inHiddenNamespace(objectUri, this.settings.hiddenNamespaces) || this.hiddenUris.has(objectUri)) return;
		if (this.settings.hiddenPredicateUris.includes(predicateUri)) return;
		if (this.settings.hiddenEntityTypes.includes(resolvedType ?? "class")) return;

		const shouldDuplicate =
			this.settings.duplicateExternalNodes && !this.localUris.has(objectUri) && resolvedType !== "literal";

		let targetNode: Node;
		if (shouldDuplicate) {
			const targetKey = `ext-${this.externalIdCounter++}`;
			this.inferredUris.add(objectUri);
			const type = resolvedType || "class";
			targetNode = this.makeNode(
				objectUri,
				resolveLocalName(objectUri),
				resolvePrefix(objectUri, this.nsToPrefix),
				type
			);
			this.uriToNode.set(targetKey, targetNode);
		} else {
			if (!this.uriToNode.has(objectUri)) {
				const type = resolvedType || "class";
				if (!this.localUris.has(objectUri)) {
					this.inferredUris.add(objectUri);
				}
				const node = this.makeNode(
					objectUri,
					resolveLocalName(objectUri),
					resolvePrefix(objectUri, this.nsToPrefix),
					type
				);
				this.uriToNode.set(objectUri, node);
			}
			targetNode = this.uriToNode.get(objectUri)!;
		}

		this.addEdge(sourceNode, targetNode, predicateUri, edgePrefix);
	}

	build(triples: Quad[]): { nodes: Node[]; edges: Edge[] } {
		this.classifyTriples(triples);

		for (const quad of triples) {
			const subjectUri = quad.subject.value;
			const predicateUri = quad.predicate.value;
			const subjectType = this.uriToType.get(subjectUri);

			if (
				this.settings.hiddenEntityTypes.includes("blank") &&
				(quad.subject.termType === "BlankNode" || quad.object.termType === "BlankNode")
			)
				continue;
			if (inHiddenNamespace(subjectUri, this.settings.hiddenNamespaces) || this.hiddenUris.has(subjectUri))
				continue;
			if (this.settings.hiddenEntityTypes.includes(subjectType ?? "class")) continue;

			let sourceNode: Node;
			if (quad.subject.termType === "BlankNode") {
				sourceNode = this.addBlankNode(subjectUri);
			} else {
				sourceNode = this.addNode(subjectUri);
			}

			const edgePrefix = resolvePrefix(predicateUri, this.nsToPrefix);

			if (quad.object.termType === "BlankNode") {
				this.buildBlankEdge(quad, sourceNode, edgePrefix);
			} else if (quad.object.termType === "Literal") {
				this.buildLiteralEdge(quad, sourceNode, edgePrefix);
			} else {
				this.buildResourceEdge(quad, sourceNode, edgePrefix);
			}
		}

		return {
			nodes: Array.from(this.uriToNode.values()),
			edges: this.edges
		};
	}
}

export function createGraphFromTriples(
	parsedTriples: Quad[],
	settings: GraphSettings,
	existingNodes: Array<{ uri: string; x: number; y: number }> = [],
	nsToPrefix: Record<string, string> = {}
) {
	const uriToCoords = new Map<string, { x: number; y: number }[]>();
	for (const n of existingNodes) {
		if (!uriToCoords.has(n.uri)) uriToCoords.set(n.uri, []);
		uriToCoords.get(n.uri)!.push({ x: n.x, y: n.y });
	}

	const builder = new GraphBuilder(settings, nsToPrefix, uriToCoords);
	return builder.build(parsedTriples);
}
