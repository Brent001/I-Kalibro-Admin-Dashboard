<script lang="ts">
	import '../../app.css';
	import Layout from "$lib/components/ui/layout.svelte";
	
	let { children } = $props();
</script>

<Layout>
	{@render children()}
</Layout>
