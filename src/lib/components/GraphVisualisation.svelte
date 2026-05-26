<script lang="ts">
	import GraphEdge from "$lib/components/GraphEdge.svelte";
	import GraphNode from "$lib/components/GraphNode.svelte";
	import type { Quad } from "n3";
	import { onDestroy, onMount } from "svelte";

	import {
		CANVAS_HEIGHT,
		CANVAS_WIDTH,
		FIT_PADDING,
		ZOOM_BUTTON_FACTOR,
		ZOOM_FIT_MAX,
		ZOOM_MAX,
		ZOOM_MIN,
		ZOOM_WHEEL_IN_FACTOR,
		ZOOM_WHEEL_OUT_FACTOR
	} from "$lib/constants/visualisation";
	import { createLogger } from "$lib/logger";
	import { tabsStore } from "$lib/stores/tabs.svelte";
	import type { Edge, Node } from "$lib/types/graph";
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

	let currentTabId = "";
	let positionLocked = $state(false);
	let transform = $state({ x: 0, y: 0, k: 1 });

	let triplesHash = "";
	let appliedSettingsHash = "";
	let settingsReady = false;
	let layoutDone = false;
	let lastReloadTrigger = 0;

	let layoutWorker: Worker | null = null;
	let loadGeneration = 0;

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

	function runLayoutInWorker(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (nodes.length === 0) {
				resolve();
				return;
			}

			const serializedNodes = nodes.map((n) => ({
				id: n.id,
				width: n.width,
				height: n.height,
				x: n.x,
				y: n.y
			}));
			const serializedEdges = edges.map((e) => ({
				id: e.id,
				source: e.source.id,
				target: e.target.id
			}));

			const worker = new Worker(new URL("../workers/forceLayoutWorker.ts", import.meta.url), {
				type: "module"
			});
			layoutWorker = worker;

			worker.onmessage = (e: MessageEvent) => {
				const positions = e.data as Array<{ id: string; x: number; y: number }>;
				const positionMap = new Map(positions.map((p) => [p.id, { x: p.x, y: p.y }]));

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

				layoutWorker = null;
				worker.terminate();
				resolve();
			};

			worker.onerror = (err) => {
				logger.error("Layout worker error", err);

				layoutWorker = null;
				worker.terminate();
				reject(err);
			};

			worker.postMessage({
				nodes: serializedNodes,
				edges: serializedEdges,
				width,
				height
			});
		});
	}

	function buildGraph(s: GraphSettings, existingNodes: Array<{ uri: string; x: number; y: number }>) {
		const graph = createGraphFromTriples(triples, s, existingNodes, prefixMap);
		nodes = graph.nodes;
		edges = graph.edges;
	}

	function runLayoutPipeline(fn: (gen: number) => Promise<void>) {
		const gen = ++loadGeneration;
		tabsStore.graphLoading = true;

		if (layoutWorker) {
			layoutWorker.terminate();
			layoutWorker = null;
		}

		requestAnimationFrame(async () => {
			if (gen !== loadGeneration) return;

			await fn(gen);
			if (gen !== loadGeneration) return;

			tabsStore.graphLoading = false;
		});
	}

	async function runLayout(gen: number) {
		if (!triples || triples.length === 0) return;
		logger.debug("Graph Reloaded");

		layoutDone = false;

		buildGraph(tabsStore.getActiveTab()?.settings ?? defaultGraphSettings(), []);
		await runLayoutInWorker();
		if (gen !== loadGeneration) return;

		layoutDone = true;
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
		if (layoutWorker) {
			layoutWorker.terminate();
			layoutWorker = null;
		}
		savePositions();
		tabsStore.exportSvg = null;
	});

	$effect(() => {
		if (reloadTrigger <= lastReloadTrigger) return;
		lastReloadTrigger = reloadTrigger;

		if (tabsStore.getActiveTab()?.locked) return;

		runLayoutPipeline((gen) => runLayout(gen));
		triplesHash = makeTriplesHash(triples);
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

		runLayoutPipeline((gen) => runLayout(gen));
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
			tabsStore.graphLoading = false;
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

		runLayoutPipeline(async (gen) => {
			buildGraph(s, existingNodes);

			if (tab.locked) {
				layoutDone = true;
				savePositions();
				return;
			}
			if (layoutDone) {
				savePositions();
				return;
			}

			await runLayoutInWorker();
			if (gen !== loadGeneration) return;
			layoutDone = true;
			savePositions();
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
		class="w-full h-full {tabsStore.graphLoading ? 'invisible' : ''}"
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
