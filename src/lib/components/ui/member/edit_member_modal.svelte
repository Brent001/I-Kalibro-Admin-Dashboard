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
  let showPassword = false;

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

  const departments = [
    'College of Business Administration, Tourism, and Computer Science (CBAT.COM)',
    'College of Teacher Education (COTE)',
    'College of Criminology (CoCrim)'
  ];
  const courses = [
    { value: 'BSCS', label: 'Bachelor of Science in Computer Science (BSCS)' },
    { value: 'BSBA-MM', label: 'BSBA - Marketing Management' },
    { value: 'BSBA-FM', label: 'BSBA - Financial Management' },
    { value: 'BSTM', label: 'Bachelor of Science in Tourism Management (BSTM)' },
    { value: 'BEEd', label: 'Bachelor of Elementary Education (BEEd)' },
    { value: 'BSEd-English', label: 'BSEd - English' },
    { value: 'BSEd-Filipino', label: 'BSEd - Filipino' },
    { value: 'BSEd-Math', label: 'BSEd - Mathematics' },
    { value: 'BSEd-Science', label: 'BSEd - Science' },
    { value: 'BSEd-TLE-IA', label: 'BSEd-TLE - Industrial Arts' },
    { value: 'BSEd-TLE-HE', label: 'BSEd-TLE - Home Economics' },
    { value: 'BPEd', label: 'Bachelor of Physical Education (BPEd)' },
    { value: 'BSCrim', label: 'Bachelor of Science in Criminology (BSCrim)' }
  ];
  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

  function loadFromMember() {
    if (member) {
      formData = {
        type: member.type ?? 'Student',
        name: member.name ?? '',
        email: member.email ?? '',
        phone: member.phone ?? '',
        age: String(member.age ?? ''),
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
  }

  onMount(loadFromMember);

  $: if (member) {
    loadFromMember();
  }

  function handleClose() {
    if (!isLoading) dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleSubmit() {
    dispatch('submit', { ...formData });
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button
      class="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-default"
      onclick={!isLoading ? handleClose : null}
      disabled={isLoading}
      aria-label="Close modal"
      type="button"
    ></button>

    <div class="relative w-full max-w-3xl transform transition-all duration-300 scale-100">
      <div class="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-[#4A7C59]/30 overflow-hidden flex flex-col h-[90vh]">
        <form onsubmit={(event) => { event.preventDefault(); handleSubmit(); }} class="flex flex-col h-full">

          <!-- ── Header ── -->
          <div class="px-6 py-4 border-b border-[#4A7C59]/20 bg-white/80 flex-shrink-0">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-[#0D5C29] to-[#4A7C59] shadow-lg flex-shrink-0">
                  <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </div>
                <div class="min-w-0">
                  <h3 class="text-lg sm:text-xl font-bold text-[#0D5C29] truncate">Edit Member{member?.name ? `: ${member.name}` : ''}</h3>
                  <p class="text-xs sm:text-sm text-[#4A7C59] hidden sm:block">Update member details and academic affiliation</p>
                </div>
              </div>
              <button
                type="button" onclick={handleClose}
                disabled={isLoading}
                aria-label="Close modal"
                class="p-2 rounded-lg text-gray-400 hover:text-[#0D5C29] hover:bg-[#0D5C29]/10 transition-colors duration-200 disabled:opacity-50 flex-shrink-0"
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
                  <span class="text-xs bg-[#E8B923]/20 text-[#0D5C29] px-2.5 py-0.5 rounded-full font-semibold flex-shrink-0">{formData.type}</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  <div class="sm:col-span-2">
                    <label for="name-edit" class="block text-xs font-medium text-gray-500 mb-1">Full Name <span class="text-red-400">*</span></label>
                    <input
                      id="name-edit" type="text" bind:value={formData.name}
                      disabled={isLoading}
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label for="email-edit" class="block text-xs font-medium text-gray-500 mb-1">Email Address <span class="text-red-400">*</span></label>
                    <input
                      id="email-edit" type="email" bind:value={formData.email}
                      disabled={isLoading}
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label for="phone-edit" class="block text-xs font-medium text-gray-500 mb-1">Phone <span class="text-red-400">*</span></label>
                    <input
                      id="phone-edit" type="tel" bind:value={formData.phone}
                      disabled={isLoading}
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label for="age-edit" class="block text-xs font-medium text-gray-500 mb-1">Age <span class="text-red-400">*</span></label>
                    <input
                      id="age-edit" type="number" bind:value={formData.age}
                      disabled={isLoading}
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                      min="16" max="100"
                      required
                    />
                  </div>

                  <div>
                    <label for="gender-edit" class="block text-xs font-medium text-gray-500 mb-1">Gender <span class="text-red-400">*</span></label>
                    <select
                      id="gender-edit" bind:value={formData.gender}
                      disabled={isLoading}
                      class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                      required>
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>

                </div>
              </div>

              <!-- ══ SECTION 2: Credentials ══ -->
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-4">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Credentials</h4>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  <div>
                    <label for="username-edit" class="block text-xs font-medium text-gray-500 mb-1">Username <span class="text-red-400">*</span></label>
                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span class="text-gray-400 text-sm">@</span>
                      </div>
                      <input
                        id="username-edit" type="text" bind:value={formData.username}
                        disabled={isLoading}
                        class="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label for="password-edit" class="block text-xs font-medium text-gray-500 mb-1">Password <span class="text-gray-400">(leave blank to keep current)</span></label>
                    <div class="relative">
                      <input
                        id="password-edit" type={showPassword ? 'text' : 'password'} bind:value={formData.password}
                        disabled={isLoading}
                        placeholder="••••••••"
                        class="w-full pl-3 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white"
                      />
                      <button
                        type="button"
                        class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#0D5C29] transition-colors"
                        onclick={() => showPassword = !showPassword}
                        tabindex="-1"
                      >
                        {#if showPassword}
                          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M21.536 15.536l-1.414-1.414M21.536 15.536L9.878 9.878"/>
                          </svg>
                        {:else}
                          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                        {/if}
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              <!-- ══ SECTION 3: Academic Affiliation ══ -->
              <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4 sm:p-5">
                <div class="flex items-center gap-2 mb-4">
                  <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0112 20.055 12.083 12.083 0 015.84 10.578L12 14z"/>
                  </svg>
                  <h4 class="text-base sm:text-lg font-semibold text-[#0D5C29]">Academic Affiliation</h4>
                  <span class="text-xs text-gray-400 ml-1">(type is fixed at creation)</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {#if formData.type === 'Student'}
                    <div>
                      <label for="enroll-edit" class="block text-xs font-medium text-gray-500 mb-1">Enrollment No <span class="text-red-400">*</span></label>
                      <input id="enroll-edit" type="text" bind:value={formData.enrollmentNo} disabled={isLoading}
                        oninput={(event) => {
                          let value = (event.currentTarget as HTMLInputElement).value.replace(/\D/g, '').slice(0, 10);
                          if (value.length > 4) value = `${value.slice(0, 4)}-${value.slice(4)}`;
                          formData.enrollmentNo = value;
                        }}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white" required />
                    </div>
                    <div>
                      <label for="course-edit" class="block text-xs font-medium text-gray-500 mb-1">Course <span class="text-red-400">*</span></label>
                      <select id="course-edit" bind:value={formData.course} disabled={isLoading}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white" required>
                        <option value="">Select course</option>
                        {#if formData.course && !courses.some(course => course.value === formData.course)}
                          <option value={formData.course}>{formData.course} (legacy)</option>
                        {/if}
                        {#each courses as course}<option value={course.value}>{course.label}</option>{/each}
                      </select>
                    </div>
                    <div>
                      <label for="year-edit" class="block text-xs font-medium text-gray-500 mb-1">Year <span class="text-red-400">*</span></label>
                      <select id="year-edit" bind:value={formData.year} disabled={isLoading}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white" required>
                        <option value="">Select year level</option>
                        {#each years as year}<option value={year}>{year}</option>{/each}
                      </select>
                    </div>
                    <div>
                      <label for="dept-edit" class="block text-xs font-medium text-gray-500 mb-1">Department <span class="text-red-400">*</span></label>
                      <select id="dept-edit" bind:value={formData.department} disabled={isLoading}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white" required>
                        <option value="">Select your department</option>
                        {#if formData.department && !departments.includes(formData.department)}
                          <option value={formData.department}>{formData.department} (legacy)</option>
                        {/if}
                        {#each departments as department}<option value={department}>{department}</option>{/each}
                      </select>
                    </div>
                  {:else}
                    <div>
                      <label for="dept-fac-edit" class="block text-xs font-medium text-gray-500 mb-1">Department <span class="text-red-400">*</span></label>
                      <select id="dept-fac-edit" bind:value={formData.department} disabled={isLoading}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white" required>
                        <option value="">Select your department</option>
                        {#if formData.department && !departments.includes(formData.department)}
                          <option value={formData.department}>{formData.department} (legacy)</option>
                        {/if}
                        {#each departments as department}<option value={department}>{department}</option>{/each}
                      </select>
                    </div>
                    <div>
                      <label for="designation-edit" class="block text-xs font-medium text-gray-500 mb-1">Designation <span class="text-red-400">*</span></label>
                      <input id="designation-edit" type="text" bind:value={formData.designation} disabled={isLoading}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white" required />
                    </div>
                    <div class="sm:col-span-2">
                      <label for="facno-edit" class="block text-xs font-medium text-gray-500 mb-1">Faculty Number <span class="text-red-400">*</span></label>
                      <input id="facno-edit" type="text" bind:value={formData.facultyNumber} disabled={isLoading}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#E8B923] focus:border-[#E8B923] transition-all duration-200 disabled:opacity-50 bg-white" required />
                    </div>
                  {/if}
                </div>
              </div>

            </div>
          </div>

          <!-- ── Footer ── -->
          <div class="px-6 py-4 border-t border-[#4A7C59]/20 bg-white/80 flex flex-col sm:flex-row-reverse gap-3 flex-shrink-0">
            <button
              type="submit"
              disabled={isLoading}
              class="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] text-sm font-semibold text-white hover:from-[#0A4520] hover:to-[#3D664A] shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {#if isLoading}
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Saving…
              {:else}
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
                Update Member
              {/if}
            </button>
            <button
              type="button" onclick={handleClose}
              disabled={isLoading}
              class="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>

        </form>
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