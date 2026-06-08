<script lang="ts">
	import { ENTITY_TYPE_DISPLAY } from "$lib/constants/entity";
	import { BUILTIN_NS_TO_PREFIX, BUILTIN_PREFIX_TO_NS } from "$lib/constants/namespaces";
	import { tabsStore } from "$lib/stores/tabs.svelte";
	import type { EntityType } from "$lib/types/graph";
	import type { Tab } from "$lib/types/tabs";
	import { defaultGraphSettings } from "$lib/utils/settings";

	import Button from "./ui/button/button.svelte";

	import { Checkbox } from "$lib/components/ui/checkbox";
	import { Input } from "$lib/components/ui/input";
	import Lock from "@lucide/svelte/icons/lock";
	import X from "@lucide/svelte/icons/x";

	let newNamespace = $state("");
	let newPredicate = $state("");
	let newClassUri = $state("");
	let settings = $state(defaultGraphSettings());

	const lockedMode = $derived(tabsStore.getActiveTab()?.locked ?? false);

	const allPrefixToUri = $derived<Record<string, string>>({
		...BUILTIN_PREFIX_TO_NS,
		...invertPrefixMap(tabsStore.getActiveTab()?.parsedPrefixMap ?? {})
	});

	const allUriToPrefix = $derived<Record<string, string>>({
		...BUILTIN_NS_TO_PREFIX,
		...(tabsStore.getActiveTab()?.parsedPrefixMap ?? {})
	});

	$effect(() => {
		const tab = tabsStore.getActiveTab();
		if (!tab) return;
		const s = tab.settings;
		settings = {
			duplicateExternalNodes: s.duplicateExternalNodes,
			hiddenNamespaces: [...s.hiddenNamespaces],
			hiddenEntityTypes: [...s.hiddenEntityTypes],
			hiddenPredicateUris: [...s.hiddenPredicateUris],
			hiddenInstanceOfUris: [...s.hiddenInstanceOfUris]
		};
	});

	function update(newSettings: Partial<Tab["settings"]>) {
		tabsStore.updateActiveTabSettings(newSettings);
	}

	function toggleEntityType(type: EntityType) {
		const isHidden = settings.hiddenEntityTypes.includes(type);
		if (isHidden) {
			update({ hiddenEntityTypes: settings.hiddenEntityTypes.filter((t) => t !== type) });
		} else {
			update({ hiddenEntityTypes: [...settings.hiddenEntityTypes, type] });
		}
	}

	function addNamespace() {
		const val = resolvePrefixed(newNamespace.trim());
		if (val && !settings.hiddenNamespaces.includes(val)) {
			update({ hiddenNamespaces: [...settings.hiddenNamespaces, val] });
		}
		newNamespace = "";
	}

	function removeNamespace(ns: string) {
		update({ hiddenNamespaces: settings.hiddenNamespaces.filter((n) => n !== ns) });
	}

	function addPredicate() {
		const val = resolvePrefixed(newPredicate.trim());
		if (val && !settings.hiddenPredicateUris.includes(val)) {
			update({ hiddenPredicateUris: [...settings.hiddenPredicateUris, val] });
		}
		newPredicate = "";
	}

	function removePredicate(uri: string) {
		update({ hiddenPredicateUris: settings.hiddenPredicateUris.filter((u) => u !== uri) });
	}

	function addInstanceOfUri() {
		const val = resolvePrefixed(newClassUri.trim());
		if (val && !settings.hiddenInstanceOfUris.includes(val)) {
			update({ hiddenInstanceOfUris: [...settings.hiddenInstanceOfUris, val] });
		}
		newClassUri = "";
	}

	function removeInstanceOfUri(uri: string) {
		update({ hiddenInstanceOfUris: settings.hiddenInstanceOfUris.filter((u) => u !== uri) });
	}

	function resetDefaults() {
		update(defaultGraphSettings());
	}

	function invertPrefixMap(m: Record<string, string>): Record<string, string> {
		const result: Record<string, string> = {};
		for (const [ns, p] of Object.entries(m)) {
			result[p] = ns;
		}
		return result;
	}

	function resolvePrefixed(input: string): string {
		const colon = input.indexOf(":");
		if (colon <= 0) return input;
		const prefix = input.slice(0, colon);
		const local = input.slice(colon + 1);
		const ns = allPrefixToUri[prefix];
		return ns ? ns + local : input;
	}

	function shortLabel(uri: string): string {
		for (const [ns, prefix] of Object.entries(allUriToPrefix)) {
			if (uri.startsWith(ns)) return prefix + ":" + uri.slice(ns.length);
		}
		return uri;
	}
</script>

<div class="h-full overflow-y-auto p-4 text-sm text-text bg-base">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-lg font-semibold">Graph Settings</h2>
		<button class="text-xs text-subtext-0 hover:text-text underline" onclick={resetDefaults} disabled={lockedMode}>
			Reset to defaults
		</button>
	</div>

	{#if lockedMode}
		<div
			class="flex items-center gap-2 rounded border border-yellow bg-yellow/30 p-3 mb-4 text-xs text-[color-mix(in_srgb,var(--color-yellow)_80%,black)]"
		>
			<Lock class="size-3.5 shrink-0" />
			<span>Graph for this tab is locked — code and settings cannot be changed while locked.</span>
		</div>
	{/if}

	<div class="space-y-1.5 mb-5 pb-4 border-b border-surface-0">
		<h3 class="text-xs font-semibold text-subtext-0 uppercase tracking-wider mb-2">Special</h3>
		<div
			class="flex items-center gap-2 enabled:cursor-pointer"
			role="button"
			tabindex="0"
			onclick={() => {
				if (lockedMode) return;
				update({ duplicateExternalNodes: !settings.duplicateExternalNodes });
			}}
			onkeydown={(e) => {
				if (lockedMode) return;
				e.key === "Enter" && update({ duplicateExternalNodes: !settings.duplicateExternalNodes });
			}}
		>
			<Checkbox checked={settings.duplicateExternalNodes} disabled={lockedMode} />
			<span class="select-none text-text">Duplicate externally defined nodes</span>
		</div>
		<!-- TODO: add back and sync to hidden predicate objects list -->
		<!-- <div
			class="flex items-center gap-2 cursor-pointer"
			role="button"
			tabindex="0"
			onclick={() => update({ showLabels: !settings.showLabels })}
			onkeydown={(e) => e.key === "Enter" && update({ showLabels: !settings.showLabels })}
		>
			<Checkbox checked={settings.showLabels} />
			<span class="select-none text-text">Show labels</span>
		</div> -->
	</div>

	<div class="mb-5 pb-4 border-b border-surface-0">
		<h3 class="text-xs font-semibold text-subtext-0 uppercase tracking-wider mb-2">Displayed Entity Types</h3>
		<p class="text-xs text-subtext-0 mb-2">Nodes of these types are displayed in the graph, others are hidden.</p>
		<div class="space-y-1.5">
			{#each ENTITY_TYPE_DISPLAY as { type, label }}
				<div
					class="flex items-center gap-2 enabled:cursor-pointer"
					role="button"
					tabindex="0"
					onclick={() => {
						if (lockedMode) return;
						toggleEntityType(type);
					}}
					onkeydown={(e) => {
						if (lockedMode) return;
						e.key === "Enter" && toggleEntityType(type);
					}}
				>
					<Checkbox checked={!settings.hiddenEntityTypes.includes(type)} disabled={lockedMode} />
					<span class="select-none text-text">{label}</span>
				</div>
			{/each}
		</div>
	</div>

	<div class="mb-5 pb-4 border-b border-surface-0">
		<h3 class="text-xs font-semibold text-subtext-0 uppercase tracking-wider mb-2">Hidden Namespaces</h3>
		<p class="text-xs text-subtext-0 mb-2">Nodes which URI starts with these prefixes are hidden.</p>
		<div class="flex gap-2 mb-2">
			<Input
				type="text"
				placeholder="http://example.org/ns#"
				bind:value={newNamespace}
				class="text-text h-7.5"
				disabled={lockedMode}
				onkeydown={(e) => {
					if (lockedMode) return;
					if (e.key === "Enter") addNamespace();
				}}
			/>
			<Button
				size="sm"
				variant="default"
				class="text-xs bg-flamingo hover:bg-flamingo/80"
				onclick={addNamespace}
				disabled={lockedMode}>Add</Button
			>
		</div>
		<div class="flex flex-wrap gap-1.5">
			{#each settings.hiddenNamespaces as ns}
				<span class="inline-flex items-center gap-1 bg-surface-0 text-subtext-0 rounded px-2 py-0.5 text-xs">
					<span title={ns}>{shortLabel(ns)}</span>
					<button
						class="enabled:hover:text-red enabled:cursor-pointer group"
						disabled={lockedMode}
						onclick={() => removeNamespace(ns)}
					>
						<X class="size-3 group-disabled:hidden" />
					</button>
				</span>
			{/each}
		</div>
	</div>

	<div class="mb-5 pb-4 border-b border-surface-0">
		<h3 class="text-xs font-semibold text-subtext-0 uppercase tracking-wider mb-2">Hidden Predicate Objects</h3>
		<p class="text-xs text-subtext-0 mb-2">Nodes which are objects of these predicates are hidden.</p>
		<div class="flex gap-2 mb-2">
			<Input
				type="text"
				placeholder="http://www.w3.org/2000/01/rdf-schema#label"
				bind:value={newPredicate}
				class="text-text h-7.5"
				disabled={lockedMode}
				onkeydown={(e) => {
					if (lockedMode) return;
					if (e.key === "Enter") addPredicate();
				}}
			/>
			<Button
				size="sm"
				variant="default"
				class="text-xs bg-flamingo hover:bg-flamingo/80"
				onclick={addPredicate}
				disabled={lockedMode}>Add</Button
			>
		</div>
		<div class="flex flex-wrap gap-1.5">
			{#each settings.hiddenPredicateUris as uri}
				<span class="inline-flex items-center gap-1 bg-surface-0 text-subtext-0 rounded px-2 py-0.5 text-xs">
					<span title={uri}>{shortLabel(uri)}</span>
					<button
						class="enabled:hover:text-red enabled:cursor-pointer group"
						disabled={lockedMode}
						onclick={() => removePredicate(uri)}
					>
						<X class="size-3 group-disabled:hidden" />
					</button>
				</span>
			{/each}
		</div>
	</div>

	<div class="mb-5">
		<h3 class="text-xs font-semibold text-subtext-0 uppercase tracking-wider mb-2">Hidden Instance-of URIs</h3>
		<p class="text-xs text-subtext-0 mb-2">
			Nodes which direct <code class="text-peach">rdf:type</code> is one of these URIs are hidden.
		</p>
		<div class="flex gap-2 mb-2">
			<Input
				type="text"
				placeholder="http://www.w3.org/2002/07/owl#Ontology"
				bind:value={newClassUri}
				class="text-text h-7.5"
				disabled={lockedMode}
				onkeydown={(e) => {
					if (lockedMode) return;
					if (e.key === "Enter") addInstanceOfUri();
				}}
			/>
			<Button
				size="sm"
				variant="default"
				class="text-xs bg-flamingo hover:bg-flamingo/80"
				onclick={addInstanceOfUri}
				disabled={lockedMode}>Add</Button
			>
		</div>
		<div class="flex flex-wrap gap-1.5">
			{#each settings.hiddenInstanceOfUris as uri}
				<span class="inline-flex items-center gap-1 bg-surface-0 text-subtext-0 rounded px-2 py-0.5 text-xs">
					<span title={uri}>{shortLabel(uri)}</span>
					<button
						class="enabled:hover:text-red enabled:cursor-pointer group"
						disabled={lockedMode}
						onclick={() => removeInstanceOfUri(uri)}
					>
						<X class="size-3 group-disabled:hidden" />
					</button>
				</span>
			{/each}
		</div>
	</div>
</div>
