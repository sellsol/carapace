<script lang="ts">
	import { resolve } from "$app/paths";
</script>

<svelte:head>
	<meta http-equiv="refresh" content="0; url=/app" />
	<link rel="canonical" href="https://carapace.space/app" />
</svelte:head>

<div class="flex flex-1 flex-col items-center justify-center p-6">
	<div class="max-w-2xl text-center">
		<h2 class="text-3xl font-semibold text-foreground mb-3">Carapace</h2>
		<p class="text-muted-foreground mb-4">TTL ontology editor & graph visualiser.</p>
		<a
			href={resolve("/app")}
			class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
		>
			Open the editor
		</a>
	</div>
</div>
