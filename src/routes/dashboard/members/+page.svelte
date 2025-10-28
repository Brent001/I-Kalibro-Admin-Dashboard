<script lang="ts">
  import Layout from "$lib/components/ui/layout.svelte";
  import AddMemberModal from "$lib/components/ui/add_member.svelte";
  import DeleteMember from "$lib/components/ui/delete_member.svelte";
  import EditMemberModal from "$lib/components/ui/edit_member_modal.svelte";
  import ViewMember from "$lib/components/ui/view_member.svelte";
  import { onMount } from 'svelte';

  // Get user from SSR data
  export let data: { user: { role: string } };
  $: userRole = data?.user?.role || '';

  let members: any[] = [];
  let loading = true;
  let errorMsg = "";
  let successMsg = "";

  let searchTerm = "";
  let selectedType = "all";
  const memberTypes = ['all', 'Student', 'Faculty'];

  // Modal states
  let showAddModal = false;
  let showEditModal = false;
  let showViewModal = false;
  let showDeleteModal = false;
  let selectedMember: any = null;

  // Form data for add/edit
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
    gender: ''
  };

  // Fetch members from API on mount
  onMount(async () => {
    await loadMembers();
  });

  async function loadMembers() {
    loading = true;
    errorMsg = "";
    try {
      const res = await fetch('/api/user');
      const data = await res.json();
      if (res.ok && data.success) {
        members = data.data.members;
      } else {
        errorMsg = data.message || "Failed to load members.";
      }
    } catch (err) {
      errorMsg = "Network error. Please try again.";
    } finally {
      loading = false;
    }
  }

  $: filteredMembers = members.filter(member => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      member.name?.toLowerCase().includes(search) ||
      member.email?.toLowerCase().includes(search) ||
      (member.enrollmentNo && member.enrollmentNo.toLowerCase().includes(search)) ||
      (member.department && member.department.toLowerCase().includes(search));
    const matchesType = selectedType === 'all' || member.type === selectedType;
    return matchesSearch && matchesType;
  });

  function getStatusColor(isActive: boolean) {
    return isActive
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  }

  function getTypeColor(type: string) {
    switch (type) {
      case 'Student':
        return 'bg-slate-100 text-slate-800';
      case 'Faculty':
        return 'bg-slate-200 text-slate-900';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  }

  // Add a helper for type icons:
  function getTypeIcon(type: string) {
    if (type === 'Student') {
      // Person icon
      return `<svg class="h-4 w-4 mr-1 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 20v-2a6 6 0 0112 0v2"/></svg>`;
    }
    if (type === 'Faculty') {
      // Briefcase icon
      return `<svg class="h-4 w-4 mr-1 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M16 3v4M8 3v4"/></svg>`;
    }
    // Default person icon
    return `<svg class="h-4 w-4 mr-1 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path stroke-linecap="round" stroke-linejoin="round" d="M6 20v-2a6 6 0 0112 0v2"/></svg>`;
  }

  function resetForm() {
    formData = {
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
      gender: ''
    };
  }

  function openAddModal() {
    resetForm();
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
  }

  async function handleMemberAdded(event) {
    const member = event.detail;
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(member)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await loadMembers();
        showAddModal = false;
        successMsg = "Member added successfully!";
        setTimeout(() => successMsg = "", 3000);
      } else {
        errorMsg = data.message || "Failed to add member.";
      }
    } catch (err) {
      errorMsg = "Network error. Please try again.";
    }
  }

  function openEditModal(member: any) {
    selectedMember = member;
    formData = {
      type: member.type,
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      age: member.age || '',
      enrollmentNo: member.enrollmentNo || '',
      course: member.course || '',
      year: member.year || '',
      department: member.department || '',
      designation: member.designation || '',
      facultyNumber: member.facultyNumber || '',
      username: member.username || '',
      password: '',
      gender: member.gender || ''
    };
    showEditModal = true;
  }

  async function openViewModal(memberId: number) {
    loading = true;
    try {
      const res = await fetch(`/api/user/${memberId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        selectedMember = data.data;
        showViewModal = true;
      } else {
        errorMsg = data.message || "Failed to load member details.";
      }
    } catch (err) {
      errorMsg = "Network error. Please try again.";
    } finally {
      loading = false;
    }
  }

  function openDeleteModal(member: any) {
    selectedMember = member;
    showDeleteModal = true;
  }

  async function handleSubmit() {
    try {
      const isEdit = showEditModal;
      const url = '/api/user';
      const method = isEdit ? 'PUT' : 'POST';
      
      const payload = {
        ...formData,
        age: formData.age ? parseInt(formData.age) : undefined,
        ...(isEdit && { id: selectedMember.id })
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        successMsg = data.message;
        showAddModal = false;
        showEditModal = false;
        await loadMembers();
        setTimeout(() => successMsg = "", 3000);
      } else {
        errorMsg = data.message || "Operation failed.";
      }
    } catch (err) {
      errorMsg = "Network error. Please try again.";
    }
  }

  // Fixed delete handler with better error handling
  async function handleDeleteConfirm(event) {
    loading = true;
    const permanent = event?.detail?.permanent || false;

    if (!selectedMember) {
      errorMsg = "No member selected for deletion.";
      loading = false;
      return;
    }

    try {
      const res = await fetch('/api/user', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: selectedMember.id,
          permanent
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        successMsg = data.message;
        showDeleteModal = false;
        selectedMember = null;
        await loadMembers();
        setTimeout(() => successMsg = "", 3000);
      } else {
        errorMsg = data.message || "Delete operation failed.";
      }
    } catch (err) {
      errorMsg = "Network error. Please try again.";
    } finally {
      loading = false;
    }
  }

  function closeModals() {
    showAddModal = false;
    showEditModal = false;
    showViewModal = false;
    showDeleteModal = false;
    selectedMember = null;
    errorMsg = "";
  }
</script>

<Layout>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Member Management</h2>
        <p class="text-slate-600">Manage library members and their accounts</p>
      </div>
      <!-- Header Add Button -->
      {#if userRole === 'admin'}
      <button
        on:click={openAddModal}
        class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200"
      >
        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        Add New Member
      </button>
      {/if}
    </div>

    <!-- Success/Error Messages -->
    {#if successMsg}
      <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
        <div class="flex justify-between items-start">
          <div>
            <p class="font-medium">Success:</p>
            <p class="text-sm">{successMsg}</p>
          </div>
          <button on:click={() => successMsg = ""} class="text-green-400 hover:text-green-600">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    {/if}
    {#if errorMsg}
      <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <div class="flex justify-between items-start">
          <div>
            <p class="font-medium">Error:</p>
            <p class="text-sm">{errorMsg}</p>
            <button 
              on:click={loadMembers} 
              class="mt-2 text-sm text-red-800 hover:text-red-900 underline"
            >
              Try again
            </button>
          </div>
          <button on:click={() => errorMsg = ""} class="text-red-400 hover:text-red-600">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    {/if}

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-slate-100 rounded-xl">
            <!-- Total: Group/People Icon -->
            <svg class="h-6 w-6 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Total</p>
            <p class="text-2xl font-bold text-slate-900">{members.length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-emerald-100 rounded-xl">
            <!-- Active: Check Circle Icon -->
            <svg class="h-6 w-6 text-emerald-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Active</p>
            <p class="text-2xl font-bold text-slate-900">{members.filter(m => m.isActive).length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-slate-100 rounded-xl">
            <!-- Students: Person Icon -->
            <svg class="h-6 w-6 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 20v-2a6 6 0 0112 0v2"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Students</p>
            <p class="text-2xl font-bold text-slate-900">{members.filter(m => m.type === 'Student').length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-3 bg-purple-100 rounded-xl">
            <!-- Faculty & Staff: Briefcase Icon -->
            <svg class="h-6 w-6 text-purple-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 3v4M8 3v4"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-slate-600">Faculty & Staff</p>
            <p class="text-2xl font-bold text-slate-900">{members.filter(m => m.type === 'Faculty' || m.type === 'Staff').length}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
      <div class="flex flex-col lg:flex-row gap-4">
        <div class="flex-1">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              bind:value={searchTerm}
              class="pl-10 pr-4 py-3 w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors duration-200"
              disabled={loading}
            />
            {#if loading}
              <div class="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div class="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-slate-600"></div>
              </div>
            {/if}
          </div>
        </div>
        <div>
          <select
            bind:value={selectedType}
            class="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-700 transition-colors duration-200"
            disabled={loading}
          >
            {#each memberTypes as type}
              <option value={type}>
                {type === 'all' ? 'All Types' : type}
              </option>
            {/each}
          </select>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    {#if loading && members.length === 0}
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div class="flex items-center justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-slate-600"></div>
          <span class="ml-3 text-slate-600">Loading members...</span>
        </div>
      </div>
    {/if}

    <!-- Stats Skeleton -->
    {#if loading && members.length === 0}
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
        {#each Array(4) as _, i}
          <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200 animate-pulse">
            <div class="flex items-center">
              <div class="p-3 bg-slate-200 rounded-xl w-12 h-12"></div>
              <div class="ml-4 flex-1">
                <div class="h-3 bg-slate-200 rounded w-20 mb-2"></div>
                <div class="h-6 bg-slate-200 rounded w-12"></div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Table Skeleton -->
    {#if loading && members.length === 0}
      <div class="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden hidden lg:block mb-6">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr>
                {#each Array(6) as _, i}
                  <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider"></th>
                {/each}
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-slate-100">
              {#each Array(8) as _, i}
                <tr class="animate-pulse">
                  {#each Array(6) as _, j}
                    <td class="px-6 py-4">
                      <div class="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                      <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <!-- Mobile Card Skeleton -->
    {#if loading && members.length === 0}
      <div class="grid grid-cols-1 gap-4 lg:hidden mb-6">
        {#each Array(5) as _, i}
          <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 animate-pulse">
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                <div class="h-3 bg-slate-200 rounded w-1/2"></div>
                <div class="h-3 bg-slate-200 rounded w-2/3"></div>
              </div>
              <div class="h-6 bg-slate-200 rounded-full w-16 ml-3"></div>
            </div>
            <div class="flex items-center justify-between mb-3">
              <div class="h-6 bg-slate-200 rounded-full w-20"></div>
              <div class="h-3 bg-slate-200 rounded w-24"></div>
            </div>
            <div class="mb-4">
              <div class="w-full bg-slate-200 rounded-full h-2"></div>
            </div>
            <div class="flex justify-end space-x-3">
              <div class="h-8 w-8 bg-slate-200 rounded-lg"></div>
              <div class="h-8 w-8 bg-slate-200 rounded-lg"></div>
              <div class="h-8 w-8 bg-slate-200 rounded-lg"></div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Desktop Table View -->
    {#if !loading || members.length > 0}
      <div class="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden hidden lg:block">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Member Details
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Type & ID
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Academic Info
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Books
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-slate-100">
              {#each filteredMembers as member}
                <tr class="hover:bg-slate-50 transition-colors duration-200">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div class="text-sm font-semibold text-slate-900">{member.username}</div>
                      <div class="text-sm text-slate-600">{member.email}</div>
                      <div class="text-xs text-slate-400">{member.phone}</div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(member.type)}`}>
                      {@html getTypeIcon(member.type)}
                      {member.type}
                    </span>
                    <div class="text-xs text-slate-400 mt-1">
                      {member.enrollmentNo || member.department || member.role || member.id}
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {#if member.type === 'Student'}
                      <div>{member.course}</div>
                      <div class="text-slate-500">{member.year}</div>
                    {:else if member.type === 'Faculty'}
                      <div>{member.department}</div>
                      <div class="text-slate-500">{member.designation}</div>
                    {:else if member.type === 'Staff'}
                      <div>{member.role}</div>
                    {/if}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-slate-900">
                        {member.booksCount} books
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(member.isActive)}`}>
                      {member.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-3">
                      <button on:click={() => openViewModal(member.id)} class="text-slate-600 hover:text-slate-900 transition-colors duration-200" title="View Details">
                        View
                      </button>
                      {#if userRole === 'admin'}
                        <button on:click={() => openEditModal(member)} class="text-emerald-600 hover:text-emerald-700 transition-colors duration-200" title="Edit Member">
                          Edit
                        </button>
                        <button on:click={() => openDeleteModal(member)} class="text-red-600 hover:text-red-700 transition-colors duration-200" title="Remove Member">
                          Remove
                        </button>
                      {/if}
                      <!-- Staff accounts only see "View" button, no edit/remove -->
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
          {#if filteredMembers.length === 0 && !loading}
            <div class="text-center py-8">
              <p class="text-slate-500">No members found matching your criteria.</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Mobile Card View -->
    {#if !loading || members.length > 0}
      <div class="grid grid-cols-1 gap-4 lg:hidden">
        {#each filteredMembers as member}
          <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <div class="flex items-start justify-between mb-3">
              <div class="flex-1 min-w-0">
                <h3 class="text-base font-semibold text-slate-900 truncate">{member.name}</h3>
                <div class="flex items-center space-x-2 mt-1">
                  <span class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getTypeColor(member.type)}`}>
                    {@html getTypeIcon(member.type)}
                    {member.type}
                  </span>
                  <span class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(member.isActive)}`}>
                    {member.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div class="flex items-center space-x-1 ml-2">
                <button on:click={() => openViewModal(member.id)} class="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors duration-200" title="View Details">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                </button>
                {#if userRole === 'admin'}
                  <button on:click={() => openEditModal(member)} class="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors duration-200" title="Edit Member">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 3.487a2.1 2.1 0 112.97 2.97L7.5 18.789l-4 1 1-4 12.362-12.302z"/>
                    </svg>
                  </button>
                  <button on:click={() => openDeleteModal(member)} class="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200" title="Remove Member">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                {/if}
              </div>
            </div>
            <div class="space-y-2 text-xs text-slate-600">
              <div class="flex items-center">
                <svg class="h-3 w-3 mr-2 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <rect width="20" height="14" x="2" y="5" rx="2"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M22 5 12 13 2 5"/>
                </svg>
                <span class="truncate">{member.email}</span>
              </div>
              <div class="flex items-center">
                <svg class="h-3 w-3 mr-2 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2A19.72 19.72 0 0 1 3.08 5.18 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.72c.13 1.05.37 2.07.72 3.05a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6.29 6.29l1.27-1.27a2 2 0 0 1 2.11-.45c.98.35 2 .59 3.05.72A2 2 0 0 1 22 16.92z"/>
                </svg>
                <span>{member.phone}</span>
              </div>
              <div class="flex items-center">
                <svg class="h-3 w-3 mr-2 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                </svg>
                <span>{member.enrollmentNo || member.department}</span>
              </div>
            </div>
            <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <div class="text-xs text-slate-600">
                {#if member.course}
                  <div class="font-medium">{member.course}</div>
                  <div>{member.year}</div>
                {/if}
                {#if member.department}
                  <div class="font-medium">{member.department}</div>
                  <div>{member.designation}</div>
                {/if}
              </div>
              <div class="flex items-center text-xs text-slate-600">
                <svg class="h-3 w-3 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
                <span class="font-medium">{member.booksCount} books</span>
              </div>
            </div>
          </div>
        {/each}
        {#if filteredMembers.length === 0 && !loading}
          <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
            <p class="text-slate-500">No members found matching your criteria.</p>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Pagination -->
    <div class="bg-white px-4 lg:px-6 py-4 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="text-sm text-slate-700 order-2 sm:order-1">
        Showing <span class="font-semibold">1</span> to <span class="font-semibold">{filteredMembers.length}</span> of
        <span class="font-semibold">{filteredMembers.length}</span> results
      </div>
      <nav class="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px order-1 sm:order-2">
        <button class="relative inline-flex items-center px-3 py-2 border border-slate-300 text-sm font-medium rounded-l-lg text-slate-500 bg-white hover:bg-slate-50 transition-colors duration-200">
          <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          <span class="hidden sm:inline">Previous</span>
        </button>
        <button class="relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium text-slate-700 bg-slate-50" disabled>
          1
        </button>
        <button class="relative inline-flex items-center px-3 py-2 border border-slate-300 text-sm font-medium rounded-r-lg text-slate-500 bg-white hover:bg-slate-50 transition-colors duration-200">
          <span class="hidden sm:inline">Next</span>
          <svg class="h-4 w-4 ml-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </nav>
    </div>

    <!-- Add/Edit/View/Delete Modals (unchanged) -->
    {#if showAddModal}
      <AddMemberModal
        isOpen={showAddModal}
        on:close={closeAddModal}
        on:memberAdded={handleMemberAdded}
      />
    {/if}
    {#if showEditModal}
      <EditMemberModal
        isOpen={showEditModal}
        member={selectedMember}
        isLoading={loading}
        on:close={closeModals}
        on:submit={async (e) => {
          loading = true;
          try {
            const payload = {
              ...e.detail,
              age: e.detail.age ? parseInt(e.detail.age) : undefined,
              id: selectedMember.id
            };
            const res = await fetch('/api/user', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok && data.success) {
              successMsg = data.message;
              showEditModal = false;
              await loadMembers();
              setTimeout(() => successMsg = "", 3000);
            } else {
              errorMsg = data.message || "Operation failed.";
            }
          } catch (err) {
            errorMsg = "Network error. Please try again.";
          } finally {
            loading = false;
          }
        }}
      />
    {/if}
    {#if showViewModal}
      <ViewMember
        isOpen={showViewModal}
        member={selectedMember}
        on:close={closeModals}
      />
    {/if}
    {#if showDeleteModal && selectedMember}
      <DeleteMember
        isOpen={showDeleteModal}
        member={selectedMember}
        isLoading={loading}
        on:close={closeModals}
        on:delete={handleDeleteConfirm}
      />
    {/if}
  </div>
</Layout>