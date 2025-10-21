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
    age: number | '';
    gender: string;
    username: string;
    password: string;
    confirmPassword?: string;
    // Student fields
    enrollmentNo?: string;
    course?: string;
    year?: string;
    department?: string;
    // Faculty fields
    facultyNumber?: string;
  };

  let formData: MemberForm = {
    type: 'Student',
    name: '',
    email: '',
    phone: '',
    age: '',
    gender: '',
    username: '',
    password: '',
    confirmPassword: '',
    enrollmentNo: '',
    course: '',
    year: '',
    department: '',
    facultyNumber: ''
  };

  let errors: Record<string, string> = {};
  let isLoading = false;
  let showPassword = false;
  let showConfirmPassword = false;

  function validateForm() {
    errors = {};

    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.username.trim()) {
      errors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    if (!formData.phone.trim()) {
      errors.phone = 'Phone is required';
    } else if (!/^\+?[\d\s\-\(\)]+$/.test(formData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }
    if (formData.age === '' || formData.age === null || formData.age === undefined) {
      errors.age = 'Age is required';
    } else if (typeof formData.age === 'number' && (formData.age < 16 || formData.age > 100)) {
      errors.age = 'Age must be between 16 and 100';
    }
    if (!formData.gender) {
      errors.gender = 'Gender is required';
    }

    if (formData.type === 'Student') {
      if (!formData.enrollmentNo?.trim()) errors.enrollmentNo = 'Enrollment No is required';
      if (!formData.course?.trim()) errors.course = 'Course is required';
      if (!formData.year?.trim()) errors.year = 'Year is required';
      if (!formData.department?.trim()) errors.department = 'Department is required';
    }

    if (formData.type === 'Faculty') {
      if (!formData.department?.trim()) errors.department = 'Department is required';
      if (!formData.facultyNumber?.trim()) errors.facultyNumber = 'Faculty Number is required';
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
      gender: '',
      username: '',
      password: '',
      confirmPassword: '',
      enrollmentNo: '',
      course: '',
      year: '',
      department: '',
      facultyNumber: ''
    };
    errors = {};
    showPassword = false;
    showConfirmPassword = false;
  }

  async function handleSubmit() {
    if (!validateForm()) return;
    isLoading = true;
    try {
      const payload = {
        ...formData,
        age: Number(formData.age)
      };
      delete payload.confirmPassword;

      dispatch('memberAdded', payload);
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

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }

  function handleAgeInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    formData.age = value === '' ? '' : parseInt(value);
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
     on:click={handleBackdropClick}
     on:keydown={(e) => { if (e.key === 'Escape') closeModal(); }}
     role="dialog"
     aria-modal="true"
     tabindex="0">
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
    <div class="relative w-full max-w-2xl">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <form on:submit|preventDefault={handleSubmit}>
          <!-- Header -->
          <div class="px-8 py-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="p-2 bg-slate-600 rounded-xl">
                  <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-2xl font-bold text-slate-900">Add New Member</h3>
                  <p class="text-sm text-slate-600 mt-1">Create a new {formData.type.toLowerCase()} account</p>
                </div>
              </div>
              <button type="button"
        class="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
        on:click={closeModal}
        disabled={isLoading}
        aria-label="Close">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div class="px-8 py-6 max-h-[65vh] overflow-y-auto space-y-6">
            <!-- Member Type -->
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-3">Member Type</label>
              <div class="relative">
                <select bind:value={formData.type} class="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-900 font-medium transition-all" required>
                  <option value="Student">Student</option>
                  <option value="Faculty">Faculty</option>
                </select>
                <div class="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <!-- Basic Information -->
            <div class="space-y-4">
              <h4 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">Basic Information</h4>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Name -->
                <div>
                  <label for="fullName" class="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                  <div class="relative">
                    <input
                      id="fullName"
                      type="text"
                      bind:value={formData.name}
                      class="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all {errors.name ? 'border-red-500 focus:ring-red-500' : ''}"
                      placeholder="Enter full name"
                      required
                    >
                    <div class="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                  {#if errors.name}<p class="text-sm text-red-600 mt-1 flex items-center"><svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>{errors.name}</p>{/if}
                </div>

                <!-- Email -->
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                  <div class="relative">
                    <input 
                      type="email" 
                      bind:value={formData.email} 
                      class="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all {errors.email ? 'border-red-500 focus:ring-red-500' : ''}" 
                      placeholder="Enter email address"
                      required
                    >
                    <div class="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </div>
                  </div>
                  {#if errors.email}<p class="text-sm text-red-600 mt-1 flex items-center"><svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>{errors.email}</p>{/if}
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Phone -->
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                  <div class="relative">
                    <input 
                      type="tel" 
                      bind:value={formData.phone} 
                      class="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all {errors.phone ? 'border-red-500 focus:ring-red-500' : ''}" 
                      placeholder="+63 9XX XXX XXXX"
                      required
                    >
                    <div class="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                  </div>
                  {#if errors.phone}<p class="text-sm text-red-600 mt-1 flex items-center"><svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>{errors.phone}</p>{/if}
                </div>

                <!-- Age -->
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Age</label>
                  <div class="relative">
                    <input 
                      type="number" 
                      min="16" 
                      max="100"
                      value={formData.age}
                      on:input={handleAgeInput}
                      class="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all {errors.age ? 'border-red-500 focus:ring-red-500' : ''}" 
                      placeholder="Enter age"
                      required
                    >
                    <div class="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  {#if errors.age}<p class="text-sm text-red-600 mt-1 flex items-center"><svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>{errors.age}</p>{/if}
                </div>
              </div>

              <!-- Gender -->
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-2">Gender</label>
                <select bind:value={formData.gender} class="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-900 font-medium transition-all" required>
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {#if errors.gender}<p class="text-sm text-red-600 mt-1">{errors.gender}</p>{/if}
              </div>
            </div>

            <!-- Account Information -->
            <div class="space-y-4">
              <h4 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">Account Information</h4>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Username -->
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Username</label>
                  <div class="relative">
                    <input 
                      type="text" 
                      bind:value={formData.username} 
                      class="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all {errors.username ? 'border-red-500 focus:ring-red-500' : ''}" 
                      placeholder="Choose username"
                      required
                    >
                    <div class="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  {#if errors.username}<p class="text-sm text-red-600 mt-1 flex items-center"><svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>{errors.username}</p>{/if}
                </div>

                <!-- Password -->
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-2">Password</label>
                  <div class="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      bind:value={formData.password} 
                      class="w-full pl-12 pr-12 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all {errors.password ? 'border-red-500 focus:ring-red-500' : ''}" 
                      placeholder="Create password"
                      required
                    >
                    <div class="absolute left-4 top-1/2 transform -translate-y-1/2">
                      <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <button 
                      type="button" 
                      class="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" 
                      on:click={() => showPassword = !showPassword}
                    >
                      {#if showPassword}
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M9.878 9.878l-2.122-2.121m7.071 7.071l2.122 2.122M14.121 14.121L16.243 16.243M14.121 14.121l-4.243-4.243m7.071 7.071l2.122 2.122" />
                        </svg>
                      {:else}
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      {/if}
                    </button>
                  </div>
                  {#if errors.password}<p class="text-sm text-red-600 mt-1 flex items-center"><svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>{errors.password}</p>{/if}
                </div>
              </div>

              <!-- Confirm Password -->
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-2">Confirm Password</label>
                <div class="relative">
                  <input 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    bind:value={formData.confirmPassword} 
                    class="w-full pl-12 pr-12 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all {errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}" 
                    placeholder="Confirm your password"
                    required
                  >
                  <div class="absolute left-4 top-1/2 transform -translate-y-1/2">
                    <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <button 
                    type="button" 
                    class="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" 
                    on:click={() => showConfirmPassword = !showConfirmPassword}
                  >
                    {#if showConfirmPassword}
                      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464M9.878 9.878l-2.122-2.121m7.071 7.071l2.122 2.122M14.121 14.121L16.243 16.243M14.121 14.121l-4.243-4.243m7.071 7.071l2.122 2.122" />
                      </svg>
                    {:else}
                      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    {/if}
                  </button>
                </div>
                {#if errors.confirmPassword}<p class="text-sm text-red-600 mt-1 flex items-center"><svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>{errors.confirmPassword}</p>{/if}
              </div>
            </div>

            <!-- Student Fields -->
            {#if formData.type === 'Student'}
              <div class="space-y-4">
                <h4 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2 flex items-center">
                  <svg class="h-5 w-5 mr-2 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253z" />
                  </svg>
                  Student Information
                </h4>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <!-- Enrollment No -->
                  <div>
                    <label class="block text-sm font-medium text-slate-700 mb-2">Enrollment Number</label>
                    <div class="relative">
                      <input 
                        type="text" 
                        bind:value={formData.enrollmentNo} 
                        class="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all {errors.enrollmentNo ? 'border-red-500 focus:ring-red-500' : ''}" 
                        placeholder="Enter enrollment no"
                        required
                      >
                      <div class="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                    {#if errors.enrollmentNo}<p class="text-sm text-red-600 mt-1 flex items-center"><svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>{errors.enrollmentNo}</p>{/if}
                  </div>

                  <!-- Course -->
                  <div>
                    <label class="block text-sm font-medium text-slate-700 mb-2">Course</label>
                    <div class="relative">
                      <input 
                        type="text" 
                        bind:value={formData.course} 
                        class="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all {errors.course ? 'border-red-500 focus:ring-red-500' : ''}" 
                        placeholder="e.g., Computer Science"
                        required
                      >
                      <div class="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                    </div>
                    {#if errors.course}<p class="text-sm text-red-600 mt-1 flex items-center"><svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>{errors.course}</p>{/if}
                  </div>

                  <!-- Year -->
                  <div>
                    <label class="block text-sm font-medium text-slate-700 mb-2">Year</label>
                    <div class="relative">
                      <select 
                        bind:value={formData.year} 
                        class="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white transition-all {errors.year ? 'border-red-500 focus:ring-red-500' : ''}" 
                        required
                      >
                        <option value="">Select year</option>
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                        <option value="5th Year">5th Year</option>
                      </select>
                      <div class="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    {#if errors.year}<p class="text-sm text-red-600 mt-1 flex items-center"><svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>{errors.year}</p>{/if}
                  </div>
                </div>
              </div>
            {/if}

            <!-- Faculty Fields -->
            {#if formData.type === 'Faculty'}
              <div class="space-y-4">
                <h4 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2 flex items-center">
                  <svg class="h-5 w-5 mr-2 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Faculty Information
                </h4>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <!-- Department -->
                  <div>
                    <label class="block text-sm font-medium text-slate-700 mb-2">Department</label>
                    <div class="relative">
                      <input 
                        type="text" 
                        bind:value={formData.department} 
                        class="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all {errors.department ? 'border-red-500 focus:ring-red-500' : ''}" 
                        placeholder="e.g., Computer Science"
                        required
                      >
                      <div class="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    </div>
                    {#if errors.department}<p class="text-sm text-red-600 mt-1 flex items-center"><svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>{errors.department}</p>{/if}
                  </div>

                  <!-- Faculty Number -->
                  <div>
                    <label class="block text-sm font-medium text-slate-700 mb-2">Faculty Number</label>
                    <div class="relative">
                      <input 
                        type="text" 
                        bind:value={formData.facultyNumber} 
                        class="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-all {errors.facultyNumber ? 'border-red-500 focus:ring-red-500' : ''}" 
                        placeholder="Enter faculty number"
                        required
                      >
                      <div class="absolute left-4 top-1/2 transform -translate-y-1/2">
                        <svg class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    </div>
                    {#if errors.facultyNumber}<p class="text-sm text-red-600 mt-1 flex items-center"><svg class="h-4 w-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>{errors.facultyNumber}</p>{/if}
                  </div>
                </div>
              </div>
            {/if}
          </div>

          <!-- Footer -->
          <div class="px-8 py-6 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row-reverse gap-4">
            <button 
              type="submit" 
              class="flex-1 sm:flex-initial min-w-[140px] inline-flex justify-center items-center rounded-xl border border-transparent shadow-lg px-6 py-3 bg-slate-700 text-base font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
              disabled={isLoading}
            >
              {#if isLoading}
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Member...
              {:else}
                <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Member
              {/if}
            </button>
            <button 
              type="button" 
              on:click={closeModal} 
              disabled={isLoading} 
              class="flex-1 sm:flex-initial min-w-[120px] inline-flex justify-center items-center rounded-xl border border-slate-300 shadow-sm px-6 py-3 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}