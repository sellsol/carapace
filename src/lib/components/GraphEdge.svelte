<script lang="ts">
	import { ARROW_INSET, ARROW_SIZE, ARROW_WIDTH_FACTOR } from "$lib/constants/visualisation";
	import type { Edge } from "$lib/types/graph";

	interface Props {
		edge: Edge;
	}

	const { edge }: Props = $props();

	const arrow = $derived.by(() => {
		const x1 = edge.source.x + edge.source.width / 2;
		const y1 = edge.source.y + edge.source.height / 2;
		const x2 = edge.target.x + edge.target.width / 2;
		const y2 = edge.target.y + edge.target.height / 2;

		const dx = x2 - x1;
		const dy = y2 - y1;
		const len = Math.sqrt(dx * dx + dy * dy) || 1;
		const ux = dx / len;
		const uy = dy / len;

		const t = Math.min(
			edge.target.width / 2 / (Math.abs(ux) || 0.001),
			edge.target.height / 2 / (Math.abs(uy) || 0.001)
		);

		const tipX = x2 - ux * (t - ARROW_INSET);
		const tipY = y2 - uy * (t - ARROW_INSET);

		const bx1 = tipX - ux * ARROW_SIZE + uy * ARROW_SIZE * ARROW_WIDTH_FACTOR;
		const by1 = tipY - uy * ARROW_SIZE - ux * ARROW_SIZE * ARROW_WIDTH_FACTOR;
		const bx2 = tipX - ux * ARROW_SIZE - uy * ARROW_SIZE * ARROW_WIDTH_FACTOR;
		const by2 = tipY - uy * ARROW_SIZE + ux * ARROW_SIZE * ARROW_WIDTH_FACTOR;

		return { x1, y1, x2, y2, tipX, tipY, bx1, by1, bx2, by2 };
	});

	const labelPos = $derived({
		x: (arrow.x1 + arrow.x2) / 2,
		y: (arrow.y1 + arrow.y2) / 2
	});
</script>

{#if edge.collectionEdge}
	<line
		x1={arrow.x1}
		y1={arrow.y1}
		x2={arrow.x2}
		y2={arrow.y2}
		class="stroke-mauve"
		stroke-dasharray="5"
		stroke-width="1.5"
	/>
	<polygon points="{arrow.tipX},{arrow.tipY} {arrow.bx1},{arrow.by1} {arrow.bx2},{arrow.by2}" class="fill-mauve" />
{:else}
	<line x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2} class="stroke-overlay-1" stroke-width="1.5" />
	<polygon
		points="{arrow.tipX},{arrow.tipY} {arrow.bx1},{arrow.by1} {arrow.bx2},{arrow.by2}"
		class="fill-overlay-0"
	/>
{/if}

{#if !edge.collectionEdge}
	<text
		x={labelPos.x}
		y={labelPos.y}
		text-anchor="middle"
		font-size="11"
		class="fill-text stroke-mantle"
		stroke-width="3"
		stroke-linejoin="round"
		paint-order="stroke"
	>
		{#each edge.label.split("\n") as part, i}
			{#if i === 0}
				{part}
			{:else}
				<tspan x={labelPos.x} dy="1.2em">{part}</tspan>
			{/if}
		{/each}
	</text>
{/if}
