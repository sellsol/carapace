<script lang="ts">
	import { entityTypeColour, entityTypeLabel } from "$lib/constants/entity";
	import {
		COLLECTION_NODE_RADIUS,
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
	import { TEXT_VERTICAL_OFFSET_FACTOR } from "$lib/utils/layout";

	interface Props {
		node: Node;
		locked: boolean;
		selected: boolean;
		onDrag: (node: Node, event: MouseEvent) => void;
		onDragStart: (node: Node, event: MouseEvent) => void;
		onDragEnd: () => void;
	}
	const { node, locked, selected, onDrag, onDragStart, onDragEnd }: Props = $props();

	const label = $derived(entityTypeLabel(node.nodeType, node.external));
	const colour = $derived(entityTypeColour(node.nodeType, node.external));

	const contentInset = $derived(NODE_BORDER_WIDTH / 2 + NODE_CONTENT_PADDING_X / 2);
	const headerTextY = $derived(NODE_HEADER_HEIGHT / 2 + NODE_HEADER_FONT_SIZE * TEXT_VERTICAL_OFFSET_FACTOR);
	const badgeHeight = $derived(NODE_BADGE_FONT_SIZE + 4);
	const badgeY = $derived(NODE_HEADER_HEIGHT + NODE_CONTENT_PADDING_Y + (NODE_LINE_HEIGHT - badgeHeight) / 2);
	const badgeTextY = $derived(badgeY + badgeHeight / 2 + NODE_BADGE_FONT_SIZE * 0.35);

	function handleMouseMove(event: MouseEvent) {
		onDrag(node, event);
	}

	function handleMouseUp() {
		document.removeEventListener("mousemove", handleMouseMove);
		document.removeEventListener("mouseup", handleMouseUp);
		onDragEnd();
	}

	function handleMouseDown(event: MouseEvent) {
		if (locked) return;

		onDragStart(node, event);
		if (event.ctrlKey || event.metaKey) event.preventDefault();
		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
	}
</script>

<g transform="translate({node.x}, {node.y})" class={locked ? "drop-shadow-sm" : "cursor-move drop-shadow-sm"}>
	{#if node.collection}
		{#if selected}
			<circle
				cx={node.width / 2}
				cy={node.height / 2}
				r={COLLECTION_NODE_RADIUS + 4}
				fill="none"
				stroke="var(--blue)"
				stroke-width="2"
				stroke-dasharray="4,2"
				pointer-events="none"
			/>
		{/if}
		<circle
			cx={node.width / 2}
			cy={node.height / 2}
			r={COLLECTION_NODE_RADIUS}
			style="fill: color-mix(in srgb, var(--{colour}) 15%, var(--mantle)); stroke: var(--{colour});"
			stroke-width="1.5"
			role="presentation"
			onmousedown={handleMouseDown}
		/>
		<g transform="translate({node.width / 2}, {node.height / 2})" pointer-events="none">
			{#if node.collectionType === "list"}
				<line x1={-4} y1={-3} x2={4} y2={-3} class="stroke-mauve" stroke-width="2" />
				<line x1={-4} y1={0} x2={4} y2={0} class="stroke-mauve" stroke-width="2" />
				<line x1={-4} y1={3} x2={4} y2={3} class="stroke-mauve" stroke-width="2" />
			{:else if node.collectionType === "enumeration"}
				<path
					d="M {-4},{-4} L {0},{4} L {4},{-4}"
					fill="none"
					class="stroke-mauve"
					stroke-width="2"
					stroke-linejoin="round"
				/>
			{:else if node.collectionType === "intersection"}
				<path
					d="M {-4},{3} Q {-4},{-4} {0},{-4} Q {4},{-4} {4},{3}"
					fill="none"
					class="stroke-mauve"
					stroke-width="2"
				/>
			{:else if node.collectionType === "union"}
				<path
					d="M {-4},{-3} Q {-4},{4} {0},{4} Q {4},{4} {4},{-3}"
					fill="none"
					class="stroke-mauve"
					stroke-width="2"
				/>
			{/if}
		</g>
	{:else if node.nodeType === "blank"}
		{#if selected}
			<circle
				cx={node.width / 2}
				cy={node.height / 2}
				r={node.width / 2 + 4}
				fill="none"
				stroke="var(--blue)"
				stroke-width="2"
				stroke-dasharray="4,2"
				pointer-events="none"
			/>
		{/if}
		<circle
			cx={node.width / 2}
			cy={node.height / 2}
			r={node.width / 2}
			style="fill: color-mix(in srgb, var(--{colour}) 15%, var(--mantle)); stroke: var(--{colour});"
			stroke-width="1.5"
			role="presentation"
			onmousedown={handleMouseDown}
		/>
	{:else if node.blank}
		{#if selected}
			<rect
				x={-4}
				y={-4}
				width={node.width + 8}
				height={node.height + 8}
				rx="8"
				fill="none"
				stroke="var(--blue)"
				stroke-width="2"
				stroke-dasharray="4,2"
				pointer-events="none"
			/>
		{/if}
		<rect
			width={node.width}
			height={node.height}
			rx={node.height / 2}
			style="fill: color-mix(in srgb, var(--{colour}) 15%, var(--mantle)); stroke: var(--{colour});"
			stroke-width="1.5"
			role="presentation"
			onmousedown={handleMouseDown}
		/>
		<text
			x={node.width / 2}
			y={node.height / 2 + NODE_HEADER_FONT_SIZE * TEXT_VERTICAL_OFFSET_FACTOR}
			text-anchor="middle"
			style="fill: var(--{colour})"
			class="font-semibold"
			font-size={NODE_HEADER_FONT_SIZE}
			pointer-events="none">{label}</text
		>
	{:else}
		{#if selected}
			<rect
				x={-4}
				y={-4}
				width={node.width + 8}
				height={node.height + 8}
				rx="8"
				fill="none"
				stroke="var(--blue)"
				stroke-width="2"
				stroke-dasharray="4,2"
				pointer-events="none"
			/>
		{/if}
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
				y={NODE_HEADER_HEIGHT +
					NODE_CONTENT_PADDING_Y +
					(i + 0.5) * NODE_LINE_HEIGHT +
					NODE_BODY_FONT_SIZE * TEXT_VERTICAL_OFFSET_FACTOR}
				class="fill-text"
				font-size={NODE_BODY_FONT_SIZE}
				pointer-events="none">{line}</text
			>
		{/each}
	{/if}
</g>
