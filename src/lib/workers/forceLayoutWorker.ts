import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";

import {
	FORCE_ALPHA,
	FORCE_ALPHA_DECAY,
	FORCE_CHARGE_STRENGTH_BASE,
	FORCE_CHARGE_STRENGTH_PER_NODE,
	FORCE_COLLIDE_PADDING,
	FORCE_LINK_DISTANCE_MIN,
	FORCE_LINK_ITERATIONS,
	FORCE_LINK_STRENGTH,
	FORCE_X_Y_STRENGTH,
	TICK_COUNT_MAX,
	TICK_COUNT_MIN,
	TICK_COUNT_PER_NODE
} from "$lib/constants/visualisation";

self.onmessage = (e: MessageEvent) => {
	const { nodes, edges, width, height } = e.data;

	/* eslint-disable @typescript-eslint/no-explicit-any */
	const sim = forceSimulation(nodes)
		.alpha(FORCE_ALPHA)
		.alphaDecay(FORCE_ALPHA_DECAY)
		.force(
			"link",
			forceLink(edges)
				.id((d: any) => d.id)
				.distance((l: any) => {
					const s = l.source;
					const t = l.target;
					return Math.max(FORCE_LINK_DISTANCE_MIN, (s.width + t.width) / 2);
				})
				.strength(FORCE_LINK_STRENGTH)
				.iterations(FORCE_LINK_ITERATIONS)
		)
		.force(
			"charge",
			forceManyBody().strength(
				-Math.max(FORCE_CHARGE_STRENGTH_BASE, nodes.length * FORCE_CHARGE_STRENGTH_PER_NODE)
			)
		)
		.force(
			"collide",
			forceCollide().radius((d: any) => Math.max(d.width, d.height) / 2 + FORCE_COLLIDE_PADDING)
		)
		.force("x", forceX(width / 2).strength(FORCE_X_Y_STRENGTH))
		.force("y", forceY(height / 2).strength(FORCE_X_Y_STRENGTH));

	sim.stop();

	const tickCount = Math.max(TICK_COUNT_MIN, Math.min(TICK_COUNT_MAX, nodes.length * TICK_COUNT_PER_NODE));
	for (let i = 0; i < tickCount; i++) sim.tick();

	const positions = nodes.map((n: any) => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0 }));
	self.postMessage(positions);
};
