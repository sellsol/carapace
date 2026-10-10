<script lang="ts">
	import { resolve } from "$app/paths";
	import { onMount } from "svelte";

	onMount(() => {
		window.location.replace("/");
	});
</script>

<svelte:head>
	<meta http-equiv="refresh" content="0; url=/" />
</svelte:head>

<div class="flex flex-1 flex-col items-center justify-center p-6">
	<p class="text-muted-foreground mb-4">Carapace now lives at the root of this site.</p>
	<a href={resolve("/")} class="text-accent-foreground font-medium underline">Open Carapace</a>
</div>
