<script lang="ts">
	import CodeEditor from "$lib/components/CodeEditor.svelte";
	import EditorToolbar from "$lib/components/EditorToolbar.svelte";
	import GraphSettings from "$lib/components/GraphSettings.svelte";
	import GraphVisualisation from "$lib/components/GraphVisualisation.svelte";
	import TabBar from "$lib/components/TabBar.svelte";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	import { SAMPLE_TURTLE } from "$lib/constants/sample";
	import { createLogger } from "$lib/logger";
	import { tabsStore } from "$lib/stores/tabs.svelte";
	import { lineForNodeUri } from "$lib/utils/lines";

	import { Button } from "$lib/components/ui/button";
	import * as Resizable from "$lib/components/ui/resizable/index.js";
	import ArrowLeft from "@lucide/svelte/icons/arrow-left";
	import ArrowRight from "@lucide/svelte/icons/arrow-right";

	const logger = createLogger("app");
	let editorValue = $state("");
	let editorMode = $state<"code" | "settings">("code");
	let isMobile = $state(false);
	let lockedMode = $derived(tabsStore.getActiveTab()?.locked ?? false);

	let codeEditor = $state<ReturnType<typeof CodeEditor>>();
	let graphVis = $state<ReturnType<typeof GraphVisualisation>>();

	const goToNodeUri = $derived(
		editorMode === "code" && graphVis
			? (tabsStore.activeLineMapping?.lineToUris
					.get(tabsStore.editorCursorLine)
					?.find((uri) => graphVis!.nodes.some((n) => n.uri === uri)) ?? null)
			: null
	);
	const goToLineTarget = $derived(
		editorMode === "code" && codeEditor && tabsStore.selectedNodeUri
			? lineForNodeUri(tabsStore.selectedNodeUri, tabsStore.activeLineMapping)
			: null
	);

	const goToNodeDisabled = $derived(!goToNodeUri);
	const goToLineDisabled = $derived(!goToLineTarget);

	function handleGoToNode() {
		if (goToNodeUri) graphVis?.focusGraphNode(goToNodeUri);
	}

	function handleGoToLine() {
		if (goToLineTarget) codeEditor?.scrollToLine(goToLineTarget);
	}

	function toggleSettings() {
		editorMode = editorMode === "code" ? "settings" : "code";
	}

	function clearContent() {
		editorValue = "";
	}

	async function copyContent() {
		try {
			await navigator.clipboard.writeText(editorValue);
			toast.success("Copied to clipboard");
		} catch (e) {
			toast.error("Copy to clipboard failed");
			logger.error("Copy To Clipboard - Failed", e);
		}
	}

	function handleUnload() {
		tabsStore.flushSave();
	}

	$effect(() => {
		const tab = tabsStore.getActiveTab();
		if (tab) {
			editorValue = tab.ttlContent;
		}
	});

	$effect(() => {
		const tab = tabsStore.getActiveTab();
		if (tab && editorValue !== tab.ttlContent) {
			tabsStore.updateActiveTabContent(editorValue);
		}
	});

	onMount(() => {
		isMobile = window.innerWidth < 768;
		tabsStore.loadFromStorage();
		if (tabsStore.tabs.length === 0) {
			tabsStore.addTab("File 1", SAMPLE_TURTLE);
		}
	});
</script>

<svelte:window onbeforeunload={handleUnload} />

{#if isMobile}
	<div class="flex items-center justify-center p-8 h-full">
		<div class="max-w-sm text-center">
			<h2 class="text-2xl font-semibold mb-3 text-text">Desktop only</h2>
			<p>Carapace does not currently support mobile screens. Please open it on a desktop or tablet.</p>
		</div>
	</div>
{:else}
	<TabBar />

	<Resizable.PaneGroup direction="horizontal" class="flex-1">
		<Resizable.Pane defaultSize={30} minSize={20}>
			<div class="h-full flex flex-col overflow-hidden">
				<EditorToolbar
					{lockedMode}
					onclear={clearContent}
					oncopy={copyContent}
					onreload={() => tabsStore.graphReloadCount++}
					settingsMode={editorMode === "settings"}
					onToggleSettings={toggleSettings}
				/>
				<div class="flex-1 overflow-hidden">
					{#key tabsStore.activeTabId + editorMode}
						{#if editorMode === "code"}
							<CodeEditor bind:value={editorValue} bind:this={codeEditor} {lockedMode} />
						{:else}
							<GraphSettings />
						{/if}
					{/key}
				</div>
			</div>
		</Resizable.Pane>

		<Resizable.Handle>
			<div
				class="pointer-events-none absolute inset-y-0 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center justify-center gap-1.5"
			>
				<Button
					variant="outline"
					size="icon-sm"
					class="pointer-events-auto"
					disabled={goToNodeDisabled}
					title="Go to node at editor cursor line"
					onmousedown={(e) => e.stopPropagation()}
					ontouchstart={(e) => e.stopPropagation()}
					onclick={handleGoToNode}
				>
					<ArrowRight />
				</Button>
				<Button
					variant="outline"
					size="icon-sm"
					class="pointer-events-auto"
					disabled={goToLineDisabled}
					title="Go to editor line of selected node"
					onmousedown={(e) => e.stopPropagation()}
					ontouchstart={(e) => e.stopPropagation()}
					onclick={handleGoToLine}
				>
					<ArrowLeft />
				</Button>
			</div>
		</Resizable.Handle>

		<Resizable.Pane defaultSize={50} minSize={20}>
			<div class="h-full flex flex-1 flex-col overflow-hidden">
				{#key tabsStore.activeTabId}
					{#if tabsStore.activeTriples}
						<GraphVisualisation
							triples={tabsStore.activeTriples}
							prefixMap={tabsStore.activePrefixMap}
							reloadTrigger={tabsStore.graphReloadCount}
							bind:this={graphVis}
							class="h-full"
						/>
					{/if}
				{/key}
			</div>
		</Resizable.Pane>
	</Resizable.PaneGroup>

	<footer class="h-8 border-t bg-card flex items-center justify-between px-4 text-sm text-muted-foreground">
		<span>
			{#if tabsStore.activeError}
				<span class="text-destructive">{tabsStore.activeError}</span>
			{:else if tabsStore.graphLoading}
				<span>Graph Loading...</span>
			{:else if tabsStore.activeTriples}
				<span>Graph Loaded</span>
			{:else}
				<span>Ready</span>
			{/if}
		</span>
		{#if tabsStore.activeTriples}
			<span class="tabular-nums">{tabsStore.activeNodeCount} nodes, {tabsStore.activeEdgeCount} edges</span>
		{/if}
	</footer>
{/if}
