import type { EntityType } from "$lib/types/graph";

// using list and not record here for use in svelte #each iteration
export const ENTITY_TYPE_DISPLAY = [
	{ type: "class", label: "Class" },
	{ type: "datatype", label: "Datatype" },
	{ type: "objectProperty", label: "Object Property" },
	{ type: "dataProperty", label: "Data Property" },
	{ type: "annotationProperty", label: "Annotation Property" },
	{ type: "instance", label: "Instance" },
	{ type: "literal", label: "Literal" },
	{ type: "blank", label: "Blank" }
] as const satisfies readonly { type: EntityType; label: string }[];

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = Object.fromEntries(
	ENTITY_TYPE_DISPLAY.map(({ type, label }) => [type, label.toUpperCase()])
) as Record<EntityType, string>;

export const ENTITY_TYPE_COLOURS: Record<EntityType, string> = {
	class: "peach",
	datatype: "green",
	objectProperty: "lavender",
	dataProperty: "teal",
	annotationProperty: "sky",
	instance: "blue",
	literal: "overlay-1",
	blank: "overlay-2"
};

export function entityTypeLabel(nodeType: EntityType, inferred: boolean): string {
	return inferred ? `${ENTITY_TYPE_LABELS[nodeType]} (EX)` : ENTITY_TYPE_LABELS[nodeType];
}
