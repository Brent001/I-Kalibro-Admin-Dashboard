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
  let selectedPermissions: Record<string, boolean> = {};

  // When modal opens or staff changes, fetch permissions
  $: if (isOpen && staff && staff.uniqueId) {
    username = staff.username ?? '';
    password = '';
    confirmPassword = '';
    
    // Initialize permissions if available
    selectedPermissions = {};
    if (staff.permissions) {
      staff.permissions.forEach((perm: string) => {
        selectedPermissions[perm] = true;
      });
    }
  }

  $: if (!isOpen) {
    password = '';
    confirmPassword = '';
    username = '';
    selectedPermissions = {};
  }

  function togglePermission(permissionKey: string) {
    selectedPermissions[permissionKey] = !selectedPermissions[permissionKey];
  }

  function handleSubmit() {
    if (password && password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    const permissionArray = staff.role === 'staff' 
      ? Object.entries(selectedPermissions)
          .filter(([_, checked]) => checked)
          .map(([key]) => key)
      : [];

    dispatch('editStaff', {
      uniqueId: staff.uniqueId,
      id: staff.id,
      username,
      password: password || undefined,
      permissionKeys: permissionArray
    });
  }

  function closeModal() {
    dispatch('close');
  }
</script>

{#if isOpen && staff}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[#E8B923]/20 bg-gradient-to-r from-[#0D5C29] to-[#1a7a39] flex-shrink-0">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold text-white">Edit Staff: {staff.name}</h3>
            <p class="text-sm text-[#E8B923]/80 mt-1">Update account details and permissions</p>
          </div>
          <button
            type="button"
            on:click={closeModal}
            class="p-2 rounded-lg hover:bg-[#E8B923]/10 transition-colors text-[#E8B923]/60 hover:text-[#E8B923]"
            aria-label="Close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Content -->
      <form on:submit|preventDefault={handleSubmit} class="flex flex-col flex-1 min-h-0">
        <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <!-- Account Information Section -->
          <div>
            <h4 class="text-sm font-semibold text-[#0D5C29] mb-4 uppercase tracking-wide text-[#0D5C29] border-b border-[#E8B923]/30 pb-2">Account Information</h4>
            <div class="space-y-4">
              <div>
                <label for="username-edit" class="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  id="username-edit"
                  type="text"
                  bind:value={username}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autocomplete="username"
                  placeholder="Enter username"
                />
              </div>
              <div class="text-xs text-[#0D5C29] bg-[#E8B923]/10 p-2.5 rounded-lg border border-[#E8B923]/30">
                📋 Username: <span class="font-mono font-medium">{staff.username}</span>
              </div>
            </div>
          </div>

          <!-- Security Section -->
          <div>
            <h4 class="text-sm font-semibold text-[#0D5C29] mb-4 uppercase tracking-wide text-[#0D5C29] border-b border-[#E8B923]/30 pb-2">Security</h4>
            <div class="space-y-3">
              <div>
                <label for="password-edit" class="block text-sm font-medium text-gray-700 mb-1">New Password (Optional)</label>
                <input
                  id="password-edit"
                  type="password"
                  placeholder="Leave blank to keep current password"
                  bind:value={password}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autocomplete="new-password"
                />
              </div>
              <div>
                <label for="confirmPassword-edit" class="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  id="confirmPassword-edit"
                  type="password"
                  placeholder="Confirm new password"
                  bind:value={confirmPassword}
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autocomplete="new-password"
                />
              </div>
              {#if password && password !== confirmPassword}
                <div class="text-xs text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  ⚠️ Passwords do not match
                </div>
              {/if}
            </div>
          </div>

          <!-- Permissions Section for Staff Role Only -->
          {#if staff.role === 'staff' && permissionsList.length > 0}
            <div>
              <div class="flex items-center justify-between mb-4">
                <h4 class="text-sm font-semibold text-[#0D5C29] uppercase tracking-wide text-[#0D5C29] border-b border-[#E8B923]/30 pb-2 flex-1">Dashboard Permissions</h4>
                <span class="text-xs bg-[#E8B923]/20 text-[#0D5C29] px-2.5 py-0.5 rounded-full font-semibold ml-4">
                  {Object.values(selectedPermissions).filter(Boolean).length} / {permissionsList.length}
                </span>
              </div>
              <div class="bg-gradient-to-br from-[#0D5C29]/5 to-[#4A7C59]/5 rounded-lg p-4 border border-[#E8B923]/30 space-y-3">
                <!-- Quick Actions -->
                <div class="flex gap-2 pb-3 border-b border-[#E8B923]/30">
                  <button
                    type="button"
                    on:click={() => {
                      permissionsList.forEach(p => selectedPermissions[p.key] = true);
                      selectedPermissions = selectedPermissions;
                    }}
                    class="text-xs px-3 py-1.5 rounded-lg bg-[#0D5C29] text-white hover:bg-[#0D5C29]/90 transition-colors font-medium"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    on:click={() => {
                      permissionsList.forEach(p => selectedPermissions[p.key] = false);
                      selectedPermissions = selectedPermissions;
                    }}
                    class="text-xs px-3 py-1.5 rounded-lg bg-[#E8B923]/20 text-[#0D5C29] hover:bg-[#E8B923]/30 transition-colors font-medium"
                  >
                    Clear All
                  </button>
                </div>

                <!-- Permissions Grid -->
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {#each permissionsList as perm}
                    <label class="flex items-start space-x-2 cursor-pointer group p-2 rounded hover:bg-white transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedPermissions[perm.key] || false}
                        on:change={() => togglePermission(perm.key)}
                        class="h-4 w-4 text-[#0D5C29] border-gray-300 rounded focus:ring-2 focus:ring-[#0D5C29] mt-0.5 flex-shrink-0"
                        title={perm.label}
                      />
                      <span class="text-xs text-gray-700 group-hover:text-gray-900 font-medium leading-tight flex-1">
                        {perm.label}
                      </span>
                      {#if selectedPermissions[perm.key]}
                        <span class="text-green-600 text-xs">✓</span>
                      {/if}
                    </label>
                  {/each}
                </div>

                <!-- Info -->
                <div class="text-xs text-[#0D5C29] bg-[#E8B923]/10 p-2.5 rounded-lg border border-[#E8B923]/30">
                  💡 Update permissions to control which dashboard sections are visible to this staff member.
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-[#E8B923]/20 bg-gradient-to-r from-[#0D5C29]/5 to-[#4A7C59]/5 flex-shrink-0 flex justify-end gap-3">
          <button
            type="button"
            class="px-4 py-2 rounded-lg bg-white border border-[#0D5C29] text-[#0D5C29] hover:bg-[#0D5C29]/5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D5C29]"
            on:click={closeModal}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 rounded-lg bg-[#0D5C29] text-white hover:bg-[#0D5C29]/90 font-medium transition-colors inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D5C29]"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Save Changes
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}