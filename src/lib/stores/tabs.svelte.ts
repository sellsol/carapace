import type { Quad } from "n3";
import { toast } from "svelte-sonner";

import { SAMPLE_TURTLE } from "$lib/constants/sample";
import { createLogger } from "$lib/logger";
import type { GraphSettings, Tab } from "$lib/types/tabs";
import { defaultGraphSettings } from "$lib/utils/settings";
import { parseTurtle } from "$lib/utils/turtle";

const logger = createLogger("TabsStore");

class TabsStore {
	tabs = $state<Tab[]>([]);
	activeTabId = $state<string>("");
	activeTriples = $state<Quad[] | null>(null);
	activePrefixMap = $state<Record<string, string>>({});
	activeError = $state<string>("");

	graphReloadCount = $state(0);
	graphLoading = $state(false);

	exportSvg = $state<(() => void) | null>(null);

	private saveTimeout: ReturnType<typeof setTimeout> | null = null;
	private parseTimeout: ReturnType<typeof setTimeout> | null = null;

	getActiveTab(): Tab | undefined {
		return this.tabs.find((t) => t.id === this.activeTabId);
	}

	getTab(id: string): Tab | undefined {
		return this.tabs.find((t) => t.id === id);
	}

	addTab(name?: string, content?: string) {
		const ttlContent = content || SAMPLE_TURTLE;

		const newTab: Tab = {
			id: crypto.randomUUID(),
			name: name || `File ${this.tabs.length + 1}`,
			ttlContent,
			parsedTriples: undefined,
			parsedPrefixMap: {},
			settings: defaultGraphSettings(),
			locked: false
		};

		this.tabs.push(newTab);
		this.activeTabId = newTab.id;
		this.activeTriples = null;
		this.activePrefixMap = {};
		this.activeError = "";
		this.graphLoading = true;
		logger.debug("Tab Added", { id: newTab.id, name: newTab.name });

		this.scheduleSave();
		this.doParse();
	}

	switchTab(id: string) {
		const tab = this.tabs.find((t) => t.id === id);
		if (!tab) {
			logger.warn("Tab Switch - Not Found", { id: id });
			return;
		}

		this.activeTabId = id;
		this.activeTriples = tab.parsedTriples ?? null;
		this.activePrefixMap = tab.parsedPrefixMap ?? {};
		this.activeError = "";

		localStorage.setItem("carapace_activeTabId", id);
		logger.debug("Tab Switched", { id: tab.id, name: tab.name });

		this.scheduleSave();
	}

	closeTab(id: string) {
		const index = this.tabs.findIndex((t) => t.id === id);
		if (index === -1) {
			logger.warn("Tab Close - Not Found", { id: id });
			return;
		}

		if (this.tabs.length === 1) {
			toast.error("Cannot close last tab");
			logger.warn("Tab Close - Cannot Close Last Tab");
			return;
		}

		const tabName = this.tabs[index].name;
		this.tabs.splice(index, 1);
		logger.debug("Tab Closed", { id: id, name: tabName });

		if (this.activeTabId === id) {
			const newIndex = Math.min(index, this.tabs.length - 1);
			const newTab = this.tabs[newIndex];

			this.activeTabId = newTab.id;
			this.activeTriples = newTab.parsedTriples ?? null;
			this.activePrefixMap = newTab.parsedPrefixMap ?? {};
			this.activeError = "";
			logger.debug("Tab Switched", { id: newTab.id, name: newTab.name });
		}

		this.scheduleSave();
	}

	moveTab(id: string, toIndex: number) {
		const fromIndex = this.tabs.findIndex((t) => t.id === id);
		if (fromIndex === -1 || fromIndex === toIndex) return;

		const [tab] = this.tabs.splice(fromIndex, 1);
		this.tabs.splice(toIndex, 0, tab);
		logger.debug("Tab Move", { id: tab.id, name: tab.name, oldIndex: fromIndex, newIndex: toIndex });

		this.scheduleSave();
	}

	renameTab(id: string, newName: string) {
		const tab = this.tabs.find((t) => t.id === id);
		if (!tab) {
			logger.warn("Tab Rename - Not Found", { id: id });
			return;
		}

		const oldName = tab.name;
		tab.name = newName;
		logger.debug("Tab Renamed", { id: id, oldName: oldName, newName: newName });

		this.scheduleSave();
	}

	duplicateTab(id: string) {
		const tab = this.tabs.find((t) => t.id === id);
		if (!tab) {
			logger.warn("Tab Duplicate - Not Found", { id: id });
			return;
		}

		const newTab: Tab = {
			...tab,
			id: crypto.randomUUID(),
			name: `${tab.name} copy`,
			settings: { ...tab.settings },
			nodePositions: undefined
		};

		this.tabs.push(newTab);
		this.activeTabId = newTab.id;
		logger.debug("Tab Duplicated", { id: id, oldName: tab.name, newName: newTab.name });

		this.scheduleSave();
		return newTab.id;
	}

	updateActiveTabContent(content: string) {
		const tab = this.getActiveTab();
		if (!tab) return;

		tab.ttlContent = content;

		this.scheduleParse();
		this.scheduleSave();
	}

	private scheduleParse() {
		if (this.parseTimeout) {
			clearTimeout(this.parseTimeout);
		}

		this.parseTimeout = setTimeout(() => {
			this.doParse();
		}, 500);
	}

	private doParse() {
		const tab = this.getActiveTab();
		if (!tab) return;

		const result = parseTurtle(tab.ttlContent);

		this.activeError = result.parseError;
		if (result.parseError && tab.parsedTriples) return;

		tab.parsedTriples = result.triples;
		this.activeTriples = result.triples;
		tab.parsedPrefixMap = result.prefixMap;
		this.activePrefixMap = result.prefixMap;
	}

	updateActiveTabSettings(newSettings: Partial<GraphSettings>) {
		const tab = this.getActiveTab();
		if (!tab) return;

		tab.settings = { ...tab.settings, ...newSettings };
		this.scheduleSave();
	}

	setActiveTabLocked(locked: boolean) {
		const tab = this.getActiveTab();
		if (!tab) return;

		tab.locked = locked;
		this.scheduleSave();
	}

	loadFromStorage() {
		try {
			const stored = localStorage.getItem("carapace_tabs");
			if (!stored) return;

			const data = JSON.parse(stored);
			if (!data.tabs || !Array.isArray(data.tabs)) return;

			this.tabs = data.tabs.map((tab: Record<string, unknown>) => {
				if (tab.graphState && !tab.settings) {
					const gs = tab.graphState as Record<string, unknown>;
					const defaults = defaultGraphSettings();
					(tab as Record<string, unknown>).locked = (gs.locked as boolean) ?? false;
					(tab as Record<string, unknown>).nodePositions = gs.nodePositions as
						| Array<{ id: string; x: number; y: number }>
						| undefined;
					tab.settings = {
						duplicateExternalNodes:
							(gs.duplicateExternalNodes as boolean) ?? defaults.duplicateExternalNodes,
						hiddenNamespaces: [...defaults.hiddenNamespaces],
						hiddenEntityTypes: [...defaults.hiddenEntityTypes],
						hiddenPredicateUris: [...defaults.hiddenPredicateUris],
						hiddenInstanceOfUris: [...defaults.hiddenInstanceOfUris]
					};
					delete (tab as Record<string, unknown>).graphState;
				}
				return tab as Tab;
			});

			const separateActive = typeof window !== "undefined" ? localStorage.getItem("carapace_activeTabId") : null;
			if (separateActive && this.tabs.find((t) => t.id === separateActive)) {
				this.activeTabId = separateActive;
			} else if (data.activeTabId && this.tabs.find((t) => t.id === data.activeTabId)) {
				this.activeTabId = data.activeTabId;
			} else if (this.tabs.length > 0) {
				this.activeTabId = this.tabs[0].id;
			}

			const activeTab = this.getActiveTab();
			if (activeTab) {
				this.activeTriples = activeTab.parsedTriples ?? null;
				this.activePrefixMap = activeTab.parsedPrefixMap ?? {};
			}
			logger.info(`Tabs Loaded from Storage - ${this.tabs.length} Tabs`);
		} catch (error) {
			logger.error("Tabs Load from Storage:", error);
		}
	}

	saveToStorage() {
		const data = { tabs: this.tabs, activeTabId: this.activeTabId };
		localStorage.setItem("carapace_tabs", JSON.stringify(data));
		localStorage.setItem("carapace_activeTabId", this.activeTabId);

		logger.debug("Tabs Saved to Storage");
	}

	scheduleSave() {
		if (typeof window === "undefined") return;

		if (this.saveTimeout) clearTimeout(this.saveTimeout);
		this.saveTimeout = setTimeout(() => {
			this.saveToStorage();
		}, 500);
	}

	flushSave() {
		if (typeof window === "undefined") return;

		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
			this.saveTimeout = null;
		}
		this.saveToStorage();
	}

	toJson(): { tabs: Tab[] } {
		const tab = this.getActiveTab();
		if (!tab) return { tabs: [] };

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { parsedTriples, ...rest } = tab;
		return { tabs: [rest as Tab] };
	}

	loadJson(json: string) {
		const data = JSON.parse(json);
		if (!data.tabs || !Array.isArray(data.tabs)) throw new Error("Invalid JSON: expected { tabs: [...] }");

		const importedTabs: Tab[] = data.tabs.map((tab: Record<string, unknown>) => ({
			...(tab as Tab),
			id: crypto.randomUUID(),
			locked: true
		}));

		this.tabs = [...this.tabs, ...importedTabs];
		this.activeTabId = importedTabs[0].id;

		this.doParse();
		this.scheduleSave();
	}
}

export const tabsStore = new TabsStore();
