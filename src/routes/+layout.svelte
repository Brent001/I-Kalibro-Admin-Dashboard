<script lang="ts">
	import '../app.css';
	import ToastContainer from '$lib/components/ui/toastContainer.svelte';
	
	let { children } = $props();
</script>

{@render children()}
<ToastContainer />
