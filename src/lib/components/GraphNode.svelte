<script lang="ts">
	import { ENTITY_TYPE_COLOURS, entityTypeLabel } from "$lib/constants/entity";
	import {
		NODE_BADGE_FONT_SIZE,
		NODE_BADGE_PADDING_X,
		NODE_BODY_FONT_SIZE,
		NODE_BORDER_WIDTH,
		NODE_CONTENT_PADDING_X,
		NODE_CONTENT_PADDING_Y,
		NODE_HEADER_FONT_SIZE,
		NODE_HEADER_HEIGHT,
		NODE_LABEL_GAP,
		NODE_LINE_HEIGHT
	} from "$lib/constants/visualisation";
	import type { Node } from "$lib/types/graph";

	interface Props {
		node: Node;
		locked: boolean;
		onDrag: (node: Node, event: MouseEvent) => void;
	}
	const { node, locked, onDrag }: Props = $props();

	const label = $derived(entityTypeLabel(node.nodeType, node.inferred));
	const colour = $derived(node.inferred ? "yellow" : ENTITY_TYPE_COLOURS[node.nodeType]);
	const contentInset = $derived(NODE_BORDER_WIDTH / 2 + NODE_CONTENT_PADDING_X / 2);
	const headerTextY = $derived(NODE_HEADER_HEIGHT / 2 + NODE_HEADER_FONT_SIZE * 0.35);
	const badgeHeight = $derived(NODE_BADGE_FONT_SIZE + 4);
	const badgeY = $derived(NODE_HEADER_HEIGHT + NODE_CONTENT_PADDING_Y + (NODE_LINE_HEIGHT - badgeHeight) / 2);
	const badgeTextY = $derived(badgeY + badgeHeight / 2 + NODE_BADGE_FONT_SIZE * 0.35);

	function getLabelY(i: number) {
		return NODE_HEADER_HEIGHT + NODE_CONTENT_PADDING_Y + (i + 0.5) * NODE_LINE_HEIGHT + NODE_BODY_FONT_SIZE * 0.35;
	}

	function handleMouseDown() {
		if (locked) return;

		const onMove = (moveEvent: MouseEvent) => onDrag(node, moveEvent);
		const onUp = () => {
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
		};
		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
	}
</script>

<g transform="translate({node.x}, {node.y})" class={locked ? "drop-shadow-sm" : "cursor-move drop-shadow-sm"}>
	<rect
		width={node.width}
		height={node.height}
		rx="6"
		style="fill: color-mix(in srgb, var(--{colour}) 15%, var(--mantle)); stroke: var(--{colour});"
		stroke-width="1.5"
		role="presentation"
		onmousedown={handleMouseDown}
	/>
	<path
		d="M 0 6 Q 0 0 6 0 L {node.width -
			6} 0 Q {node.width} 0 {node.width} 6 L {node.width} {NODE_HEADER_HEIGHT} L 0 {NODE_HEADER_HEIGHT} Z"
		style="fill: var(--{colour});"
		pointer-events="none"
	/>
	<text
		x="6"
		y={headerTextY}
		class="fill-white"
		font-size={NODE_HEADER_FONT_SIZE}
		font-weight="bold"
		pointer-events="none">{label}</text
	>
	{#if node.prefix}
		<rect
			x={contentInset}
			y={badgeY}
			width={node.badgeWidth}
			height={badgeHeight}
			rx="3"
			style="fill: var(--{colour});"
			pointer-events="none"
		/>
		<text
			x={contentInset + NODE_BADGE_PADDING_X}
			y={badgeTextY}
			class="fill-white font-semibold"
			font-size={NODE_BADGE_FONT_SIZE}
			pointer-events="none">{node.prefix}</text
		>
	{/if}
	{#each node.bodyLines as line, i}
		<text
			x={i === 0 && node.prefix ? contentInset + node.badgeWidth + NODE_LABEL_GAP : contentInset}
			y={getLabelY(i)}
			class="fill-text"
			font-size={NODE_BODY_FONT_SIZE}
			pointer-events="none">{line}</text
		>
	{/each}
</g>
