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
	import { exportSvg } from "$lib/utils/export";
	import { defaultGraphSettings, makeSettingsHash } from "$lib/utils/settings";
	import { createGraphFromTriples, makeTriplesHash } from "$lib/utils/visualisation";

	import { Button } from "$lib/components/ui/button";
	import { Spinner } from "$lib/components/ui/spinner";
	import Lock from "@lucide/svelte/icons/lock";
	import LockOpen from "@lucide/svelte/icons/lock-open";
	import Minus from "@lucide/svelte/icons/minus";
	import MousePointer2 from "@lucide/svelte/icons/mouse-pointer-2";
	import Plus from "@lucide/svelte/icons/plus";
	import Scan from "@lucide/svelte/icons/scan";
	import SquareMousePointer from "@lucide/svelte/icons/square-mouse-pointer";

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
	let transform = $state(tabsStore.getActiveTab()?.camera ?? { x: 0, y: 0, k: 1 });

	let nodes = $state<Node[]>([]);
	let edges = $state<Edge[]>([]);
	let currentTabId = "";

	let triplesHash = "";
	let settingsHash = makeSettingsHash(tabsStore.getActiveTab()?.settings ?? defaultGraphSettings());
	let layoutDone = false;
	let lastReloadTrigger = 0;
	let loadGeneration = 0;

	let layoutWorker: Worker | null = null;

	let lockedMode = $state(tabsStore.getActiveTab()?.locked ?? false);
	let boxSelectMode = $state(false);
	let boxSelectArea = $state<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
	let selectedNodeIds = $state<Set<string>>(new Set());
	let selectedNodeStartPositions = $state<Map<string, { x: number; y: number }>>(new Map());

	let dragStartX = 0;
	let dragStartY = 0;
	let dragStartTx = 0;
	let dragStartTy = 0;

	function savePositions() {
		if (!currentTabId) return;

		const tab = tabsStore.getTab(currentTabId);
		if (!tab) return;

		tab.nodePositions = nodes.map((n) => ({ id: n.uri, x: n.x, y: n.y }));
	}

	function getPositions(): Array<{ uri: string; x: number; y: number }> {
		const tab = tabsStore.getActiveTab();
		if (!tab) return [];

		const nodePositions = tab.nodePositions ?? [];
		if (tab.locked && nodePositions.length > 0) {
			return nodePositions.map((p) => ({ uri: p.id, x: p.x, y: p.y }));
		}
		if (layoutDone) {
			return nodes.map((n) => ({ uri: n.uri, x: n.x, y: n.y }));
		}
		return [];
	}

	function toggleLockMode() {
		savePositions();

		lockedMode = !lockedMode;
		tabsStore.setActiveTabLocked(lockedMode);
	}

	function toggleSelectMode() {
		boxSelectMode = !boxSelectMode;
		if (!boxSelectMode) boxSelectArea = null;
	}

	function postToWorker(data: {
		nodes: Array<{ id: string; width: number; height: number; x: number; y: number }>;
		edges: Array<{ id: string; source: string; target: string }>;
		width: number;
		height: number;
	}): Promise<Array<{ id: string; x: number; y: number }>> {
		return new Promise((resolve, reject) => {
			const worker = new Worker(new URL("../workers/forceLayoutWorker.ts", import.meta.url), {
				type: "module"
			});
			layoutWorker = worker;

			worker.onmessage = (e: MessageEvent) => {
				layoutWorker = null;
				worker.terminate();
				resolve(e.data);
			};

			worker.onerror = (err) => {
				logger.error("Layout worker error", err);

				layoutWorker = null;
				worker.terminate();
				reject(err);
			};

			worker.postMessage(data);
		});
	}

	async function runLayoutWorker() {
		if (nodes.length === 0) return;

		const positions = await postToWorker({
			nodes: nodes.map((n) => ({ id: n.id, width: n.width, height: n.height, x: n.x, y: n.y })),
			edges: edges.map((e) => ({ id: e.id, source: e.source.id, target: e.target.id })),
			width,
			height
		});
		const positionMap = new Map(positions.map((p) => [p.id, { x: p.x, y: p.y }]));

		const newNodes = nodes.map((n) => {
			const position = positionMap.get(n.id);
			return position ? { ...n, x: position.x, y: position.y } : n;
		});
		nodes = newNodes;

		const nodeMap = new Map(newNodes.map((n) => [n.id, n]));
		edges = edges.map((e) => ({
			...e,
			source: nodeMap.get(e.source.id)!,
			target: nodeMap.get(e.target.id)!
		}));
	}

	function buildGraph(settings: GraphSettings, nodePositions: Array<{ uri: string; x: number; y: number }>) {
		const graph = createGraphFromTriples(triples, settings, nodePositions, prefixMap);

		nodes = graph.nodes;
		edges = graph.edges;
		tabsStore.activeNodeCount = nodes.length;
		tabsStore.activeEdgeCount = edges.length;
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

	async function rebuildLayout(gen: number) {
		if (!triples || triples.length === 0) return;

		layoutDone = false;

		buildGraph(tabsStore.getActiveTab()?.settings ?? defaultGraphSettings(), []);
		await runLayoutWorker();
		if (gen !== loadGeneration) return;

		handleFitView();
		layoutDone = true;
	}

	function handleNodeDrag(node: Node, event: MouseEvent) {
		const rect = containerEl.getBoundingClientRect();
		const mouseX = (event.clientX - rect.left - transform.x) / transform.k;
		const mouseY = (event.clientY - rect.top - transform.y) / transform.k;

		const start = selectedNodeStartPositions.get(node.id);
		if (!start) return;

		const dx = mouseX - node.width / 2 - start.x;
		const dy = mouseY - node.height / 2 - start.y;

		for (const [id, position] of selectedNodeStartPositions) {
			const n = nodes.find((n) => n.id === id);
			if (n) {
				n.x = position.x + dx;
				n.y = position.y + dy;
			}
		}

		edges = edges.map((e) => {
			if (selectedNodeStartPositions.has(e.source.id) || selectedNodeStartPositions.has(e.target.id)) {
				return {
					...e,
					source: nodes.find((n) => n.id === e.source.id)!,
					target: nodes.find((n) => n.id === e.target.id)!
				};
			}
			return e;
		});
	}

	function handleNodeDragStart(node: Node, event: MouseEvent) {
		if (event.ctrlKey || event.metaKey) {
			const next = new Set(selectedNodeIds);
			if (next.has(node.id)) next.delete(node.id);
			else next.add(node.id);

			selectedNodeIds = next;
		} else if (!selectedNodeIds.has(node.id)) {
			selectedNodeIds = new Set([node.id]);
		}

		selectedNodeStartPositions = new Map();
		for (const id of selectedNodeIds) {
			const n = nodes.find((n) => n.id === id);
			if (n) selectedNodeStartPositions.set(id, { x: n.x, y: n.y });
		}
	}

	function handleNodeDragEnd() {
		savePositions();

		selectedNodeStartPositions = new Map();
		tabsStore.scheduleSave();
	}

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

	function handleMouseMove(event: MouseEvent) {
		if (boxSelectMode && boxSelectArea) {
			const rect = containerEl.getBoundingClientRect();
			boxSelectArea = {
				...boxSelectArea,
				x2: (event.clientX - rect.left - transform.x) / transform.k,
				y2: (event.clientY - rect.top - transform.y) / transform.k
			};
		} else {
			transform.x = dragStartTx + (event.clientX - dragStartX);
			transform.y = dragStartTy + (event.clientY - dragStartY);
		}
	}

	function handleMouseUp(event: MouseEvent) {
		const dragged = Math.abs(event.clientX - dragStartX) > 2 || Math.abs(event.clientY - dragStartY) > 2;

		if (dragged && boxSelectMode && boxSelectArea) {
			const x1 = Math.min(boxSelectArea.x1, boxSelectArea.x2);
			const y1 = Math.min(boxSelectArea.y1, boxSelectArea.y2);
			const x2 = Math.max(boxSelectArea.x1, boxSelectArea.x2);
			const y2 = Math.max(boxSelectArea.y1, boxSelectArea.y2);

			const next = new Set<string>();
			for (const n of nodes) {
				if (n.x < x2 && n.x + n.width > x1 && n.y < y2 && n.y + n.height > y1) {
					next.add(n.id);
				}
			}

			selectedNodeIds = next;
		} else if (!dragged && boxSelectMode) {
			selectedNodeIds = new Set();
		}

		boxSelectArea = null;
		document.removeEventListener("mousemove", handleMouseMove);
		document.removeEventListener("mouseup", handleMouseUp);
	}

	function handleMouseDown(event: MouseEvent) {
		if (event.target !== event.currentTarget) return;

		dragStartX = event.clientX;
		dragStartY = event.clientY;
		dragStartTx = transform.x;
		dragStartTy = transform.y;

		if (boxSelectMode) {
			const rect = containerEl.getBoundingClientRect();
			boxSelectArea = {
				x1: (event.clientX - rect.left - transform.x) / transform.k,
				y1: (event.clientY - rect.top - transform.y) / transform.k,
				x2: (event.clientX - rect.left - transform.x) / transform.k,
				y2: (event.clientY - rect.top - transform.y) / transform.k
			};
		}

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
	}

	$effect(() => {
		if (reloadTrigger <= lastReloadTrigger) return;
		lastReloadTrigger = reloadTrigger;

		if (tabsStore.getActiveTab()?.locked) return;

		runLayoutPipeline((gen) => rebuildLayout(gen));
	});

	$effect(() => {
		const tab = tabsStore.getActiveTab();
		if (!tab) return;

		const hash = makeSettingsHash(tab.settings);
		if (hash === settingsHash) return;

		settingsHash = hash;
		if (lockedMode) return;

		runLayoutPipeline((gen) => rebuildLayout(gen));
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

		const settings = tab.settings ?? defaultGraphSettings();
		const nodePositions = getPositions();

		runLayoutPipeline(async (gen) => {
			buildGraph(settings, nodePositions);

			if (tab.locked) {
				layoutDone = true;
				savePositions();
				return;
			}
			if (layoutDone) {
				savePositions();
				return;
			}

			await runLayoutWorker();
			if (gen !== loadGeneration) return;

			layoutDone = true;
			savePositions();

			if (!tab.camera) {
				handleFitView();
			}
		});
	});

	onMount(() => {
		currentTabId = tabsStore.activeTabId;
		tabsStore.exportSvg = () => exportSvg(svgEl, nodes, transform);

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

		const tab = tabsStore.getTab(currentTabId);
		if (tab) tab.camera = { ...transform };

		savePositions();
		tabsStore.flushSave();
		tabsStore.exportSvg = null;
	});
</script>

<div bind:this={containerEl} class="bg-mantle relative w-full h-full overflow-hidden select-none {className}">
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
		class="w-full h-full {boxSelectMode ? 'cursor-crosshair' : ''} {tabsStore.graphLoading ? 'invisible' : ''}"
		role="presentation"
		onwheel={handleWheel}
		onmousedown={handleMouseDown}
		oncontextmenu={(e) => e.preventDefault()}
	>
		<g transform="translate({transform.x}, {transform.y}) scale({transform.k})">
			{#if boxSelectArea}
				<rect
					x={Math.min(boxSelectArea.x1, boxSelectArea.x2)}
					y={Math.min(boxSelectArea.y1, boxSelectArea.y2)}
					width={Math.abs(boxSelectArea.x2 - boxSelectArea.x1)}
					height={Math.abs(boxSelectArea.y2 - boxSelectArea.y1)}
					fill="var(--blue)"
					fill-opacity="0.1"
					stroke="var(--blue)"
					stroke-width="1.5"
					stroke-dasharray="4,2"
					rx="6"
					pointer-events="none"
				/>
			{/if}
			{#each edges as edge (edge.id)}
				<GraphEdge {edge} />
			{/each}

			{#each nodes as node (node.id)}
				<GraphNode
					{node}
					locked={lockedMode}
					selected={boxSelectMode && selectedNodeIds.has(node.id)}
					onDrag={handleNodeDrag}
					onDragStart={handleNodeDragStart}
					onDragEnd={handleNodeDragEnd}
				/>
			{/each}
		</g>
	</svg>

	<div class="absolute bottom-4 right-4 flex gap-2">
		<Button
			variant="outline"
			size="sm"
			class="h-6 w-6 {boxSelectMode ? 'bg-blue/15 border-blue' : ''}"
			onclick={toggleSelectMode}
			aria-label={boxSelectMode ? "Switch to pan mode" : "Switch to select mode"}
		>
			{#if boxSelectMode}
				<SquareMousePointer class="h-2.5 w-2.5" />
			{:else}
				<MousePointer2 class="h-2.5 w-2.5" />
			{/if}
		</Button>
		<Button
			variant="outline"
			size="sm"
			class="h-6 w-6"
			onclick={toggleLockMode}
			aria-label={lockedMode ? "Unlock graph" : "Lock graph"}
		>
			{#if lockedMode}
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
