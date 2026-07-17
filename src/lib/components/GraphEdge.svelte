<script lang="ts">
	import { ARROW_INSET, ARROW_SIZE, ARROW_WIDTH_FACTOR, EDGE_SELF_REF_RADIUS } from "$lib/constants/visualisation";
	import type { Edge } from "$lib/types/graph";

	interface Props {
		edge: Edge;
	}

	const { edge }: Props = $props();

	const edgeGeo = $derived(edge.source.id === edge.target.id ? calcLoopGeo() : calcStraightGeo());
	const edgeLabelPos = $derived(calcLabelPos());

	function calcStraightGeo() {
		const x1 = edge.source.x + edge.source.width / 2;
		const y1 = edge.source.y + edge.source.height / 2;
		const x2 = edge.target.x + edge.target.width / 2;
		const y2 = edge.target.y + edge.target.height / 2;

		const { ux, uy } = normalise(x2 - x1, y2 - y1);
		const t = Math.min(
			edge.target.width / 2 / (Math.abs(ux) || 0.001),
			edge.target.height / 2 / (Math.abs(uy) || 0.001)
		);

		const tipX = x2 - ux * (t - ARROW_INSET);
		const tipY = y2 - uy * (t - ARROW_INSET);

		return {
			isSelfRef: false as const,
			x1,
			y1,
			x2,
			y2,
			tipX,
			tipY,
			bx1: tipX - ux * ARROW_SIZE + uy * ARROW_SIZE * ARROW_WIDTH_FACTOR,
			by1: tipY - uy * ARROW_SIZE - ux * ARROW_SIZE * ARROW_WIDTH_FACTOR,
			bx2: tipX - ux * ARROW_SIZE - uy * ARROW_SIZE * ARROW_WIDTH_FACTOR,
			by2: tipY - uy * ARROW_SIZE + ux * ARROW_SIZE * ARROW_WIDTH_FACTOR
		};
	}

	function calcLoopGeo() {
		const right = edge.source.x + edge.source.width;
		const cy = edge.source.y + edge.source.height / 2;

		const ex = right;
		const ey = cy;
		const cp1x = right + EDGE_SELF_REF_RADIUS;
		const cp1y = cy - EDGE_SELF_REF_RADIUS;
		const cp2x = right + EDGE_SELF_REF_RADIUS;
		const cp2y = cy + EDGE_SELF_REF_RADIUS;

		const { ux, uy } = normalise(ex - cp2x, ey - cp2y);
		const tipX = ex + ux * ARROW_INSET;
		const tipY = ey + uy * ARROW_INSET;

		return {
			isSelfRef: true as const,
			sx: right,
			sy: cy,
			cp1x,
			cp1y,
			cp2x,
			cp2y,
			ex,
			ey,
			tipX,
			tipY,
			bx1: tipX - ux * ARROW_SIZE + uy * ARROW_SIZE * ARROW_WIDTH_FACTOR,
			by1: tipY - uy * ARROW_SIZE - ux * ARROW_SIZE * ARROW_WIDTH_FACTOR,
			bx2: tipX - ux * ARROW_SIZE - uy * ARROW_SIZE * ARROW_WIDTH_FACTOR,
			by2: tipY - uy * ARROW_SIZE + ux * ARROW_SIZE * ARROW_WIDTH_FACTOR
		};
	}

	function normalise(dx: number, dy: number) {
		const len = Math.sqrt(dx * dx + dy * dy) ?? 1;
		return { ux: dx / len, uy: dy / len };
	}

	function calcLabelPos() {
		if (edgeGeo.isSelfRef) {
			return {
				x: edge.source.x + edge.source.width + EDGE_SELF_REF_RADIUS * 0.5,
				y: edge.source.y + edge.source.height / 2
			};
		} else {
			return {
				x: (edge.source.x + edge.source.width / 2 + edge.target.x + edge.target.width / 2) / 2,
				y: (edge.source.y + edge.source.height / 2 + edge.target.y + edge.target.height / 2) / 2
			};
		}
	}
</script>

{#if edgeGeo.isSelfRef}
	<path
		d="M {edgeGeo.sx} {edgeGeo.sy} C {edgeGeo.cp1x} {edgeGeo.cp1y}, {edgeGeo.cp2x} {edgeGeo.cp2y}, {edgeGeo.ex} {edgeGeo.ey}"
		class="stroke-overlay-1"
		stroke-width="1.5"
		fill="none"
	/>
{:else if edge.collectionEdge}
	<line
		x1={edgeGeo.x1}
		y1={edgeGeo.y1}
		x2={edgeGeo.x2}
		y2={edgeGeo.y2}
		class="stroke-mauve"
		stroke-dasharray="5"
		stroke-width="1.5"
	/>
{:else}
	<line x1={edgeGeo.x1} y1={edgeGeo.y1} x2={edgeGeo.x2} y2={edgeGeo.y2} class="stroke-overlay-1" stroke-width="1.5" />
{/if}

<polygon
	points="{edgeGeo.tipX},{edgeGeo.tipY} {edgeGeo.bx1},{edgeGeo.by1} {edgeGeo.bx2},{edgeGeo.by2}"
	class={edge.collectionEdge ? "fill-mauve" : "fill-overlay-0"}
/>

{#if !edge.collectionEdge}
	<text
		x={edgeLabelPos.x}
		y={edgeLabelPos.y}
		text-anchor={edgeGeo.isSelfRef ? "start" : "middle"}
		dominant-baseline={edgeGeo.isSelfRef ? "middle" : undefined}
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
				<tspan x={edgeLabelPos.x} dy="1.2em">{part}</tspan>
			{/if}
		{/each}
	</text>
{/if}
