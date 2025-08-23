<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;

  const dispatch = createEventDispatcher();

  type MemberType = 'Student' | 'Faculty';

  type MemberForm = {
    type: MemberType;
    name: string;
    email: string;
    phone: string;
    age: string;
    username: string;
    password: string;
    confirmPassword: string;
    // Student fields
    enrollmentNo?: string;
    course?: string;
    year?: string;
    // Faculty fields
    department?: string;
    designation?: string;
  };

  let formData: MemberForm = {
    type: 'Student',
    name: '',
    email: '',
    phone: '',
    age: '',
    username: '',
    password: '',
    confirmPassword: '',
    enrollmentNo: '',
    course: '',
    year: '',
    department: '',
    designation: ''
  };

  let errors: Record<string, string> = {};
  let isLoading = false;
  let showPassword = false;
  let showConfirmPassword = false;

  function validateForm() {
    errors = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    if (!formData.username.trim()) errors.username = 'Username is required';
    if (!formData.password) errors.password = 'Password is required';
    if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    if (!formData.phone.trim()) errors.phone = 'Phone is required';
    // FIX: Age validation
    if (formData.age === '' || formData.age === null || formData.age === undefined) errors.age = 'Age is required';

    if (formData.type === 'Student') {
      if (!formData.enrollmentNo?.trim()) errors.enrollmentNo = 'Enrollment No is required';
      if (!formData.course?.trim()) errors.course = 'Course is required';
      if (!formData.year?.trim()) errors.year = 'Year is required';
    }
    if (formData.type === 'Faculty') {
      if (!formData.department?.trim()) errors.department = 'Department is required';
      if (!formData.designation?.trim()) errors.designation = 'Designation is required';
    }
    return Object.keys(errors).length === 0;
  }

  function resetForm() {
    formData = {
      type: 'Student',
      name: '',
      email: '',
      phone: '',
      age: '',
      username: '',
      password: '',
      confirmPassword: '',
      enrollmentNo: '',
      course: '',
      year: '',
      department: '',
      designation: ''
    };
    errors = {};
    showPassword = false;
    showConfirmPassword = false;
  }

  async function handleSubmit() {
    if (!validateForm()) return;
    isLoading = true;
    try {
      // You would POST to your API here
      dispatch('memberAdded', { ...formData });
      resetForm();
      closeModal();
    } catch (error) {
      console.error('Error adding member:', error);
    } finally {
      isLoading = false;
    }
  }

  function closeModal() {
    dispatch('close');
    resetForm();
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" on:click={handleBackdropClick} role="dialog" aria-modal="true">
    <div class="fixed inset-0 bg-black/50 backdrop-blur-sm"></div>
    <div class="relative w-full max-w-2xl">
      <div class="bg-white rounded-xl shadow-2xl border overflow-hidden">
        <form on:submit|preventDefault={handleSubmit}>
          <div class="px-6 py-4 border-b bg-white">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xl font-bold text-slate-900">Add New Member</h3>
                <p class="text-sm text-slate-600">Fill out all required fields</p>
              </div>
              <button type="button" class="p-2 rounded-xl text-slate-400 hover:text-slate-600" on:click={closeModal} disabled={isLoading}>
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div class="px-6 py-6 max-h-[60vh] overflow-y-auto space-y-6">
            <!-- Member Type -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Member Type</label>
              <select bind:value={formData.type} class="w-full px-3 py-2 border rounded-md" required>
                <option value="Student">Student</option>
                <option value="Faculty">Faculty</option>
              </select>
            </div>
            <!-- Common Fields -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" bind:value={formData.name} class="w-full px-3 py-2 border rounded-md" required>
                {#if errors.name}<p class="text-xs text-red-600">{errors.name}</p>{/if}
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" bind:value={formData.email} class="w-full px-3 py-2 border rounded-md" required>
                {#if errors.email}<p class="text-xs text-red-600">{errors.email}</p>{/if}
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="text" bind:value={formData.phone} class="w-full px-3 py-2 border rounded-md" required>
                {#if errors.phone}<p class="text-xs text-red-600">{errors.phone}</p>{/if}
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Age</label>
                <input type="number" bind:value={formData.age} class="w-full px-3 py-2 border rounded-md" required>
                {#if errors.age}<p class="text-xs text-red-600">{errors.age}</p>{/if}
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input type="text" bind:value={formData.username} class="w-full px-3 py-2 border rounded-md" required>
                {#if errors.username}<p class="text-xs text-red-600">{errors.username}</p>{/if}
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div class="relative">
                  <input type={showPassword ? 'text' : 'password'} bind:value={formData.password} class="w-full px-3 py-2 border rounded-md" required>
                  <button type="button" class="absolute right-2 top-2" on:click={() => showPassword = !showPassword}>
                    {#if showPassword}
                      <span>🙈</span>
                    {:else}
                      <span>👁️</span>
                    {/if}
                  </button>
                </div>
                {#if errors.password}<p class="text-xs text-red-600">{errors.password}</p>{/if}
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <div class="relative">
                <input type={showConfirmPassword ? 'text' : 'password'} bind:value={formData.confirmPassword} class="w-full px-3 py-2 border rounded-md" required>
                <button type="button" class="absolute right-2 top-2" on:click={() => showConfirmPassword = !showConfirmPassword}>
                  {#if showConfirmPassword}
                    <span>🙈</span>
                  {:else}
                    <span>👁️</span>
                  {/if}
                </button>
              </div>
              {#if errors.confirmPassword}<p class="text-xs text-red-600">{errors.confirmPassword}</p>{/if}
            </div>
            <!-- Student Fields -->
            {#if formData.type === 'Student'}
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Enrollment No</label>
                  <input type="text" bind:value={formData.enrollmentNo} class="w-full px-3 py-2 border rounded-md" required>
                  {#if errors.enrollmentNo}<p class="text-xs text-red-600">{errors.enrollmentNo}</p>{/if}
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Course</label>
                  <input type="text" bind:value={formData.course} class="w-full px-3 py-2 border rounded-md" required>
                  {#if errors.course}<p class="text-xs text-red-600">{errors.course}</p>{/if}
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <input type="text" bind:value={formData.year} class="w-full px-3 py-2 border rounded-md" required>
                  {#if errors.year}<p class="text-xs text-red-600">{errors.year}</p>{/if}
                </div>
              </div>
            {/if}
            <!-- Faculty Fields -->
            {#if formData.type === 'Faculty'}
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input type="text" bind:value={formData.department} class="w-full px-3 py-2 border rounded-md" required>
                  {#if errors.department}<p class="text-xs text-red-600">{errors.department}</p>{/if}
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                  <input type="text" bind:value={formData.designation} class="w-full px-3 py-2 border rounded-md" required>
                  {#if errors.designation}<p class="text-xs text-red-600">{errors.designation}</p>{/if}
                </div>
              </div>
            {/if}
          </div>
          <div class="px-6 py-4 border-t bg-white flex flex-col sm:flex-row-reverse gap-3">
            <button type="submit" class="flex-1 sm:flex-initial min-w-[120px] inline-flex justify-center items-center rounded-xl border border-transparent shadow-lg px-6 py-3 bg-slate-900 text-base font-medium text-white hover:bg-slate-800 transition-all duration-200 disabled:opacity-50" disabled={isLoading}>
              {#if isLoading}
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              {:else}
                Create Member
              {/if}
            </button>
            <button type="button" on:click={closeModal} disabled={isLoading} class="flex-1 sm:flex-initial min-w-[120px] inline-flex justify-center items-center rounded-xl border border-slate-300 shadow-sm px-6 py-3 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 transition-all duration-200 disabled:opacity-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}