<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, scale, slide } from 'svelte/transition';

  export let isOpen = false;
  const dispatch = createEventDispatcher();

  const colors = {
    mdcBlue: '#0D5C29',
    mdcGold: '#E8B923',
  };

  let isLoading = false;
  let formData = {
    type: 'Student',
    name: '',
    email: '',
    phone: '',
    gender: '',
    age: '',
    username: '',
    password: '',
    enrollmentNo: '',
    course: '',
    year: '',
    department: '',
    facultyNumber: '',
    position: ''
  };

  function closeModal() {
    dispatch('close');
  }

  function resetForm() {
    formData = {
      type: 'Student',
      name: '',
      email: '',
      phone: '',
      gender: '',
      age: '',
      username: '',
      password: '',
      enrollmentNo: '',
      course: '',
      year: '',
      department: '',
      facultyNumber: '',
      position: ''
    };
  }

  async function handleSubmit() {
    isLoading = true;
    setTimeout(() => {
      dispatch('memberAdded', formData);
      isLoading = false;
      resetForm();
      closeModal();
    }, 1500);
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 backdrop-blur-sm bg-slate-900/60" transition:fade>
    
    <div class="relative w-full max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden border-t-[6px]" 
         style="border-top-color: {colors.mdcGold}"
         transition:scale={{ start: 0.95, duration: 200 }}>
      
      <div class="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100" style="background-color: {colors.mdcBlue}">
        <div class="flex items-center gap-3 sm:gap-4">
          <div class="p-2 sm:p-2.5 rounded-xl text-white shadow-md hidden sm:block" style="background-color: {colors.mdcGold}; color: {colors.mdcBlue}">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          </div>
          <div>
            <h2 class="text-base sm:text-lg font-bold text-white leading-tight">Add New Member</h2>
            <p class="text-[10px] sm:text-xs text-slate-200 font-medium">Metro-Dagupan Colleges System</p>
          </div>
        </div>
        <button on:click={closeModal} aria-label="Close modal" class="p-2 hover:bg-white/20 rounded-full transition-colors text-slate-200">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <form on:submit|preventDefault={handleSubmit} class="p-5 sm:p-8 space-y-6 sm:space-y-8 max-h-[80vh] sm:max-h-[85vh] overflow-y-auto">
        
        <!-- Personal Details Section -->
        <section class="space-y-4">
          <div class="flex items-center gap-2 border-b pb-2" style="border-color: {colors.mdcGold}">
            <div class="w-2 h-2 rounded-full" style="background-color: {colors.mdcBlue}"></div>
            <h3 class="text-[11px] font-black uppercase tracking-widest" style="color: {colors.mdcBlue}">Personal Details</h3>
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div class="space-y-1.5">
              <label for="full-name" class="label-text">Full Name</label>
              <input id="full-name" bind:value={formData.name} placeholder="Juan Dela Cruz" class="input-field" required />
            </div>
            <div class="space-y-1.5">
              <label for="email" class="label-text">Email Address</label>
              <input id="email" type="email" bind:value={formData.email} placeholder="name@mdc.edu.ph" class="input-field" required />
            </div>
            <div class="space-y-1.5">
              <label for="phone" class="label-text">Phone Number</label>
              <input id="phone" type="tel" bind:value={formData.phone} placeholder="+63 900 000 0000" class="input-field" />
            </div>
            <div class="space-y-1.5">
              <label for="age" class="label-text">Age</label>
              <input id="age" type="number" bind:value={formData.age} placeholder="18" class="input-field" min="1" max="120" />
            </div>
            <div class="space-y-1.5">
              <label for="gender" class="label-text">Gender</label>
              <select id="gender" bind:value={formData.gender} class="input-field">
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="space-y-1.5">
              <label for="username" class="label-text">Username</label>
              <input id="username" bind:value={formData.username} placeholder="username" class="input-field" required />
            </div>
          </div>
        </section>

        <!-- Credentials Section -->
        <section class="space-y-4">
          <div class="flex items-center gap-2 border-b pb-2" style="border-color: {colors.mdcGold}">
            <div class="w-2 h-2 rounded-full" style="background-color: {colors.mdcBlue}"></div>
            <h3 class="text-[11px] font-black uppercase tracking-widest" style="color: {colors.mdcBlue}">Credentials</h3>
          </div>
          
          <div class="grid grid-cols-1 gap-4 sm:gap-6">
            <div class="space-y-1.5">
              <label for="password" class="label-text">Password</label>
              <input id="password" type="password" bind:value={formData.password} placeholder="••••••••" class="input-field" required />
            </div>
          </div>
        </section>

        <!-- Academic Affiliation Section -->
        <section class="p-4 sm:p-6 rounded-2xl border-2 transition-all" style="border-color: {colors.mdcBlue}; background-color: #fcfcfd">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 class="text-xs font-bold uppercase tracking-tight" style="color: {colors.mdcBlue}">Academic Affiliation</h3>
            <div class="flex p-1 rounded-xl w-full sm:w-auto" style="background-color: {colors.mdcBlue}20">
                <button type="button" 
                        class="flex-1 sm:flex-none px-6 py-1.5 text-xs font-bold rounded-lg transition-all"
                        style="background: {formData.type === 'Student' ? 'white' : 'transparent'}; color: {formData.type === 'Student' ? colors.mdcBlue : '#64748b'}; box-shadow: {formData.type === 'Student' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'}"
                        on:click={() => formData.type = 'Student'}>Student</button>
                <button type="button" 
                        class="flex-1 sm:flex-none px-6 py-1.5 text-xs font-bold rounded-lg transition-all"
                        style="background: {formData.type === 'Faculty' ? 'white' : 'transparent'}; color: {formData.type === 'Faculty' ? colors.mdcBlue : '#64748b'}"
                        on:click={() => formData.type = 'Faculty'}>Faculty</button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" transition:slide>
            {#if formData.type === 'Student'}
              <div class="space-y-1.5">
                <label for="enroll-no" class="label-text">Enrollment #</label>
                <input id="enroll-no" bind:value={formData.enrollmentNo} placeholder="2024-0001" class="input-field bg-white" required />
              </div>
              <div class="space-y-1.5">
                <label for="course" class="label-text">Course</label>
                <input id="course" bind:value={formData.course} placeholder="BS Information Technology" class="input-field bg-white" />
              </div>
              <div class="space-y-1.5">
                <label for="dept" class="label-text">Department</label>
                <input id="dept" bind:value={formData.department} placeholder="IT Department" class="input-field bg-white" />
              </div>
              <div class="space-y-1.5">
                <label for="year" class="label-text">Year Level</label>
                <select id="year" bind:value={formData.year} class="input-field bg-white">
                  <option value="">Select Year</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>
            {:else}
              <div class="col-span-1 sm:col-span-2 space-y-1.5">
                <label for="fac-no" class="label-text">Faculty ID No.</label>
                <input id="fac-no" bind:value={formData.facultyNumber} placeholder="FAC-2024-001" class="input-field bg-white" required />
              </div>
              <div class="col-span-1 sm:col-span-2 space-y-1.5">
                <label for="fac-dept" class="label-text">Department</label>
                <input id="fac-dept" bind:value={formData.department} placeholder="IT Department" class="input-field bg-white" />
              </div>
              <div class="col-span-1 sm:col-span-2 space-y-1.5">
                <label for="position" class="label-text">Position</label>
                <input id="position" bind:value={formData.position} placeholder="Assistant Professor" class="input-field bg-white" />
              </div>
            {/if}
          </div>
        </section>

        <div class="flex flex-col-reverse sm:flex-row justify-end items-center gap-3 sm:gap-4 pt-2 pb-6 sm:pb-0">
          <button type="button" on:click={closeModal} 
            class="w-full sm:w-auto px-6 py-3 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all uppercase tracking-wide">
            Cancel
          </button>
          <button type="submit" disabled={isLoading}
            class="w-full sm:w-auto px-10 py-3 text-sm font-bold text-white rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-70"
            style="background-color: {colors.mdcBlue}; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1)">
            {#if isLoading}
              <span class="inline-block animate-spin mr-2">↻</span>
            {/if}
            Save Member
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .label-text {
    display: block;
    font-size: 0.75rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    margin-left: 0.1rem;
    letter-spacing: 0.025em;
  }

  .input-field {
    width: 100%;
    padding: 0.75rem 1rem; /* Slightly larger for mobile tap targets */
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    outline: none;
    font-size: 1rem; /* Prevents auto-zoom on iOS */
    transition: all 0.2s;
  }

  @media (min-width: 640px) {
    .input-field {
      font-size: 0.9rem;
      padding: 0.65rem 0.9rem;
    }
  }

  .input-field:focus {
    background-color: #ffffff;
    border-color: #003399;
    box-shadow: 0 0 0 4px rgba(0, 51, 153, 0.08);
  }
</style>