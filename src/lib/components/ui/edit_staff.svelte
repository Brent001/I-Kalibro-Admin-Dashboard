<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let staff: any = null;
  export let permissionsList: { key: string; label: string }[] = [];

  const dispatch = createEventDispatcher();

  let password = '';
  let confirmPassword = '';
  let username = '';
  let loadingPermissions = false;

  // When modal opens or staff changes, fetch permissions
  $: if (isOpen && staff && staff.uniqueId) {
    username = staff.username ?? '';
    password = '';
    confirmPassword = '';
  }

  $: if (!isOpen) {
    password = '';
    confirmPassword = '';
    username = '';
  }

  function handleSubmit() {
    if (password && password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    dispatch('editStaff', {
      uniqueId: staff.uniqueId,
      id: staff.id,
      username,
      password: password || undefined,
    });
  }

  function closeModal() {
    dispatch('close');
  }
</script>

{#if isOpen && staff}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="bg-white rounded-xl shadow-xl p-8 max-w-md w-full">
      <h3 class="text-lg font-bold mb-4">Edit Staff: {staff.name}</h3>
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            bind:value={username}
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
            autocomplete="username"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Change Password</label>
          <input
            type="password"
            placeholder="New password"
            bind:value={password}
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
            autocomplete="new-password"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            bind:value={confirmPassword}
            class="w-full px-3 py-2 border border-gray-300 rounded-md mt-2"
            autocomplete="new-password"
          />
        </div>

        <!-- Staff permissions temporarily disabled -->
        {#if false}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Permissions</label>
            {#if loadingPermissions}
              <div class="text-gray-500 text-sm">Loading permissions...</div>
            {:else}
              <div class="grid grid-cols-2 gap-2">
                {#each permissionsList as perm}
                  <label class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      bind:checked={selectedPermissions[perm.key]}
                    />
                    <span>{perm.label}</span>
                  </label>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <div class="flex justify-end gap-2 mt-6">
          <button type="button" class="px-4 py-2 rounded bg-gray-200" on:click={closeModal}>Cancel</button>
          <button type="submit" class="px-4 py-2 rounded bg-blue-600 text-white">Save Changes</button>
        </div>
      </form>
    </div>
  </div>
{/if}