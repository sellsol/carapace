import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";

self.onmessage = (e: MessageEvent) => {
	const { nodes, edges, width, height } = e.data;

	/* eslint-disable @typescript-eslint/no-explicit-any */
	const sim = forceSimulation(nodes)
		.alpha(1)
		.alphaDecay(0.01)
		.force(
			"link",
			forceLink(edges)
				.id((edge: any) => edge.id)
				.distance((edge: any) => Math.max(50, (edge.source.width + edge.target.width) / 2))
				.strength(0.3)
		)
		.force("charge", forceManyBody().strength(Math.min(-800, nodes.length * -3)))
		.force(
			"collide",
			forceCollide().radius((node: any) => Math.max(node.width, node.height) / 2 + 15)
		)
		.force("x", forceX(width / 2).strength(0.015))
		.force("y", forceY(height / 2).strength(0.015));

	sim.stop();

	while (sim.alpha() > sim.alphaMin()) sim.tick();

	const positions = nodes.map((node: any) => ({ id: node.id, x: node.x ?? 0, y: node.y ?? 0 }));
	self.postMessage(positions);
};
