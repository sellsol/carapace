import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";

import {
	FORCE_ALPHA,
	FORCE_ALPHA_DECAY,
	FORCE_CHARGE_STRENGTH_BASE,
	FORCE_CHARGE_STRENGTH_PER_SQRT_DEGREE,
	FORCE_COLLIDE_PADDING,
	FORCE_COMPONENT_CENTERING_STRENGTH,
	FORCE_INITIAL_RADIUS,
	FORCE_LINK_DISTANCE_MIN,
	FORCE_LINK_ITERATIONS,
	FORCE_LINK_STRENGTH,
	TICK_COUNT_MAX,
	TICK_COUNT_MIN,
	TICK_COUNT_PER_NODE
} from "$lib/constants/visualisation";

/* eslint-disable @typescript-eslint/no-explicit-any */
self.onmessage = (e: MessageEvent) => {
	const { nodes, edges, width, height } = e.data;

	const adj = new Map<string, string[]>();
	for (const n of nodes) adj.set(n.id, []);
	for (const e of edges) {
		adj.get(e.source)?.push(e.target);
		adj.get(e.target)?.push(e.source);
	}

	// Find connected components via BFS
	const visited = new Set<string>();
	const components: string[][] = [];

	for (const n of nodes) {
		if (visited.has(n.id)) continue;

		const comp: string[] = [];
		let head = 0;
		const queue = [n.id];
		visited.add(n.id);

		while (head < queue.length) {
			const id = queue[head++];
			comp.push(id);
			for (const nb of adj.get(id) ?? []) {
				if (!visited.has(nb)) {
					visited.add(nb);
					queue.push(nb);
				}
			}
		}

		components.push(comp);
	}

	// Largest component first
	components.sort((a, b) => b.length - a.length);

	// BFS radial initial placement
	const nodeById = new Map<string, any>(nodes.map((n: any) => [n.id, n]));

	for (let ci = 0; ci < components.length; ci++) {
		const comp = components[ci];

		let root = comp[0];
		let maxDeg = (adj.get(root) ?? []).length;
		for (const id of comp) {
			const deg = (adj.get(id) ?? []).length;
			if (deg > maxDeg) {
				maxDeg = deg;
				root = id;
			}
		}

		const hop = new Map<string, number>();
		let qHead = 0;
		const q = [root];
		hop.set(root, 0);
		let maxHop = 0;
		const compSet = new Set(comp);

		while (qHead < q.length) {
			const id = q[qHead++];
			for (const nb of adj.get(id) ?? []) {
				if (!hop.has(nb) && compSet.has(nb)) {
					const h = hop.get(id)! + 1;
					hop.set(nb, h);
					if (h > maxHop) maxHop = h;
					q.push(nb);
				}
			}
		}

		const byHop: string[][] = Array.from({ length: maxHop + 1 }, () => []);
		for (const id of comp) {
			const h = hop.get(id) ?? 0;
			byHop[h].push(id);
		}

		// Main component at center, others in tight golden-angle spiral
		let cx: number;
		let cy: number;
		if (ci === 0) {
			cx = 0;
			cy = 0;
		} else {
			const spiralAngle = ci * 2.399963;
			const spiralDist = FORCE_INITIAL_RADIUS * 0.5 + ci * 60;
			cx = spiralDist * Math.cos(spiralAngle);
			cy = spiralDist * Math.sin(spiralAngle);
		}

		for (let h = 0; h <= maxHop; h++) {
			const ring = byHop[h];
			const radius = FORCE_INITIAL_RADIUS * (h + 1);
			const angleOffset = (h % 2) * Math.PI;
			for (let i = 0; i < ring.length; i++) {
				const nodeAngle = angleOffset + (i / ring.length) * Math.PI * 2;
				const node = nodeById.get(ring[i])!;
				node.x = cx + radius * Math.cos(nodeAngle);
				node.y = cy + radius * Math.sin(nodeAngle);
			}
		}
	}

	// Per-component centroids (computed from initial positions)
	const centroids = new Map<string, { x: number; y: number }>();
	for (const comp of components) {
		let cx = 0;
		let cy = 0;
		for (const id of comp) {
			const n = nodeById.get(id)!;
			cx += n.x;
			cy += n.y;
		}
		cx /= comp.length;
		cy /= comp.length;
		for (const id of comp) {
			centroids.set(id, { x: cx, y: cy });
		}
	}

	const sim = forceSimulation(nodes)
		.alpha(FORCE_ALPHA)
		.alphaDecay(FORCE_ALPHA_DECAY)
		.force(
			"link",
			forceLink(edges)
				.id((d: any) => d.id)
				.distance((l: any) => Math.max(FORCE_LINK_DISTANCE_MIN, (l.source.width + l.target.width) / 2))
				.strength(FORCE_LINK_STRENGTH)
				.iterations(FORCE_LINK_ITERATIONS)
		)
		.force(
			"charge",
			forceManyBody().strength(
				(d: any) =>
					-Math.max(
						FORCE_CHARGE_STRENGTH_BASE,
						Math.sqrt(adj.get(d.id)?.length ?? 0) * FORCE_CHARGE_STRENGTH_PER_SQRT_DEGREE
					)
			)
		)
		.force(
			"collide",
			forceCollide().radius((d: any) => Math.max(d.width, d.height) / 2 + FORCE_COLLIDE_PADDING)
		)
		.force(
			"x",
			forceX((d: any) => centroids.get(d.id)?.x ?? width / 2).strength(FORCE_COMPONENT_CENTERING_STRENGTH)
		)
		.force(
			"y",
			forceY((d: any) => centroids.get(d.id)?.y ?? height / 2).strength(FORCE_COMPONENT_CENTERING_STRENGTH)
		);

	sim.stop();

	const tickCount = Math.max(TICK_COUNT_MIN, Math.min(TICK_COUNT_MAX, nodes.length * TICK_COUNT_PER_NODE));
	for (let i = 0; i < tickCount; i++) sim.tick();

	const positions = nodes.map((n: any) => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0 }));
	self.postMessage(positions);
};
