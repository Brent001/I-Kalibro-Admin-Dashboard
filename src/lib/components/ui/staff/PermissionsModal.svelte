<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let staff: any = null;
  export let permissionsList: { key: string; label: string; icon: string }[] = [];

  const dispatch = createEventDispatcher();

  let selectedPermissions: Record<string, boolean> = {};
  let isSaving = false;
  let successMessage = '';

  const permissionDescriptions: Record<string, string> = {
    'view_books': 'View and manage library books, inventory, categories, and book details',
    'view_members': 'View and manage library members, user accounts, and member information',
    'view_transactions': 'View and manage book borrowing and return transactions, track records',
    'view_visits': 'View library visit logs, visitor information, and check-in/out history',
    'view_logs': 'View system security logs, audit trails, and staff activity history',
    'view_reports': 'Generate and view library reports, analytics, and statistics',
    'view_staff': 'Manage staff accounts, roles, and staff member information',
    'view_settings': 'Configure system settings, preferences, and system-wide configurations'
  };

  $: if (isOpen && staff && staff.uniqueId) {
    // Initialize permissions from staff data
    selectedPermissions = {};
    if (staff.permissions && Array.isArray(staff.permissions)) {
      staff.permissions.forEach((perm: string) => {
        selectedPermissions[perm] = true;
      });
    }
    successMessage = '';
  }

  function togglePermission(permissionKey: string) {
    selectedPermissions[permissionKey] = !selectedPermissions[permissionKey];
    successMessage = '';
  }

  function selectAllPermissions() {
    permissionsList.forEach(perm => {
      selectedPermissions[perm.key] = true;
    });
    selectedPermissions = selectedPermissions;
  }

  function deselectAllPermissions() {
    permissionsList.forEach(perm => {
      selectedPermissions[perm.key] = false;
    });
    selectedPermissions = selectedPermissions;
  }

  function getSelectedCount() {
    return Object.values(selectedPermissions).filter(Boolean).length;
  }

  async function savePermissions() {
    if (!staff || !staff.uniqueId) return;

    isSaving = true;
    successMessage = '';

    try {
      const permissionArray = Object.entries(selectedPermissions)
        .filter(([_, checked]) => checked)
        .map(([key]) => key);

      const response = await fetch(`/api/staff/${staff.uniqueId}/edit_permission`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionKeys: permissionArray })
      });

      const data = await response.json();

      if (data.success) {
        successMessage = `✓ Permissions updated successfully for ${staff.name}`;
        setTimeout(() => {
          closeModal();
        }, 1500);
      } else {
        throw new Error(data.message || 'Failed to save permissions');
      }
    } catch (err) {
      console.error('Error saving permissions:', err);
      successMessage = `✗ Failed to update permissions: ${err instanceof Error ? err.message : 'Unknown error'}`;
    } finally {
      isSaving = false;
    }
  }

  function closeModal() {
    dispatch('close');
    selectedPermissions = {};
    successMessage = '';
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  }
</script>

{#if isOpen && staff}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" tabindex="-1" on:click={handleBackdropClick} on:keydown={(e) => e.key === 'Escape' && closeModal()}>
    <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[#E8B923]/20 bg-gradient-to-r from-[#0D5C29] to-[#1a7a39] flex-shrink-0">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold text-white">Manage Permissions</h3>
            <p class="text-sm text-[#E8B923]/80 mt-1">
              {#if staff.role === 'admin'}
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">
                  Admin - Full Access
                </span>
              {:else}
                <span class="text-gray-600">{staff.name} ({staff.username})</span>
              {/if}
            </p>
          </div>
          <button
            type="button"
            on:click={closeModal}
            class="p-2 rounded-lg hover:bg-[#E8B923]/10 transition-colors text-[#E8B923]/60 hover:text-[#E8B923]"
            aria-label="Close"
            disabled={isSaving}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto px-6 py-4">
        {#if staff.role === 'admin'}
          <!-- Admin info -->
          <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div class="flex gap-3">
              <svg class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 class="text-sm font-semibold text-green-900">Administrator Account</h4>
                <p class="text-xs text-green-800 mt-1">
                  This staff member has full system access and permissions cannot be restricted.
                </p>
              </div>
            </div>
          </div>
        {:else}
          <!-- Quick Actions -->
          <div class="flex gap-2 mb-4 pb-4 border-b border-[#E8B923]/30">
            <button
              type="button"
              on:click={selectAllPermissions}
              class="text-xs px-3 py-1.5 rounded-lg bg-[#0D5C29] text-white hover:bg-[#0D5C29]/90 transition-colors disabled:opacity-50 font-medium"
              disabled={isSaving}
            >
              Select All
            </button>
            <button
              type="button"
              on:click={deselectAllPermissions}
              class="text-xs px-3 py-1.5 rounded-lg bg-[#E8B923]/20 text-[#0D5C29] hover:bg-[#E8B923]/30 transition-colors disabled:opacity-50 font-medium"
              disabled={isSaving}
            >
              Clear All
            </button>
            <div class="ml-auto flex items-center gap-2 text-xs text-[#0D5C29] bg-[#E8B923]/10 px-3 py-1.5 rounded-lg font-medium border border-[#E8B923]/30">
              <span>{getSelectedCount()}/{permissionsList.length}</span>
              <span>permissions selected</span>
            </div>
          </div>

          <!-- Permissions Grid -->
          <div class="space-y-3">
            {#each permissionsList as permission}
              <label class="flex items-start p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-200 group">
                <input
                  type="checkbox"
                  checked={selectedPermissions[permission.key] || false}
                  on:change={() => togglePermission(permission.key)}
                  class="w-5 h-5 rounded border-gray-300 text-[#0D5C29] focus:ring-2 focus:ring-[#0D5C29] cursor-pointer mt-0.5 flex-shrink-0"
                  disabled={isSaving}
                />
                <div class="ml-4 flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <h4 class="text-sm font-semibold text-gray-900 group-hover:text-[#0D5C29] transition-colors">
                      {permission.label}
                    </h4>
                    <span class="inline-block px-2 py-0.5 text-xs font-mono bg-gray-100 text-gray-600 rounded">
                      {permission.key}
                    </span>
                  </div>
                  <p class="text-xs text-gray-600 leading-relaxed">
                    {permissionDescriptions[permission.key] || 'No description available'}
                  </p>
                </div>
                <div class="ml-3 flex-shrink-0">
                  {#if selectedPermissions[permission.key]}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  {:else}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      Inactive
                    </span>
                  {/if}
                </div>
              </label>
            {/each}
          </div>

          <!-- Info Alert -->
          <div class="mt-6 p-4 bg-[#E8B923]/10 border border-[#E8B923]/30 rounded-lg">
            <div class="flex gap-3">
              <svg class="w-5 h-5 text-[#0D5C29] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 class="text-sm font-semibold text-[#0D5C29]">Permission Guidelines</h4>
                <ul class="text-xs text-[#0D5C29] mt-2 space-y-1 list-disc list-inside">
                  <li>Checked permissions grant access to that dashboard section</li>
                  <li>Unchecked permissions will restrict access</li>
                  <li>Changes are applied immediately after saving</li>
                </ul>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Success Message -->
      {#if successMessage}
        <div class="px-6 py-3 bg-gradient-to-r from-green-50 to-emerald-50 border-t border-green-200">
          <p class="text-sm font-medium {successMessage.startsWith('✓') ? 'text-green-800' : 'text-red-800'}">
            {successMessage}
          </p>
        </div>
      {/if}

      <!-- Footer -->
      {#if staff.role !== 'admin'}
        <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0 flex justify-end gap-3">
          <button
            type="button"
            on:click={closeModal}
            class="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            on:click={savePermissions}
            class="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            disabled={isSaving}
          >
            {#if isSaving}
              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            {:else}
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Save Permissions
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
