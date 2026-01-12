<script lang="ts">
  import AddStaff from "$lib/components/ui/add_staff.svelte";
  import EditStaff from "$lib/components/ui/edit_staff.svelte";
  import { onMount } from "svelte";

  let searchTerm = "";
  let selectedRole = "all";
  let selectedStatus = "all";
  let isAddStaffOpen = false;
  let isEditStaffOpen = false;
  let isDeleteStaffOpen = false;
  let staff: any[] = [];
  let selectedStaff: any = null;
  let loading = false;
  let errorMsg = "";

  const roleTypes = ['all', 'admin', 'staff'];
  const statusTypes = ['all', 'active', 'inactive'];

  // Permissions list for both add/edit modals
  const permissionsList = [
    { key: 'view_books', label: 'Books' },
    { key: 'view_members', label: 'Members' },
    { key: 'view_transactions', label: 'Transactions' },
    { key: 'view_visits', label: 'Visits' },
    { key: 'view_logs', label: 'Logs' },
    { key: 'view_reports', label: 'Reports' },
    { key: 'view_staff', label: 'Staff' },
    { key: 'view_settings', label: 'Settings' }
  ];

  // Fetch staff from API
  async function fetchStaff() {
    loading = true;
    errorMsg = "";
    try {
      const res = await fetch('/api/staff');
      const data = await res.json();
      staff = data.data.staff.map((s: any) => ({
        ...s,
        tokenVersion: s.tokenVersion ?? 0,
        createdAt: s.joined ?? s.createdAt,
        updatedAt: s.updatedAt ?? s.createdAt
      }));
    } catch (err) {
      errorMsg = "Failed to load staff.";
      console.error(err);
    } finally {
      loading = false;
    }
  }

  onMount(fetchStaff);

  $: filteredStaff = staff.filter(member => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      member.name?.toLowerCase().includes(search) ||
      member.email?.toLowerCase().includes(search) ||
      member.username?.toLowerCase().includes(search);

    const matchesRole = selectedRole === 'all' || member.role === selectedRole;
    const matchesStatus = selectedStatus === 'all' ||
      (selectedStatus === 'active' && member.isActive) ||
      (selectedStatus === 'inactive' && !member.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  function getStatusColor(isActive: boolean) {
    return isActive
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  }

  function getRoleColor(role: string) {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'staff':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  }

  function formatDateTime(dateTimeString: string) {
    return new Date(dateTimeString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatDateTimeMobile(dateTimeString: string) {
    return new Date(dateTimeString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Add Staff Handler
  async function handleStaffAdded(event: CustomEvent) {
    loading = true;
    errorMsg = "";
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...event.detail.formData,
          permissionKeys: event.detail.permissionKeys
        })
      });
      const data = await res.json();
      if (data.success) {
        await fetchStaff();
        isAddStaffOpen = false;
      } else {
        errorMsg = data.message || 'Failed to add staff.';
      }
    } catch (err) {
      errorMsg = "Failed to add staff.";
      console.error(err);
    } finally {
      loading = false;
    }
  }

  // Edit Staff Handler
  async function handleEditStaff(staffMember: any) {
    selectedStaff = staffMember;
    isEditStaffOpen = true;
  }

  async function handleStaffUpdated(event: CustomEvent) {
    loading = true;
    errorMsg = "";
    try {
      const { id, username, password, permissionKeys, uniqueId } = event.detail;

      // 1. Update username/password if changed
      if (
        (username && selectedStaff.username !== username) ||
        (password && password.length >= 8)
      ) {
        const updateRes = await fetch('/api/staff', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, username, password })
        });

        if (!updateRes.ok) {
          const data = await updateRes.json();
          errorMsg = data.message || "Failed to update staff.";
          loading = false;
          return;
        }
      }

      // 2. Update permissions for staff role only
      if (
        uniqueId &&
        selectedStaff?.role === 'staff' &&
        Array.isArray(permissionKeys)
      ) {
        const permRes = await fetch(`/api/staff/${uniqueId}/edit_permission`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissionKeys })
        });

        if (!permRes.ok) {
          const data = await permRes.json();
          errorMsg = data.message || "Failed to update permissions.";
          loading = false;
          return;
        }
      }

      await fetchStaff();
      isEditStaffOpen = false;
      selectedStaff = null;
    } catch (err) {
      console.error('Error updating staff:', err);
      errorMsg = "Failed to update staff.";
    } finally {
      loading = false;
    }
  }

  // Delete Staff Handler
  async function handleDeleteStaff(staffMember: any) {
    selectedStaff = staffMember;
    isDeleteStaffOpen = true;
  }

  async function confirmDeleteStaff() {
    if (!selectedStaff) return;
    loading = true;
    errorMsg = "";
    try {
      const res = await fetch('/api/staff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedStaff.id })
      });
      
      if (res.ok) {
        await fetchStaff();
        isDeleteStaffOpen = false;
        selectedStaff = null;
      } else {
        const data = await res.json();
        errorMsg = data.message || "Failed to delete staff.";
      }
    } catch (err) {
      errorMsg = "Failed to delete staff.";
      console.error(err);
    } finally {
      loading = false;
    }
  }

  // Toggle Active/Inactive
  async function toggleStaffStatus(staffMember: any) {
    loading = true;
    errorMsg = "";
    try {
      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: staffMember.id, isActive: !staffMember.isActive })
      });
      
      if (res.ok) {
        await fetchStaff();
      } else {
        const data = await res.json();
        errorMsg = data.message || "Failed to update status.";
      }
    } catch (err) {
      errorMsg = "Failed to update status.";
      console.error(err);
    } finally {
      loading = false;
    }
  }
</script>

<div class={`space-y-6 transition-all duration-300 ${isAddStaffOpen || isEditStaffOpen ? 'filter blur-sm pointer-events-none select-none' : ''}`}>
    <!-- Error Message -->
    {#if errorMsg}
      <div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
        <span>{errorMsg}</span>
        <button on:click={() => errorMsg = ""} class="text-red-600 hover:text-red-800" aria-label="Close error message">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    {/if}

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">Staff Management</h2>
        <p class="text-slate-600">Manage library staff accounts and permissions</p>
      </div>
      <button
        class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200"
        on:click={() => isAddStaffOpen = true} 
      >
        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        Add New Staff
      </button>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-2 bg-slate-100 rounded-lg">
            <svg class="h-4 w-4 lg:h-6 lg:w-6 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          </div>
          <div class="ml-2 lg:ml-4">
            <p class="text-xs lg:text-sm font-medium text-gray-600">Total Staff</p>
            <p class="text-lg lg:text-2xl font-semibold text-gray-900">{staff.length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-2 bg-green-50 rounded-lg">
            <svg class="h-4 w-4 lg:h-6 lg:w-6 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="ml-2 lg:ml-4">
            <p class="text-xs lg:text-sm font-medium text-gray-600">Active Staff</p>
            <p class="text-lg lg:text-2xl font-semibold text-gray-900">{staff.filter(s => s.isActive).length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-2 bg-purple-50 rounded-lg">
            <svg class="h-4 w-4 lg:h-6 lg:w-6 text-purple-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <div class="ml-2 lg:ml-4">
            <p class="text-xs lg:text-sm font-medium text-gray-600">Administrators</p>
            <p class="text-lg lg:text-2xl font-semibold text-gray-900">{staff.filter(s => s.role === 'admin').length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-4 lg:p-6 rounded-xl shadow-sm border border-slate-200">
        <div class="flex items-center">
          <div class="p-2 bg-slate-50 rounded-lg">
            <svg class="h-4 w-4 lg:h-6 lg:w-6 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
          </div>
          <div class="ml-2 lg:ml-4">
            <p class="text-xs lg:text-sm font-medium text-gray-600">Library Staff</p>
            <p class="text-lg lg:text-2xl font-semibold text-gray-900">{staff.filter(s => s.role === 'staff').length}</p>
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
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, or username..."
              bind:value={searchTerm}
              class="pl-10 pr-4 py-3 w-full border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors duration-200"
            />
          </div>
        </div>
        <div class="flex flex-col sm:flex-row gap-2">
          <select
            bind:value={selectedRole}
            class="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-700 transition-colors duration-200"
          >
            {#each roleTypes as role}
              <option value={role}>
                {role === 'all' ? 'All Roles' : role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            {/each}
          </select>
          <select
            bind:value={selectedStatus}
            class="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500 bg-white text-slate-700 transition-colors duration-200"
          >
            {#each statusTypes as status}
              <option value={status}>
                {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            {/each}
          </select>
        </div>
      </div>
    </div>

    <!-- Skeleton Loading State -->
    {#if loading && staff.length === 0}
      <div class="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-6 py-4"></th>
                <th class="px-6 py-4"></th>
                <th class="px-6 py-4"></th>
                <th class="px-6 py-4"></th>
                <th class="px-6 py-4"></th>
                <th class="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {#each Array(6) as _, i}
                <tr>
                  {#each Array(6) as __}
                    <td class="px-6 py-4">
                      <div class="h-4 bg-slate-100 rounded w-full animate-pulse"></div>
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <!-- Desktop Table View -->
    {#if !loading || staff.length > 0}
    <div class="hidden lg:block bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Name & Email
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Username
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Role
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Created At
              </th>
              <th class="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-slate-100">
            {#each filteredStaff as member}
              <tr class="hover:bg-slate-50 transition-colors duration-200">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div class="text-sm font-semibold text-slate-900">{member.name}</div>
                    <div class="text-sm text-slate-600">{member.email}</div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-xs text-slate-700">@{member.username}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                    {member.role}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(member.isActive)}`}>
                    {member.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-xs text-slate-700">{formatDateTime(member.createdAt)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex space-x-3">
                    <button class="text-emerald-600 hover:text-emerald-700 transition-colors duration-200" title="Edit Staff" on:click={() => handleEditStaff(member)}>
                      Edit
                    </button>
                    <button class="text-red-600 hover:text-red-700 transition-colors duration-200" title="Delete Staff" on:click={() => handleDeleteStaff(member)}>
                      Remove
                    </button>
                    <button
                      class={member.isActive ? "text-yellow-600 hover:text-yellow-900" : "text-green-600 hover:text-green-900"}
                      title={member.isActive ? "Deactivate" : "Activate"}
                      on:click={() => toggleStaffStatus(member)}
                    >
                      {member.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
    {/if}

    <!-- Mobile Card View -->
    <div class="lg:hidden grid grid-cols-1 gap-4">
      {#each filteredStaff as member}
        <div class="bg-white rounded-lg shadow-sm border p-4">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
              <h3 class="font-medium text-gray-900 text-sm">{member.name}</h3>
              <div class="flex items-center space-x-2 mt-1">
                <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                  {member.role}
                </span>
                <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(member.isActive)}`}>
                  {member.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div class="flex space-x-1 ml-2">
              <button class="p-1 text-slate-600 hover:text-slate-900 transition-colors duration-200" title="Edit Staff" on:click={() => handleEditStaff(member)} aria-label="Edit staff member">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button class="p-1 text-red-600 hover:text-red-900 transition-colors duration-200" title="Delete Staff" on:click={() => handleDeleteStaff(member)} aria-label="Delete staff member">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div class="space-y-2 text-xs text-gray-600">
            <div class="flex items-center">
              <svg class="h-3 w-3 mr-2 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect width="20" height="14" x="2" y="5" rx="2"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M22 5 12 13 2 5"/>
              </svg>
              <span class="truncate">{member.email}</span>
            </div>
            <div class="flex items-center">
              <svg class="h-3 w-3 mr-2 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
              <span>@{member.username}</span>
            </div>
          </div>

          <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <div class="text-xs text-gray-600">
              <div class="font-medium">Joined {formatDateTimeMobile(member.createdAt)}</div>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    <div class="bg-white px-4 lg:px-6 py-4 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="text-sm text-slate-700 order-2 sm:order-1">
        Showing <span class="font-semibold">1</span> to <span class="font-semibold">{filteredStaff.length}</span> of
        <span class="font-semibold">{filteredStaff.length}</span> results
      </div>
      <nav class="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px order-1 sm:order-2">
        <button class="relative inline-flex items-center px-3 py-2 border border-slate-300 text-sm font-medium rounded-l-lg text-slate-500 bg-white hover:bg-slate-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
          <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          <span class="hidden sm:inline">Previous</span>
        </button>
        <button class="relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium text-slate-700 bg-slate-50" disabled>
          1
        </button>
        <button class="relative inline-flex items-center px-3 py-2 border border-slate-300 text-sm font-medium rounded-r-lg text-slate-500 bg-white hover:bg-slate-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
          <span class="hidden sm:inline">Next</span>
          <svg class="h-4 w-4 ml-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </nav>
    </div>
  </div>

  <!-- Add Staff Modal -->
  <AddStaff
    isOpen={isAddStaffOpen}
    on:close={() => isAddStaffOpen = false}
    on:staffAdded={handleStaffAdded}
    on:addStaff={handleStaffAdded}
  />

  <!-- Edit Staff Modal -->
  <EditStaff
    isOpen={isEditStaffOpen}
    staff={selectedStaff}
    permissionsList={permissionsList}
    on:close={() => { isEditStaffOpen = false; selectedStaff = null; }}
    on:editStaff={handleStaffUpdated}
  />

  <!-- Delete Confirmation Modal -->
  {#if isDeleteStaffOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-white rounded-xl shadow-xl p-8 max-w-md w-full mx-4">
        <div class="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
          <svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h3 class="text-lg font-bold text-center mb-2">Delete Staff Member</h3>
        <p class="text-gray-600 text-center mb-6">
          Are you sure you want to permanently delete <span class="font-semibold text-gray-900">{selectedStaff?.name}</span>? This action cannot be undone.
        </p>
        <div class="flex justify-end gap-3">
          <button 
            class="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors duration-200" 
            on:click={() => { isDeleteStaffOpen = false; selectedStaff = null; }}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed" 
            on:click={confirmDeleteStaff} 
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete Staff'}
          </button>
        </div>
      </div>
    </div>
  {/if}