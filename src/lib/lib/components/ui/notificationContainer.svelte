<script lang="ts">
  import { notifications } from '$lib/stores/notificationStore.js';
  import Notification from './notification.svelte';
</script>

<div class="fixed top-4 right-4 z-50 space-y-3 max-h-screen overflow-y-auto">
  {#each $notifications as notification (notification.id)}
    <Notification
      message={notification.message}
      type={notification.type}
      duration={notification.duration || 5000}
      title={notification.title || ''}
      actionUrl={notification.actionUrl || ''}
      actionText={notification.actionText || ''}
      timestamp={notification.timestamp}
      on:close={() => notifications.remove(notification.id)}
      on:action={() => {
        // Handle action click if needed
        console.log('Action clicked for notification:', notification.id);
      }}
    />
  {/each}
</div>