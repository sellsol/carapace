import type { Quad } from "n3";

import {
	INFERRED_TYPES,
	PREDICATE_TO_COLLECTION,
	RDF_FIRST,
	RDF_NIL,
	RDF_REST,
	TYPE_PREDICATES
} from "$lib/constants/namespaces";
import type { CollectionDescriptor } from "$lib/types/processor";
import { NodeDescriptor } from "$lib/types/processor";
import type { GraphSettings } from "$lib/types/tabs";
import { classifyUriType } from "$lib/utils/ontology";
import { inHiddenNamespace } from "$lib/utils/settings";

export class Preprocessor {
	settings: GraphSettings;

	nodeDescriptors = new Map<string, NodeDescriptor>();
	collectionDescriptors: CollectionDescriptor[] = [];

	constructor(settings: GraphSettings) {
		this.settings = settings;
	}

	process(triples: Quad[]) {
		this.getDescriptor(RDF_NIL).isHidden = true;

		for (const quad of triples) {
			this.digestSubject(quad);
			this.digestBlank(quad);
			this.digestChain(quad);
			this.digestCollection(quad);
			this.digestType(quad);
		}

		this.resolveBridges();
		this.resolveCollections();
	}

	private getDescriptor(uri: string): NodeDescriptor {
		let descriptor = this.nodeDescriptors.get(uri);
		if (!descriptor) {
			descriptor = new NodeDescriptor();
			this.nodeDescriptors.set(uri, descriptor);
		}
		return descriptor;
	}

	private digestSubject(quad: Quad) {
		const subjectDescriptor = this.getDescriptor(quad.subject.value);

		subjectDescriptor.isSubject = true;
	}

	private digestBlank(quad: Quad) {
		if (quad.subject.termType !== "BlankNode") return;

		const subjectDescriptor = this.getDescriptor(quad.subject.value);

		subjectDescriptor.isBlank = true;
		if (!PREDICATE_TO_COLLECTION.has(quad.predicate.value)) {
			subjectDescriptor.isBridge = false;
		}
	}

	private digestChain(quad: Quad) {
		if (quad.predicate.value !== RDF_FIRST && quad.predicate.value !== RDF_REST) return;

		const subjectDescriptor = this.getDescriptor(quad.subject.value);
		const objectDescriptor = this.getDescriptor(quad.object.value);

		subjectDescriptor.isChain = true;
		if (quad.predicate.value === RDF_FIRST) {
			subjectDescriptor.chainFirst = quad.object.value;
			subjectDescriptor.chainFirstType = quad.object.termType;
			objectDescriptor.isList = true;
		} else {
			subjectDescriptor.chainNext = quad.object.value;
			objectDescriptor.isChainRest = true;
		}
	}

	private digestCollection(quad: Quad) {
		const collectionType = PREDICATE_TO_COLLECTION.get(quad.predicate.value);
		if (!collectionType) return;

		const objectDescriptor = this.getDescriptor(quad.object.value);

		objectDescriptor.isCollection = true;
		objectDescriptor.collectionType = collectionType;
		objectDescriptor.collectionSource = quad.subject.value;
	}

	private digestType(quad: Quad) {
		if (TYPE_PREDICATES.has(quad.predicate.value)) {
			this.digestTypeExplicit(quad);
		} else {
			this.digestTypeInferred(quad);
		}
	}

	private digestTypeExplicit(quad: Quad) {
		const subjectDescriptor = this.getDescriptor(quad.subject.value);
		const objectDescriptor = this.getDescriptor(quad.object.value);

		subjectDescriptor.isLocal = true;

		const objectType = classifyUriType(quad.object.value);
		if (objectType) {
			subjectDescriptor.nodeType = objectType;
		} else {
			subjectDescriptor.nodeType = "instance";
			if (!objectDescriptor.nodeType) {
				objectDescriptor.nodeType = "class";
			}
		}

		if (this.settings.hiddenInstanceOfUris.includes(quad.object.value)) {
			subjectDescriptor.isHidden = true;
		}
	}

	private digestTypeInferred(quad: Quad) {
		if (quad.subject.termType === "BlankNode" || quad.object.termType === "BlankNode") return;

		const inference = INFERRED_TYPES.get(quad.predicate.value);
		if (!inference) return;

		const subjectDescriptor = this.getDescriptor(quad.subject.value);
		const objectDescriptor = this.getDescriptor(quad.object.value);

		if (!subjectDescriptor.nodeType && !subjectDescriptor.isHidden && !inHiddenNamespace(quad.subject.value)) {
			subjectDescriptor.nodeType = classifyUriType(quad.subject.value) ?? inference.subjectType;
		}

		if (!objectDescriptor.nodeType && !objectDescriptor.isHidden && !inHiddenNamespace(quad.object.value)) {
			objectDescriptor.nodeType = classifyUriType(quad.object.value) ?? inference.objectType;
		}
	}

	private resolveBridges() {
		for (const [uri, descriptor] of this.nodeDescriptors) {
			if (!descriptor.isCollection || descriptor.isList) continue;

			const sourceDescriptor = this.getDescriptor(descriptor.collectionSource ?? "");
			if (!sourceDescriptor.isBlank || !sourceDescriptor.isBridge) continue;

			// sourceDescriptor.isBridge = true; // defaults to true
			sourceDescriptor.bridgeTarget = uri;
		}
	}

	private resolveCollections() {
		for (const [headUri, headDescriptor] of this.nodeDescriptors) {
			if (!headDescriptor.isChain || headDescriptor.isChainRest) continue;

			const members: CollectionDescriptor["members"] = [];
			const seen = new Set<string>();

			let current = headUri;
			while (current && current !== RDF_NIL && !seen.has(current)) {
				seen.add(current);

				const currentDescriptor = this.getDescriptor(current);
				if (!currentDescriptor.isChain || !currentDescriptor.chainFirst || !currentDescriptor.chainFirstType) {
					break;
				}

				let memberUri = currentDescriptor.chainFirst;
				const memberType = currentDescriptor.chainFirstType;
				if (memberType === "BlankNode") {
					const memberDescriptor = this.getDescriptor(memberUri);
					if (memberDescriptor.isBridge && memberDescriptor.bridgeTarget) {
						memberUri = memberDescriptor.bridgeTarget;
					}
				}

				members.push({ uri: memberUri, type: memberType, subjectUri: current });
				current = currentDescriptor.chainNext ?? RDF_NIL;
			}

			const collectionType = headDescriptor.collectionType ?? "list";
			this.collectionDescriptors.push({ headUri, collectionType, members });
		}
	}

}
