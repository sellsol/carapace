import dagre from "dagre";

/* eslint-disable @typescript-eslint/no-explicit-any */
self.onmessage = (e: MessageEvent) => {
	const { nodes, edges } = e.data;

	const g = new dagre.graphlib.Graph();
	g.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 120, marginx: 30, marginy: 30 });
	g.setDefaultEdgeLabel(() => ({}));

	for (const n of nodes) {
		g.setNode(n.id, { width: n.width, height: n.height });
	}
	for (const e of edges) {
		g.setEdge(e.source, e.target);
	}

	dagre.layout(g);

	const result = nodes.map((n: any) => {
		const pos = g.node(n.id);
		return { id: n.id, x: pos.x, y: pos.y };
	});
	self.postMessage(result);
};
