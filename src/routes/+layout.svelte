<script lang="ts">
	import { ModeWatcher, mode, toggleMode } from "mode-watcher";

	import { tabsStore } from "$lib/stores/tabs.svelte";

	import "../app.css";

	import { Button } from "$lib/components/ui/button";
	import { Toaster } from "$lib/components/ui/sonner";
	import Moon from "@lucide/svelte/icons/moon";
	import Sun from "@lucide/svelte/icons/sun";
	import Turtle from "@lucide/svelte/icons/turtle";

	const { children } = $props();

	function handleBeforeUnload() {
		tabsStore.flushSave();
	}

	function handleVisibilityChange() {
		if (document.visibilityState === "hidden") tabsStore.flushSave();
	}
</script>

<svelte:head>
	<title>Carapace - Turtle File Graph Visualiser</title>
</svelte:head>

<div class="h-screen flex flex-col bg-background">
	<header class="h-12 border-b bg-card flex items-center px-4">
		<Turtle class="h-7 w-7 pr-1"></Turtle>
		<h1 class="text-accent-foreground font-semibold mr-2">Carapace</h1>
		<span class="text-muted-foreground">v0.1.0</span>

		<div class="ml-auto flex items-center gap-2">
			<Button size="sm" variant="ghost" onclick={toggleMode} class="h-8 w-8 px-0">
				{#if mode.current === "light"}
					<Moon class="h-4 w-4" />
				{:else}
					<Sun class="h-4 w-4" />
				{/if}
			</Button>
		</div>
	</header>
	{@render children?.()}
</div>

<ModeWatcher />
<Toaster />
<svelte:window on:beforeunload={handleBeforeUnload} />
<svelte:document on:visibilitychange={handleVisibilityChange} />
