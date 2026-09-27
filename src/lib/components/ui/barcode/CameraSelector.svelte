<script lang="ts">
  import type { Camera } from '$lib/utils/camera.js';

  export let cameras: Camera[] = [];
  export let selectedCameraId: string = '';
  export let onCameraSelect: (cameraId: string) => void = () => {};
</script>

{#if cameras.length > 1}
  <div class="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
    <label class="block text-sm font-medium text-slate-700 mb-3">Select Camera</label>
    <div class="space-y-2">
      {#each cameras as camera, index}
        <label class="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-white cursor-pointer transition-colors">
          <input
            type="radio"
            name="camera"
            value={camera.deviceId}
            checked={selectedCameraId === camera.deviceId}
            on:change={() => onCameraSelect(camera.deviceId)}
            class="w-4 h-4"
          />
          <span class="text-sm text-slate-900">
            {camera.label || `Camera ${index + 1}`}
          </span>
        </label>
      {/each}
    </div>
  </div>
{/if}
