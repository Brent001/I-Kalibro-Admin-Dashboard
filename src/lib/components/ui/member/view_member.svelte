<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let member: {
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
    username?: string;
    isActive?: boolean;
  } | null = null;

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }
</script>

{#if isOpen && member}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-y-auto max-h-[90vh]">
      <div class="flex justify-between items-center px-6 py-4 border-b">
        <h3 class="text-xl font-bold text-gray-900">Member Details</h3>
        <button on:click={handleClose} class="text-gray-400 hover:text-gray-700" aria-label="Close">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="px-6 py-6 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span class="block text-sm font-medium text-gray-500">Type</span>
            <span class="block text-base font-semibold text-gray-900">{member.type}</span>
          </div>
          <div>
            <span class="block text-sm font-medium text-gray-500">Username</span>
            <span class="block text-base font-semibold text-gray-900">{member.username}</span>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span class="block text-sm font-medium text-gray-500">Full Name</span>
            <span class="block text-base font-semibold text-gray-900">{member.name}</span>
          </div>
          <div>
            <span class="block text-sm font-medium text-gray-500">Email</span>
            <span class="block text-base font-semibold text-gray-900">{member.email}</span>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span class="block text-sm font-medium text-gray-500">Phone</span>
            <span class="block text-base font-semibold text-gray-900">{member.phone}</span>
          </div>
          <div>
            <span class="block text-sm font-medium text-gray-500">Age</span>
            <span class="block text-base font-semibold text-gray-900">{member.age}</span>
          </div>
        </div>
        {#if member.type === 'Student'}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span class="block text-sm font-medium text-gray-500">Enrollment No</span>
              <span class="block text-base font-semibold text-gray-900">{member.enrollmentNo}</span>
            </div>
            <div>
              <span class="block text-sm font-medium text-gray-500">Course</span>
              <span class="block text-base font-semibold text-gray-900">{member.course}</span>
            </div>
            <div>
              <span class="block text-sm font-medium text-gray-500">Year</span>
              <span class="block text-base font-semibold text-gray-900">{member.year}</span>
            </div>
          </div>
        {/if}
        {#if member.type === 'Faculty'}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span class="block text-sm font-medium text-gray-500">Department</span>
              <span class="block text-base font-semibold text-gray-900">{member.department}</span>
            </div>
            <div>
              <span class="block text-sm font-medium text-gray-500">Designation</span>
              <span class="block text-base font-semibold text-gray-900">{member.designation}</span>
            </div>
          </div>
        {/if}
        <div>
          <span class="block text-sm font-medium text-gray-500">Status</span>
          <span class="inline-block px-3 py-1 rounded-full text-xs font-medium {member.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
            {member.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
      <div class="flex justify-end px-6 py-4 border-t">
        <button on:click={handleClose} class="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200">
          Close
        </button>
      </div>
    </div>
  </div>
{/if}