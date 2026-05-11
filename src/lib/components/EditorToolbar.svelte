<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import Copy from "@lucide/svelte/icons/copy";
	import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
	import Settings from "@lucide/svelte/icons/settings";
	import X from "@lucide/svelte/icons/x";

	interface Props {
		onclear?: () => void;
		oncopy?: () => void;
		onreload?: () => void;
		settingsMode?: boolean;
		onToggleSettings?: () => void;
	}
	let { onclear, oncopy, onreload, settingsMode = false, onToggleSettings }: Props = $props();
</script>

<div class="h-8 flex items-center px-2 border-b">
	<Button
		size="sm"
		variant={settingsMode ? "secondary" : "ghost"}
		onclick={onToggleSettings}
		class="h-7"
		title="Graph settings"
	>
		<Settings />Settings
	</Button>
	<Button size="sm" variant="ghost" onclick={onclear} class="h-7 ml-auto" title="Clear">
		<X />Clear
	</Button>
	<Button size="sm" variant="ghost" onclick={oncopy} class="h-7" title="Copy">
		<Copy />Copy
	</Button>
	<Button size="sm" variant="ghost" onclick={onreload} class="h-7" title="Reload graph">
		<RotateCcw />Reload
	</Button>
</div>
