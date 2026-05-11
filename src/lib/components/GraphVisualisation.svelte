<script lang="ts">
	import GraphEdge from "$lib/components/GraphEdge.svelte";
	import GraphNode from "$lib/components/GraphNode.svelte";
	import type { Simulation, SimulationLinkDatum, SimulationNodeDatum } from "d3-force";
	import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";
	import type { Quad } from "n3";
	import { onDestroy, onMount } from "svelte";

	import {
		CANVAS_HEIGHT,
		CANVAS_WIDTH,
		FIT_PADDING,
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
		TICK_COUNT_PER_NODE,
		ZOOM_BUTTON_FACTOR,
		ZOOM_FIT_MAX,
		ZOOM_MAX,
		ZOOM_MIN,
		ZOOM_WHEEL_IN_FACTOR,
		ZOOM_WHEEL_OUT_FACTOR
	} from "$lib/constants/visualisation";
	import { createLogger } from "$lib/logger";
	import { tabsStore } from "$lib/stores/tabs.svelte";
	import type { Edge, EntityType, Node } from "$lib/types/graph";
	import type { GraphSettings } from "$lib/types/tabs";
	import { exportSvgToFile } from "$lib/utils/export";
	import { defaultGraphSettings, settingsHash } from "$lib/utils/settings";
	import { createGraphFromTriples } from "$lib/utils/visualisation";

	import { Button } from "$lib/components/ui/button";
	import { Spinner } from "$lib/components/ui/spinner";
	import Lock from "@lucide/svelte/icons/lock";
	import LockOpen from "@lucide/svelte/icons/lock-open";
	import Minus from "@lucide/svelte/icons/minus";
	import Plus from "@lucide/svelte/icons/plus";
	import Scan from "@lucide/svelte/icons/scan";

	interface Props {
		triples: Quad[];
		class?: string;
		prefixMap?: Record<string, string>;
		reloadTrigger?: number;
	}
	const { triples, class: className = "", prefixMap = {}, reloadTrigger = 0 }: Props = $props();
	const logger = createLogger("GraphVisualisation");

	let containerEl: HTMLDivElement;
	let svgEl: SVGSVGElement;
	let width = $state(CANVAS_WIDTH);
	let height = $state(CANVAS_HEIGHT);

	let nodes = $state<Node[]>([]);
	let edges = $state<Edge[]>([]);

	let transform = $state({ x: 0, y: 0, k: 1 });
	let triplesHash = "";
	let layoutDone = false;
	let currentTabId = "";
	let positionLocked = $state(false);
	let appliedSettingsHash = "";
	let settingsReady = false;
	let lastReloadTrigger = 0;
	let loadGeneration = 0;

	function withLoadingOverlay(fn: () => Promise<void>) {
		const gen = ++loadGeneration;
		tabsStore.graphLoading = true;
		setTimeout(async () => {
			if (gen !== loadGeneration) return;
			await fn();
			if (gen !== loadGeneration) return;
			tabsStore.graphLoading = false;
		}, 0);
	}

	function makeTriplesHash(t: Quad[]): string {
		return JSON.stringify(t.map((q) => q.subject.value + q.predicate.value + q.object.value));
	}

	function savePositions() {
		if (!currentTabId) return;

		const tab = tabsStore.getTab(currentTabId);
		if (!tab) return;

		tab.nodePositions = nodes.map((n) => ({ id: n.uri, x: n.x, y: n.y }));
	}

	function toggleLock() {
		positionLocked = !positionLocked;
		tabsStore.setActiveTabLocked(positionLocked);
	}

	onMount(() => {
		currentTabId = tabsStore.activeTabId;
		tabsStore.exportSvg = () => exportSvgToFile(svgEl, nodes, transform);
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				width = entry.contentRect.width;
				height = entry.contentRect.height;
			}
		});
		resizeObserver.observe(containerEl);

		return () => {
			resizeObserver.disconnect();
		};
	});

	onDestroy(() => {
		savePositions();
		tabsStore.exportSvg = null;
	});

	interface D3Node extends SimulationNodeDatum {
		id: string;
		label: string;
		nodeType: EntityType;
		width: number;
		height: number;
	}

	let simulation: Simulation<D3Node, undefined> | null = null;
	function runForceLayoutAsync(): Promise<void> {
		return new Promise((resolve) => {
			if (nodes.length === 0) {
				resolve();
				return;
			}

			simulation?.stop();

			const d3Nodes: D3Node[] = nodes.map((n) => ({
				id: n.id,
				label: n.label,
				nodeType: n.nodeType,
				width: n.width,
				height: n.height,
				x: n.x ?? Math.random() * width,
				y: n.y ?? Math.random() * height
			}));
			const d3Links: Array<SimulationLinkDatum<D3Node>> = edges.map((e) => ({
				id: e.id,
				source: e.source.id,
				target: e.target.id
			}));

			const n = d3Nodes.length;
			simulation = forceSimulation(d3Nodes)
				.alpha(FORCE_ALPHA)
				.alphaDecay(FORCE_ALPHA_DECAY)
				.force(
					"link",
					forceLink(d3Links)
						.id((d: SimulationNodeDatum) => (d as D3Node).id)
						.distance((l: SimulationLinkDatum<D3Node>) => {
							const s = l.source as D3Node;
							const t = l.target as D3Node;
							return Math.max(FORCE_LINK_DISTANCE_MIN, (s.width + t.width) / 2);
						})
						.strength(FORCE_LINK_STRENGTH)
						.iterations(FORCE_LINK_ITERATIONS)
				)
				.force(
					"charge",
					forceManyBody().strength(-Math.max(FORCE_CHARGE_STRENGTH_BASE, n * FORCE_CHARGE_STRENGTH_PER_NODE))
				)
				.force(
					"collide",
					forceCollide<D3Node>().radius((d) => Math.max(d.width, d.height) / 2 + FORCE_COLLIDE_PADDING)
				)
				.force("x", forceX(width / 2).strength(FORCE_X_Y_STRENGTH))
				.force("y", forceY(height / 2).strength(FORCE_X_Y_STRENGTH));
			simulation.stop();

			const tickCount = Math.max(TICK_COUNT_MIN, Math.min(TICK_COUNT_MAX, n * TICK_COUNT_PER_NODE));
			const CHUNK_SIZE = 70;
			let tick = 0;

			function doChunk() {
				const end = Math.min(tick + CHUNK_SIZE, tickCount);
				for (; tick < end; tick++) {
					simulation!.tick();
				}

				if (tick < tickCount) {
					requestAnimationFrame(doChunk);
					return;
				}

				const positionMap = new Map(d3Nodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]));
				const newNodes = nodes.map((n) => {
					const pos = positionMap.get(n.id);
					return pos ? { ...n, x: pos.x, y: pos.y } : n;
				});
				nodes = newNodes;
				const nodeMap = new Map(newNodes.map((n) => [n.id, n]));
				edges = edges.map((e) => ({
					...e,
					source: nodeMap.get(e.source.id)!,
					target: nodeMap.get(e.target.id)!
				}));
				savePositions();
				resolve();
			}

			requestAnimationFrame(doChunk);
		});
	}

	function buildGraph(s: GraphSettings, existingNodes: Array<{ uri: string; x: number; y: number }>) {
		const graph = createGraphFromTriples(triples, s, existingNodes, prefixMap);
		nodes = graph.nodes;
		edges = graph.edges;
	}

	function handleNodeDrag(node: Node, event: MouseEvent) {
		const rect = containerEl.getBoundingClientRect();
		const mouseX = (event.clientX - rect.left - transform.x) / transform.k;
		const mouseY = (event.clientY - rect.top - transform.y) / transform.k;

		node.x = mouseX - node.width / 2;
		node.y = mouseY - node.height / 2;

		edges = edges.map((e) => {
			if (e.source.id !== node.id && e.target.id !== node.id) return e;
			return {
				...e,
				source: e.source.id === node.id ? node : e.source,
				target: e.target.id === node.id ? node : e.target
			};
		});
	}

	async function rebuildGraph(source: string) {
		if (!triples || triples.length === 0) return;

		logger.debug(`Graph Reloaded (${source})`);

		layoutDone = false;

		buildGraph(tabsStore.getActiveTab()?.settings ?? defaultGraphSettings(), []);
		await runForceLayoutAsync();

		layoutDone = true;
		triplesHash = makeTriplesHash(triples);
	}

	$effect(() => {
		if (reloadTrigger <= lastReloadTrigger) return;
		lastReloadTrigger = reloadTrigger;

		if (tabsStore.getActiveTab()?.locked) return;

		withLoadingOverlay(() => rebuildGraph("Manual"));
	});

	$effect(() => {
		const tab = tabsStore.getActiveTab();
		if (!tab) return;

		const hash = settingsHash(tab.settings);
		if (hash === appliedSettingsHash) return;

		appliedSettingsHash = hash;
		if (!settingsReady) {
			settingsReady = true;
			return;
		}
		if (positionLocked) return;

		withLoadingOverlay(() => rebuildGraph("settings"));
	});

	$effect(() => {
		const tab = tabsStore.getActiveTab();
		if (tab) positionLocked = tab.locked;
	});

	$effect(() => {
		const currentHash = triples ? makeTriplesHash(triples) : "";
		if (currentHash === triplesHash) return;
		triplesHash = currentHash;

		if (!triples || triples.length === 0) {
			nodes = [];
			edges = [];
			layoutDone = false;
			return;
		}

		const tab = tabsStore.getActiveTab();
		if (!tab) return;

		const s = tab.settings ?? defaultGraphSettings();
		positionLocked = tab.locked;
		const pos = tab.nodePositions ?? [];

		let existingNodes: Array<{ uri: string; x: number; y: number }>;
		if (tab.locked && pos.length > 0) {
			existingNodes = pos.map((p) => ({ uri: p.id, x: p.x, y: p.y }));
		} else if (layoutDone) {
			existingNodes = nodes.map((n) => ({ uri: n.uri, x: n.x, y: n.y }));
		} else {
			existingNodes = [];
		}

		withLoadingOverlay(async () => {
			buildGraph(s, existingNodes);

			if (tab.locked) {
				layoutDone = true;
				savePositions();
			} else if (layoutDone) {
				savePositions();
			} else {
				await runForceLayoutAsync();
				layoutDone = true;
				savePositions();
			}
		});
	});

	function handleZoomIn() {
		transform.k = Math.min(transform.k * ZOOM_BUTTON_FACTOR, ZOOM_MAX);
	}

	function handleZoomOut() {
		transform.k = Math.max(transform.k / ZOOM_BUTTON_FACTOR, ZOOM_MIN);
	}

	function handleFitView() {
		if (nodes.length === 0) return;
		const minX = Math.min(...nodes.map((n) => n.x)) - FIT_PADDING;
		const maxX = Math.max(...nodes.map((n) => n.x + n.width)) + FIT_PADDING;
		const minY = Math.min(...nodes.map((n) => n.y)) - FIT_PADDING;
		const maxY = Math.max(...nodes.map((n) => n.y + n.height)) + FIT_PADDING;

		const graphWidth = maxX - minX;
		const graphHeight = maxY - minY;
		const scaleX = width / graphWidth;
		const scaleY = height / graphHeight;
		transform.k = Math.min(scaleX, scaleY, ZOOM_FIT_MAX);
		transform.x = (width - graphWidth * transform.k) / 2 - minX * transform.k;
		transform.y = (height - graphHeight * transform.k) / 2 - minY * transform.k;
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();

		if (event.ctrlKey || event.metaKey) {
			const rect = containerEl.getBoundingClientRect();
			const mouseX = event.clientX - rect.left;
			const mouseY = event.clientY - rect.top;

			const svgX = (mouseX - transform.x) / transform.k;
			const svgY = (mouseY - transform.y) / transform.k;

			const delta = event.deltaY > 0 ? ZOOM_WHEEL_OUT_FACTOR : ZOOM_WHEEL_IN_FACTOR;
			const newK = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, transform.k * delta));

			transform.x = mouseX - svgX * newK;
			transform.y = mouseY - svgY * newK;
			transform.k = newK;
		} else {
			transform.x -= event.deltaX;
			transform.y -= event.deltaY;
		}
	}

	function handleMouseDown(event: MouseEvent) {
		if (event.target !== event.currentTarget) return;

		const startX = event.clientX;
		const startY = event.clientY;
		const startTx = transform.x;
		const startTy = transform.y;

		const onMove = (moveEvent: MouseEvent) => {
			transform.x = startTx + (moveEvent.clientX - startX);
			transform.y = startTy + (moveEvent.clientY - startY);
		};

		const onUp = () => {
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
		};
		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
	}
</script>

<div bind:this={containerEl} class="bg-mantle relative w-full h-full overflow-hidden {className}">
	{#if tabsStore.graphLoading}
		<div class="absolute inset-0 bg-base/75 flex items-center justify-center z-10 gap-1">
			<Spinner />
			<span class="text-sm text-text">Graph Loading...</span>
		</div>
	{/if}
	<svg
		bind:this={svgEl}
		{width}
		{height}
		class="w-full h-full"
		role="presentation"
		onwheel={handleWheel}
		onmousedown={handleMouseDown}
	>
		<g transform="translate({transform.x}, {transform.y}) scale({transform.k})">
			{#each edges as edge (edge.id)}
				<GraphEdge {edge} />
			{/each}

			{#each nodes as node (node.id)}
				<GraphNode {node} locked={positionLocked} onDrag={handleNodeDrag} />
			{/each}
		</g>
	</svg>

	<div class="absolute bottom-4 right-4 flex gap-2">
		<Button
			variant="outline"
			size="sm"
			class="h-6 w-6"
			onclick={toggleLock}
			aria-label={positionLocked ? "Unlock graph" : "Lock graph"}
		>
			{#if positionLocked}
				<Lock class="h-2.5 w-2.5" />
			{:else}
				<LockOpen class="h-2.5 w-2.5" />
			{/if}
		</Button>
		<Button variant="outline" size="sm" class="h-6 w-6" onclick={handleZoomIn} aria-label="Zoom in">
			<Plus class="h-2 w-2" />
		</Button>
		<Button variant="outline" size="sm" class="h-6 w-6" onclick={handleZoomOut} aria-label="Zoom out">
			<Minus class="h-2 w-2" />
		</Button>
		<Button variant="outline" size="sm" class="h-6 w-6" onclick={handleFitView} aria-label="Fit view">
			<Scan class="h-2 w-2" />
		</Button>
	</div>
</div>
