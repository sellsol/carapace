<script lang="ts">
	import type { Node } from "$lib/types/graph";

	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import ChevronUp from "@lucide/svelte/icons/chevron-up";
	import X from "@lucide/svelte/icons/x";

	interface Props {
		nodes: Node[];
		searchOpen: boolean;
		onfocusNode: (node: Node) => void;
	}
	let { nodes, searchOpen = $bindable(false), onfocusNode }: Props = $props();

	let inputEl: HTMLInputElement | null = $state(null);
	let searchQuery = $state("");
	let currentSearchIndex = $state(-1);

	let searchResults = $derived.by(() => {
		if (!searchQuery.trim()) return [];

		const q = searchQuery.toLowerCase();
		return nodes.filter((n) => `${n.prefix ?? ""}:${n.label}`.toLowerCase().includes(q));
	});

	function nextResult() {
		if (searchResults.length === 0) return;

		currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
		onfocusNode(searchResults[currentSearchIndex]);
	}

	function prevResult() {
		if (searchResults.length === 0) return;

		currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
		onfocusNode(searchResults[currentSearchIndex]);
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			event.preventDefault();
			nextResult();
		} else if (event.key === "Escape") {
			searchOpen = false;
		}
	}

	$effect(() => {
		if (searchOpen && inputEl) {
			inputEl.focus();
		}
	});

	$effect(() => {
		const len = searchResults.length;

		if (len === 0) {
			currentSearchIndex = -1;
		} else if (currentSearchIndex >= len) {
			currentSearchIndex = len - 1;
		}
	});
</script>

{#if searchOpen}
	<div
		class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-mantle border border-surface0 rounded-md px-2 py-1 z-20"
	>
		<Button
			variant="outline"
			size="sm"
			class="h-5 w-5 p-0"
			onclick={prevResult}
			disabled={searchResults.length === 0}
			aria-label="Previous result"
		>
			<ChevronUp class="h-3 w-3" />
		</Button>
		<Input
			bind:ref={inputEl}
			bind:value={searchQuery}
			onkeydown={handleSearchKeydown}
			placeholder="Search nodes…"
			class="w-36 h-5 text-xs px-1.5 focus-visible:border-surface0 focus-visible:ring-0"
		/>
		<Button
			variant="outline"
			size="sm"
			class="h-5 w-5 p-0"
			onclick={nextResult}
			disabled={searchResults.length === 0}
			aria-label="Next result"
		>
			<ChevronDown class="h-3 w-3" />
		</Button>
		{#if searchResults.length > 0}
			<span class="text-xs text-subtext0 min-w-[3ch] text-center"
				>{currentSearchIndex + 1}/{searchResults.length}</span
			>
		{/if}
		<Button
			variant="outline"
			size="sm"
			class="h-5 w-5 p-0"
			onclick={() => (searchOpen = false)}
			aria-label="Close search"
		>
			<X class="h-3 w-3" />
		</Button>
	</div>
{/if}
