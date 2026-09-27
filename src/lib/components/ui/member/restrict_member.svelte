<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let member: {
    id: number;
    name: string;
    username: string;
    type: string;
  } | null = null;
  export let isLoading = false;

  const dispatch = createEventDispatcher();

  let formData = {
    restrictionType: 'ban_borrowing',
    reason: '',
    startDate: '',
    endDate: '',
    isPermanent: true
  };

  let restrictions: any[] = [];
  let loadingRestrictions = false;

  $: if (isOpen && member) {
    loadRestrictions();
  }

  async function loadRestrictions() {
    if (!member) return;

    loadingRestrictions = true;
    try {
      const res = await fetch(`/api/user/${member.id}/restriction`);
      const data = await res.json();
      if (res.ok && data.success) {
        restrictions = data.restrictions || [];
      }
    } catch (err) {
      console.error('Failed to load restrictions:', err);
    } finally {
      loadingRestrictions = false;
    }
  }

  function resetForm() {
    formData = {
      restrictionType: 'ban_borrowing',
      reason: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      isPermanent: true
    };
  }

  function handleClose() {
    resetForm();
    dispatch('close');
  }

  async function handleSubmit() {
    if (!member) return;

    try {
      const payload = {
        restrictionType: formData.restrictionType,
        reason: formData.reason || null,
        startDate: formData.startDate,
        endDate: formData.isPermanent ? null : formData.endDate
      };

      const res = await fetch(`/api/user/${member.id}/restriction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        dispatch('restrictionAdded', data.data);
        resetForm();
        await loadRestrictions();
      } else {
        alert(data.message || 'Failed to add restriction');
      }
    } catch (err) {
      console.error('Failed to add restriction:', err);
      alert('Network error. Please try again.');
    }
  }

  async function removeRestriction(restrictionId: number) {
    if (!member || !confirm('Are you sure you want to remove this restriction?')) return;

    try {
      const res = await fetch(`/api/user/${member.id}/restriction`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restrictionId })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await loadRestrictions();
      } else {
        alert(data.message || 'Failed to remove restriction');
      }
    } catch (err) {
      console.error('Failed to remove restriction:', err);
      alert('Network error. Please try again.');
    }
  }

  function getRestrictionTypeLabel(type: string) {
    switch (type) {
      case 'ban_borrowing': return 'Ban Borrowing';
      case 'ban_reservation': return 'Ban Reservation';
      case 'temporary_suspension': return 'Temporary Suspension';
      default: return type;
    }
  }

  function getRestrictionTypeColor(type: string) {
    switch (type) {
      case 'ban_borrowing': return 'bg-red-100 text-red-800';
      case 'ban_reservation': return 'bg-orange-100 text-orange-800';
      case 'temporary_suspension': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-y-auto max-h-[90vh]">
      <div class="flex justify-between items-center px-6 py-4 border-b">
        <h3 class="text-xl font-bold text-gray-900">
          Manage Restrictions - {member?.name} ({member?.username})
        </h3>
        <button on:click={handleClose} class="text-gray-400 hover:text-gray-700" aria-label="Close">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="px-6 py-6">
        <!-- Add New Restriction Form -->
        <div class="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 class="text-lg font-semibold mb-4">Add New Restriction</h4>
          <form class="space-y-4" on:submit|preventDefault={handleSubmit}>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="restrictionType" class="block text-sm font-medium mb-1">Restriction Type</label>
                <select id="restrictionType" bind:value={formData.restrictionType} class="w-full px-3 py-2 border rounded-md" required>
                  <option value="ban_borrowing">Ban Borrowing</option>
                  <option value="ban_reservation">Ban Reservation</option>
                  <option value="temporary_suspension">Temporary Suspension</option>
                </select>
              </div>
              <div>
                <label for="startDate" class="block text-sm font-medium mb-1">Start Date</label>
                <input
                  id="startDate"
                  type="date"
                  bind:value={formData.startDate}
                  class="w-full px-3 py-2 border rounded-md"
                  required
                >
              </div>
            </div>

            <div>
              <label for="reason" class="block text-sm font-medium mb-1">Reason</label>
              <textarea
                id="reason"
                bind:value={formData.reason}
                class="w-full px-3 py-2 border rounded-md"
                rows="3"
                placeholder="Optional reason for the restriction"
              ></textarea>
            </div>

            <div class="flex items-center space-x-4">
              <label class="flex items-center">
                <input type="checkbox" bind:checked={formData.isPermanent} class="mr-2">
                <span class="text-sm">Permanent restriction</span>
              </label>
              {#if !formData.isPermanent}
                <div class="flex-1">
                  <label for="endDate" class="block text-sm font-medium mb-1">End Date</label>
                  <input
                    id="endDate"
                    type="date"
                    bind:value={formData.endDate}
                    class="w-full px-3 py-2 border rounded-md"
                    required={!formData.isPermanent}
                  >
                </div>
              {/if}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {#if isLoading}
                <div class="flex items-center">
                  <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Adding...
                </div>
              {:else}
                Add Restriction
              {/if}
            </button>
          </form>
        </div>

        <!-- Current Restrictions -->
        <div>
          <h4 class="text-lg font-semibold mb-4">Current Restrictions</h4>

          {#if loadingRestrictions}
            <div class="flex items-center justify-center py-8">
              <div class="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-600"></div>
              <span class="ml-3 text-gray-600">Loading restrictions...</span>
            </div>
          {:else if restrictions.length === 0}
            <div class="text-center py-8 text-gray-500">
              No active restrictions for this member.
            </div>
          {:else}
            <div class="space-y-3">
              {#each restrictions as restriction}
                <div class="bg-white border rounded-lg p-4 shadow-sm">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center space-x-2 mb-2">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getRestrictionTypeColor(restriction.restrictionType)}">
                          {getRestrictionTypeLabel(restriction.restrictionType)}
                        </span>
                        {#if restriction.endDate}
                          <span class="text-xs text-gray-500">
                            Until {new Date(restriction.endDate).toLocaleDateString()}
                          </span>
                        {:else}
                          <span class="text-xs text-red-600 font-medium">Permanent</span>
                        {/if}
                      </div>
                      {#if restriction.reason}
                        <p class="text-sm text-gray-600 mb-2">{restriction.reason}</p>
                      {/if}
                      <div class="text-xs text-gray-400">
                        Applied on {new Date(restriction.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      on:click={() => removeRestriction(restriction.id)}
                      class="text-red-600 hover:text-red-800 p-1"
                      title="Remove restriction"
                      aria-label="Remove restriction"
                    >
                      <span class="sr-only">Remove</span>
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="flex justify-end px-6 py-4 border-t bg-gray-50">
        <button
          on:click={handleClose}
          class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}