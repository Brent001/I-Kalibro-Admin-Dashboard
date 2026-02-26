<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

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
    facultyNumber?: string;
    username?: string;
    password?: string;
    isActive?: boolean;
    gender?: string;
  } | null = null;
  export let isLoading = false;

  const dispatch = createEventDispatcher();

  let formData = {
    type: 'Student',
    name: '',
    email: '',
    phone: '',
    age: '',
    enrollmentNo: '',
    course: '',
    year: '',
    department: '',
    designation: '',
    facultyNumber: '',
    username: '',
    password: '',
    isActive: true,
    gender: ''
  };

  onMount(() => {
    if (member) {
      formData = {
        type: member.type ?? 'Student',
        name: member.name ?? '',
        email: member.email ?? '',
        phone: member.phone ?? '',
        age: member.age ?? '',
        enrollmentNo: member.enrollmentNo ?? '',
        course: member.course ?? '',
        year: member.year ?? '',
        department: member.department ?? '',
        designation: member.designation ?? '',
        facultyNumber: member.facultyNumber ?? '',
        username: member.username ?? '',
        password: '',
        isActive: member.isActive ?? true,
        gender: member.gender ?? ''
      };
    }
  });

  $: if (member) {
    formData = {
      type: member.type ?? 'Student',
      name: member.name ?? '',
      email: member.email ?? '',
      phone: member.phone ?? '',
      age: member.age ?? '',
      enrollmentNo: member.enrollmentNo ?? '',
      course: member.course ?? '',
      year: member.year ?? '',
      department: member.department ?? '',
      designation: member.designation ?? '',
      facultyNumber: member.facultyNumber ?? '',
      username: member.username ?? '',
      password: '',
      isActive: member.isActive ?? true,
      gender: member.gender ?? ''
    };
  }

  function handleClose() {
    dispatch('close');
  }

  function handleSubmit() {
    dispatch('submit', { ...formData });
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-y-auto max-h-[90vh]">
      <div class="flex justify-between items-center px-6 py-4 border-b">
        <h3 class="text-xl font-bold text-gray-900">Edit Member</h3>
        <button on:click={handleClose} class="text-gray-400 hover:text-gray-700" aria-label="Close">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <form class="px-6 py-6 space-y-5" on:submit|preventDefault={handleSubmit}>
        <div>
          <label class="block text-sm font-medium mb-1">Member Type</label>
          <select bind:value={formData.type} class="w-full px-3 py-2 border rounded-md" disabled>
            <option value="Student">Student</option>
            <option value="Faculty">Faculty</option>
          </select>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Full Name</label>
            <input type="text" bind:value={formData.name} class="w-full px-3 py-2 border rounded-md" required>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Email</label>
            <input type="email" bind:value={formData.email} class="w-full px-3 py-2 border rounded-md" required>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Phone</label>
            <input type="text" bind:value={formData.phone} class="w-full px-3 py-2 border rounded-md" required>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Age</label>
            <input type="number" bind:value={formData.age} class="w-full px-3 py-2 border rounded-md" required>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Username</label>
            <input type="text" bind:value={formData.username} class="w-full px-3 py-2 border rounded-md" required>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Password (leave blank to keep current)</label>
            <input type="password" bind:value={formData.password} class="w-full px-3 py-2 border rounded-md">
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Gender</label>
            <input type="text" bind:value={formData.gender} class="w-full px-3 py-2 border rounded-md" required>
          </div>
        </div>
        {#if formData.type === 'Student'}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Enrollment No</label>
              <input type="text" bind:value={formData.enrollmentNo} class="w-full px-3 py-2 border rounded-md" required>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Course</label>
              <input type="text" bind:value={formData.course} class="w-full px-3 py-2 border rounded-md" required>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Year</label>
              <input type="text" bind:value={formData.year} class="w-full px-3 py-2 border rounded-md" required>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Department</label>
              <input type="text" bind:value={formData.department} class="w-full px-3 py-2 border rounded-md" required>
            </div>
          </div>
        {/if}
        {#if formData.type === 'Faculty'}
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Department</label>
              <input type="text" bind:value={formData.department} class="w-full px-3 py-2 border rounded-md" required>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Designation</label>
              <input type="text" bind:value={formData.designation} class="w-full px-3 py-2 border rounded-md" required>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Faculty Number</label>
              <input type="text" bind:value={formData.facultyNumber} class="w-full px-3 py-2 border rounded-md" required>
            </div>
          </div>
        {/if}
        <div class="flex flex-col sm:flex-row-reverse gap-3 pt-4">
          <button
            type="submit"
            class="flex-1 sm:flex-initial min-w-[120px] inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-slate-900 text-base font-medium text-white hover:bg-slate-800 transition-colors duration-200"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Update Member'}
          </button>
          <button
            type="button"
            on:click={handleClose}
            class="flex-1 sm:flex-initial min-w-[120px] inline-flex justify-center items-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}