<script lang="ts">
	import { toast } from "svelte-sonner";

	import { createLogger } from "$lib/logger";
	import { tabsStore } from "$lib/stores/tabs.svelte";
	import { downloadBlob } from "$lib/utils/export";

	import { Button } from "$lib/components/ui/button";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { Input } from "$lib/components/ui/input";
	import * as Tabs from "$lib/components/ui/tabs";
	import Copy from "@lucide/svelte/icons/copy";
	import Download from "@lucide/svelte/icons/download";
	import Edit2 from "@lucide/svelte/icons/edit-2";
	import FileCode from "@lucide/svelte/icons/file-code";
	import FileImage from "@lucide/svelte/icons/file-image";
	import MoreVertical from "@lucide/svelte/icons/more-vertical";
	import Plus from "@lucide/svelte/icons/plus";
	import Turtle from "@lucide/svelte/icons/turtle";
	import Upload from "@lucide/svelte/icons/upload";
	import X from "@lucide/svelte/icons/x";

	const logger = createLogger("TabBar");

	let renamingTabId = $state<string | null>(null);
	let renameInput = $state<string>("");
	let dragTabId = $state<string | null>(null);
	let dropIndex = $state<number | null>(null);

	function handleTabChange(value: string | undefined) {
		if (!value) return;

		tabsStore.switchTab(value);
	}

	function handleNewTab() {
		tabsStore.addTab();
	}

	function handleCloseTab(e: MouseEvent, id: string) {
		e.stopPropagation();
		tabsStore.closeTab(id);
	}

	function startRename(id: string) {
		const tab = tabsStore.getTab(id);
		if (!tab) return;

		renamingTabId = id;
		renameInput = tab.name;
	}

	function confirmRename() {
		if (!renamingTabId || !renameInput.trim()) return;

		tabsStore.renameTab(renamingTabId, renameInput.trim());
		renamingTabId = null;
		renameInput = "";
	}

	function cancelRename() {
		renamingTabId = null;
		renameInput = "";
	}

	function handleRenameKeyDown(event: KeyboardEvent) {
		event.stopPropagation();

		if (event.key === "Enter") {
			confirmRename();
		} else if (event.key === "Escape") {
			cancelRename();
		}
	}

	function handleDuplicateTab(id: string) {
		tabsStore.duplicateTab(id);
	}

	function handleExportTTL() {
		const tab = tabsStore.getActiveTab();
		if (!tab) return;

		const filename = `${tab.name.replace(/[^a-z0-9]/gi, "_")}.ttl`;
		downloadBlob(tab.ttlContent, filename, "text/turtle");

		logger.debug("Tab Exported (TTL)", { id: tab.id, name: tab.name });
	}

	function handleExportCarapace() {
		const tab = tabsStore.getActiveTab();
		if (!tab) return;

		const json = JSON.stringify(tabsStore.toJson(), null, 2);
		const filename = `carapace_${new Date().toISOString().slice(0, 10)}.carapace`;
		downloadBlob(json, filename, "application/json");

		logger.debug("Tab Exported (JSON)", { id: tab.id, name: tab.name });
	}

	function handleExportSvg() {
		tabsStore.exportSvg?.();
	}

	function readFileAsText(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => resolve(e.target?.result as string);
			reader.onerror = () => reject(reader.error);
			reader.readAsText(file);
		});
	}

	async function handleImportTtl(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		try {
			const content = await readFileAsText(file);
			const name = file.name.replace(/\.ttl$/i, "");
			tabsStore.addTab(name, content);
			logger.debug("Turtle File Imported", { name: file.name });
		} catch (error) {
			toast.error("Failed to import TTL file");
			logger.error("Import TTL Failed", error);
		}
		input.value = "";
	}

	async function handleImportCarapace(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		try {
			const content = await readFileAsText(file);
			tabsStore.loadJson(content);
			logger.info("Carapace Session Imported", { name: file.name });
		} catch (error) {
			toast.error("Failed to import Carapace session — invalid or corrupt file");
			logger.error("Import Carapace Failed", error);
		}
		input.value = "";
	}

	function handleDragStart(e: DragEvent, id: string) {
		dragTabId = id;
		e.dataTransfer?.setData("text/plain", id);
		e.dataTransfer!.effectAllowed = "move";
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		e.dataTransfer!.dropEffect = "move";
		dropIndex = index;
	}

	function handleDragLeave() {
		dropIndex = null;
	}

	function handleDrop(e: DragEvent, toIndex: number) {
		e.preventDefault();
		const fromId = e.dataTransfer?.getData("text/plain");
		if (fromId) {
			tabsStore.moveTab(fromId, toIndex);
		}
		dragTabId = null;
		dropIndex = null;
	}

	function handleDragEnd() {
		dragTabId = null;
		dropIndex = null;
	}

	let ttlFileInput: HTMLInputElement;
	let carapaceFileInput: HTMLInputElement;
</script>

<div class="border-b bg-base flex items-center px-2 py-1">
	<div class="mr-auto flex">
		<Tabs.Root value={tabsStore.activeTabId} onValueChange={handleTabChange} class="flex-1">
			<Tabs.List class="h-8 gap-1 bg-transparent p-0">
				{#each tabsStore.tabs as tab, i (tab.id)}
					<div class="relative flex">
						{#if dropIndex === i}
							<div class="absolute left-0 top-1 bottom-1 w-0.5 bg-primary z-10 rounded-full"></div>
						{/if}
						<Tabs.Trigger
							value={tab.id}
							draggable="true"
							ondragstart={(e) => handleDragStart(e, tab.id)}
							ondragover={(e) => handleDragOver(e, i)}
							ondragleave={handleDragLeave}
							ondrop={(e) => handleDrop(e, i)}
							ondragend={handleDragEnd}
							class="relative min-w-20 max-w-80 text-sm data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:bg-muted/30 data-[state=inactive]:hover:bg-muted/50 transition-colors {dragTabId ===
							tab.id
								? 'opacity-50'
								: ''}"
						>
							{#if renamingTabId === tab.id}
								<Input
									bind:value={renameInput}
									class="h-6 px-1 text-sm"
									onclick={(e) => e.stopPropagation()}
									onkeydown={handleRenameKeyDown}
									onblur={confirmRename}
									autofocus
								/>
							{:else}
								<div class="flex items-center overflow-hidden w-full" title={tab.name}>
									<FileCode class="h-3 w-3 mr-1 shrink-0" />
									<span class="truncate">{tab.name}</span>
								</div>
							{/if}

							<div class="ml-auto flex items-center gap-1">
								<DropdownMenu.Root>
									<DropdownMenu.Trigger onclick={(e) => e.stopPropagation()}>
										{#snippet child({ props })}
											<div
												{...props}
												class="h-4 w-4 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md"
											>
												<MoreVertical />
											</div>
										{/snippet}
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="end">
										<DropdownMenu.Item onclick={() => startRename(tab.id)}>
											<Edit2 />Rename
										</DropdownMenu.Item>
										<DropdownMenu.Item onclick={() => handleDuplicateTab(tab.id)}>
											<Copy />Duplicate
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Root>

								{#if tabsStore.tabs.length > 1}
									<Button
										variant="ghost"
										size="icon"
										class="h-4 w-4 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md"
										onclick={(e) => handleCloseTab(e, tab.id)}
									>
										<X />
									</Button>
								{/if}
							</div>
						</Tabs.Trigger>
					</div>
				{/each}
			</Tabs.List>
		</Tabs.Root>

		<Button variant="ghost" size="icon" class="h-8 w-8 ml-1" onclick={handleNewTab} title="New File">
			<Plus />
		</Button>
	</div>

	<div class="ml-2 flex items-center gap-1">
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="inline-flex items-center justify-center rounded-md h-7 w-7 transition-colors hover:bg-muted"
				title="Import"
			>
				<Upload class="h-4 w-4" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-40">
				<DropdownMenu.Item onclick={() => ttlFileInput?.click()}>
					<FileCode />Import TTL
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={() => carapaceFileInput?.click()}>
					<Turtle />Import Carapace
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>

		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				class="inline-flex items-center justify-center rounded-md h-7 w-7 transition-colors hover:bg-muted"
				title="Export"
			>
				<Download class="h-4 w-4" />
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-40">
				<DropdownMenu.Item onclick={handleExportSvg}>
					<FileImage />Export SVG
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={handleExportTTL}>
					<FileCode />Export TTL
				</DropdownMenu.Item>
				<DropdownMenu.Item onclick={handleExportCarapace}>
					<Turtle />Export Carapace
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</div>

<input bind:this={ttlFileInput} type="file" accept=".ttl,text/turtle" class="hidden" onchange={handleImportTtl} />
<input bind:this={carapaceFileInput} type="file" accept=".carapace" class="hidden" onchange={handleImportCarapace} />
