<script lang="ts">
  import { toast } from '$lib/stores/toastStore.js';
  import { createEventDispatcher, onMount } from 'svelte';

  export let isOpen = false;
  export let member: {
    id?: number;
    type?: string;
    name?: string;
    email?: string;
    phone?: string;
    age?: string | number;
    enrollmentNo?: string;
    course?: string;
    year?: string;
    department?: string;
    designation?: string;
    facultyNumber?: string;
    gender?: string;
    username?: string;
    isActive?: boolean;
  } | null = null;
  export let canManageRestrictions = false;

  const dispatch = createEventDispatcher();
  let restrictions: Array<{
    id: number;
    restrictionType: string;
    reason: string | null;
    startDate: string;
    endDate: string | null;
  }> = [];
  let restrictionTypes: string[] = [];
  let restrictionReason = '';
  let restrictionEndDate = '';
  let restrictionsLoading = false;
  let restrictionSaving = false;
  let restrictionError = '';

  onMount(loadRestrictions);

  async function loadRestrictions() {
    if (!member?.id || !canManageRestrictions) return;
    restrictionsLoading = true;
    restrictionError = '';
    try {
      const response = await fetch(`/api/user/${member.id}/restriction`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not load restrictions.');
      restrictions = result.restrictions || [];
    } catch (error) {
      restrictionError = error instanceof Error ? error.message : 'Could not load restrictions.';
    } finally {
      restrictionsLoading = false;
    }
  }

  async function addRestriction(event: SubmitEvent) {
    event.preventDefault();
    if (!member?.id || restrictionSaving) return;
    const activeRestrictionTypes = new Set(restrictions.map(restriction => restriction.restrictionType));
    const typesToAdd = restrictionTypes.filter(type => !activeRestrictionTypes.has(type));
    if (typesToAdd.length === 0) {
      restrictionError = restrictionTypes.length
        ? 'The selected restrictions are already active.'
        : 'Select at least one restriction.';
      return;
    }

    restrictionSaving = true;
    restrictionError = '';
    try {
      const addedRestrictions = [];
      for (const restrictionType of typesToAdd) {
        const response = await fetch(`/api/user/${member.id}/restriction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restrictionType,
            reason: restrictionReason,
            endDate: restrictionEndDate || null
          })
        });
        const result = await response.json();
        if (!response.ok || result.success === false) throw new Error(result.message || 'Could not add restriction.');
        addedRestrictions.push(result.restriction);
      }
      restrictions = [...addedRestrictions, ...restrictions];
      toast.success('Restriction added.');
      restrictionTypes = [];
      restrictionReason = '';
      restrictionEndDate = '';
    } catch (error) {
      restrictionError = error instanceof Error ? error.message : 'Could not add restriction.';
      toast.error(restrictionError);
    } finally {
      restrictionSaving = false;
    }
  }

  async function removeRestriction(restrictionId: number) {
    if (!member?.id || restrictionSaving) return;
    restrictionSaving = true;
    restrictionError = '';
    try {
      const response = await fetch(`/api/user/${member.id}/restriction`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restrictionId })
      });
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.message || 'Could not remove restriction.');
      restrictions = restrictions.filter(restriction => restriction.id !== restrictionId);
      toast.success('Restriction removed.');
    } catch (error) {
      restrictionError = error instanceof Error ? error.message : 'Could not remove restriction.';
      toast.error(restrictionError);
    } finally {
      restrictionSaving = false;
    }
  }

  function restrictionLabel(type: string) {
    switch (type) {
      case 'ban_borrowing': return 'Borrowing blocked';
      case 'ban_reservation': return 'Reservations blocked';
      case 'temporary_suspension': return 'Temporary suspension';
      default: return type;
    }
  }

  function handleClose() {
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

{#if isOpen && member}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button
      class="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-default"
      onclick={handleClose}
      aria-label="Close modal"
      type="button"
    ></button>

    <div class="relative w-full max-w-2xl transform transition-all duration-300 scale-100">
      <div class="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-[#4A7C59]/30 overflow-hidden flex flex-col max-h-[90vh]">

        <!-- ── Header ── -->
        <div class="px-6 py-4 border-b border-[#4A7C59]/20 bg-white/80 flex-shrink-0">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-[#0D5C29] to-[#4A7C59] shadow-lg flex-shrink-0">
                <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </div>
              <div class="min-w-0">
                <h3 class="text-lg sm:text-xl font-bold text-[#0D5C29] truncate">Member Details</h3>
                <p class="text-xs sm:text-sm text-[#4A7C59] hidden sm:block">{member.name}</p>
              </div>
            </div>
            <button
              type="button" onclick={handleClose}
              aria-label="Close modal"
              class="p-2 rounded-lg text-gray-400 hover:text-[#0D5C29] hover:bg-[#0D5C29]/10 transition-colors duration-200 flex-shrink-0"
            >
              <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- ── Body ── -->
        <div class="px-6 py-6 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
          <div class="space-y-5">

            <!-- ══ SECTION 1: Personal Details ══ -->
            <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
              <div class="flex items-center justify-between gap-2 mb-4">
                <div class="flex items-center gap-2">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Personal Details</h4>
                </div>
                <span class="text-xs bg-[#E8B923]/20 text-[#0D5C29] px-2.5 py-0.5 rounded-full font-semibold flex-shrink-0">{member.type}</span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="bg-white border border-gray-200 rounded-lg px-3 py-2 sm:col-span-2">
                  <span class="block text-xs font-medium text-gray-500">Full Name</span>
                  <span class="block text-sm font-semibold text-gray-900">{member.name}</span>
                </div>
                <div class="bg-white border border-gray-200 rounded-lg px-3 py-2">
                  <span class="block text-xs font-medium text-gray-500">Email</span>
                  <span class="block text-sm font-semibold text-gray-900 truncate">{member.email}</span>
                </div>
                <div class="bg-white border border-gray-200 rounded-lg px-3 py-2">
                  <span class="block text-xs font-medium text-gray-500">Phone</span>
                  <span class="block text-sm font-semibold text-gray-900">{member.phone}</span>
                </div>
                <div class="bg-white border border-gray-200 rounded-lg px-3 py-2">
                  <span class="block text-xs font-medium text-gray-500">Age</span>
                  <span class="block text-sm font-semibold text-gray-900">{member.age || 'Not provided'}</span>
                </div>
                <div class="bg-white border border-gray-200 rounded-lg px-3 py-2">
                  <span class="block text-xs font-medium text-gray-500">Gender</span>
                  <span class="block text-sm font-semibold text-gray-900">{member.gender || 'Not provided'}</span>
                </div>
                <div class="bg-white border border-gray-200 rounded-lg px-3 py-2">
                  <span class="block text-xs font-medium text-gray-500">Username</span>
                  <span class="block text-sm font-semibold text-gray-900 font-mono">@{member.username}</span>
                </div>
              </div>
            </div>

            <!-- ══ SECTION 2: Academic Affiliation ══ -->
            {#if member.type === 'Student' || member.type === 'Faculty'}
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-4">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0112 20.055 12.083 12.083 0 015.84 10.578L12 14z"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Academic Affiliation</h4>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {#if member.type === 'Student'}
                    <div class="bg-white border border-gray-200 rounded-lg px-3 py-2">
                      <span class="block text-xs font-medium text-gray-500">Enrollment No</span>
                      <span class="block text-sm font-semibold text-gray-900">{member.enrollmentNo}</span>
                    </div>
                    <div class="bg-white border border-gray-200 rounded-lg px-3 py-2">
                      <span class="block text-xs font-medium text-gray-500">Course</span>
                      <span class="block text-sm font-semibold text-gray-900">{member.course}</span>
                    </div>
                    <div class="bg-white border border-gray-200 rounded-lg px-3 py-2">
                      <span class="block text-xs font-medium text-gray-500">Year</span>
                      <span class="block text-sm font-semibold text-gray-900">{member.year}</span>
                    </div>
                  {:else}
                    <div class="bg-white border border-gray-200 rounded-lg px-3 py-2">
                      <span class="block text-xs font-medium text-gray-500">Department</span>
                      <span class="block text-sm font-semibold text-gray-900">{member.department || 'Not provided'}</span>
                    </div>
                    <div class="bg-white border border-gray-200 rounded-lg px-3 py-2">
                      <span class="block text-xs font-medium text-gray-500">Faculty Number</span>
                      <span class="block text-sm font-semibold text-gray-900">{member.facultyNumber || 'Not provided'}</span>
                    </div>
                    <div class="bg-white border border-gray-200 rounded-lg px-3 py-2">
                      <span class="block text-xs font-medium text-gray-500">Designation</span>
                      <span class="block text-sm font-semibold text-gray-900">{member.designation || 'Not provided'}</span>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}

            {#if canManageRestrictions}
              <section class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="member-restrictions-heading">
                <div class="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start gap-3">
                      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3l8 4v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4z" />
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4" />
                        </svg>
                      </div>
                      <div>
                        <h4 id="member-restrictions-heading" class="text-base font-semibold text-slate-900">Restriction controls</h4>
                        <p class="mt-0.5 text-xs text-slate-500">Manage borrowing and reservation access for this member.</p>
                      </div>
                    </div>
                    <span class="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                      {restrictions.length} active
                    </span>
                  </div>
                </div>

                <div class="space-y-4 p-4 sm:p-5">
                  {#if restrictionError}
                    <p class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{restrictionError}</p>
                  {/if}

                  {#if restrictionsLoading}
                    <div class="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                      <span class="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#0D5C29]"></span>
                      Loading active restrictions…
                    </div>
                  {:else if restrictions.length}
                    <ul class="space-y-2">
                    {#each restrictions as restriction (restriction.id)}
                      <li class="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
                        <div class="flex min-w-0 items-start gap-3">
                          <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500"></span>
                          <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                              <p class="text-sm font-semibold text-slate-800">{restrictionLabel(restriction.restrictionType)}</p>
                              <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Active</span>
                            </div>
                          {#if restriction.reason}
                              <p class="mt-1 text-sm text-slate-600">{restriction.reason}</p>
                          {/if}
                            <p class="mt-1 text-xs text-slate-500">
                              Started {new Date(restriction.startDate).toLocaleDateString()}
                              {restriction.endDate ? ` · Ends ${new Date(restriction.endDate).toLocaleDateString()}` : ' · No end date'}
                            </p>
                          </div>
                        </div>
                        <button type="button" onclick={() => removeRestriction(restriction.id)} disabled={restrictionSaving}
                          class="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 hover:text-red-900 disabled:opacity-50">
                          Remove restriction
                        </button>
                      </li>
                    {/each}
                    </ul>
                  {:else}
                    <div class="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center">
                      <p class="text-sm font-medium text-slate-700">No active restrictions</p>
                      <p class="mt-1 text-xs text-slate-500">Select a control below to limit this member’s circulation access.</p>
                    </div>
                  {/if}

                  <form onsubmit={addRestriction} class="space-y-4 border-t border-slate-200 pt-4">
                    <div>
                      <div class="mb-2 flex items-center justify-between gap-2">
                        <fieldset>
                          <legend class="text-sm font-semibold text-slate-800">Add restriction</legend>
                        </fieldset>
                        <span class="text-xs text-slate-500">Select one or more</span>
                      </div>
                      <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <label class="group flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:border-amber-300 hover:bg-amber-50 has-[:checked]:border-amber-400 has-[:checked]:bg-amber-50">
                          <input type="checkbox" value="ban_borrowing" bind:group={restrictionTypes} disabled={restrictionSaving}
                            class="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0D5C29] focus:ring-[#0D5C29]" />
                          <span><span class="block text-sm font-semibold text-slate-800">Borrowing</span><span class="mt-0.5 block text-xs text-slate-500">Block new loans</span></span>
                        </label>
                        <label class="group flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:border-amber-300 hover:bg-amber-50 has-[:checked]:border-amber-400 has-[:checked]:bg-amber-50">
                          <input type="checkbox" value="ban_reservation" bind:group={restrictionTypes} disabled={restrictionSaving}
                            class="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0D5C29] focus:ring-[#0D5C29]" />
                          <span><span class="block text-sm font-semibold text-slate-800">Reservations</span><span class="mt-0.5 block text-xs text-slate-500">Block new requests</span></span>
                        </label>
                        <label class="group flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:border-amber-300 hover:bg-amber-50 has-[:checked]:border-amber-400 has-[:checked]:bg-amber-50">
                          <input type="checkbox" value="temporary_suspension" bind:group={restrictionTypes} disabled={restrictionSaving}
                            class="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0D5C29] focus:ring-[#0D5C29]" />
                          <span><span class="block text-sm font-semibold text-slate-800">Suspension</span><span class="mt-0.5 block text-xs text-slate-500">Pause circulation</span></span>
                        </label>
                      </div>
                    </div>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div class="space-y-1">
                        <label for="restriction-end-date" class="block text-xs font-medium text-slate-600">End date <span class="font-normal text-slate-400">(optional)</span></label>
                        <input id="restriction-end-date" type="date" bind:value={restrictionEndDate} disabled={restrictionSaving}
                          min={new Date().toISOString().slice(0, 10)} class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0D5C29] focus:outline-none focus:ring-2 focus:ring-[#0D5C29]/20" />
                      </div>
                      <div class="space-y-1">
                        <label for="restriction-reason" class="block text-xs font-medium text-slate-600">Reason <span class="font-normal text-slate-400">(optional)</span></label>
                        <input id="restriction-reason" type="text" bind:value={restrictionReason} maxlength="500" disabled={restrictionSaving}
                          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#0D5C29] focus:outline-none focus:ring-2 focus:ring-[#0D5C29]/20" placeholder="Add a short reason" />
                      </div>
                    </div>
                    <div class="flex flex-col gap-3 rounded-lg bg-amber-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <p class="text-xs leading-5 text-amber-800">Suspension blocks new borrowing and reservations. Login, returns, and cancellations remain available.</p>
                      <button type="submit" disabled={restrictionSaving || restrictionTypes.length === 0}
                        class="shrink-0 rounded-lg bg-[#0D5C29] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0A4520] disabled:cursor-not-allowed disabled:opacity-50">
                        {restrictionSaving ? 'Saving…' : 'Apply restriction'}
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            {/if}

            <!-- ══ SECTION 3: Status ══ -->
            <div class="text-xs p-2.5 rounded-lg border flex items-center gap-2 {member.isActive ? 'text-[#0D5C29] bg-[#E8B923]/10 border-[#E8B923]/30' : 'text-red-700 bg-red-50 border-red-200'}">
              <span class="inline-block h-2 w-2 rounded-full {member.isActive ? 'bg-[#0D5C29]' : 'bg-red-500'}"></span>
              Status: <span class="font-semibold">{member.isActive ? 'Active' : 'Inactive'}</span>
            </div>

          </div>
        </div>

        <!-- ── Footer ── -->
        <div class="px-6 py-4 border-t border-[#4A7C59]/20 bg-white/80 flex-shrink-0 flex justify-end">
          <button
            type="button" onclick={handleClose}
            class="px-6 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  </div>
{/if}

<style>
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,.05); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(74,124,89,.3); border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(74,124,89,.5); }
</style>