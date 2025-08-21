<script lang="ts">
  import Layout from "$lib/components/ui/layout.svelte";
  import { onMount } from "svelte";
  import { writable, derived } from "svelte/store";

  // State
  let searchTerm = "";
  let selectedType = "all";

  const members = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@student.mdc.edu.ph',
      phone: '+63 912 345 6789',
      type: 'Student',
      studentId: 'MDC-2024-001',
      course: 'Computer Science',
      year: '3rd Year',
      status: 'Active',
      joined: '2023-08-15',
      booksCount: 3
    },
    {
      id: 2,
      name: 'Dr. Sarah Johnson',
      email: 'sarah.johnson@faculty.mdc.edu.ph',
      phone: '+63 917 234 5678',
      type: 'Faculty',
      employeeId: 'MDC-FAC-045',
      department: 'Mathematics',
      position: 'Professor',
      status: 'Active',
      joined: '2020-06-10',
      booksCount: 8
    },
    {
      id: 3,
      name: 'Jane Smith',
      email: 'jane.smith@student.mdc.edu.ph',
      phone: '+63 905 123 4567',
      type: 'Student',
      studentId: 'MDC-2024-156',
      course: 'Engineering',
      year: '2nd Year',
      status: 'Suspended',
      joined: '2023-09-01',
      booksCount: 1
    },
    {
      id: 4,
      name: 'Michael Brown',
      email: 'michael.brown@staff.mdc.edu.ph',
      phone: '+63 918 765 4321',
      type: 'Staff',
      employeeId: 'MDC-STF-023',
      department: 'Administration',
      position: 'Librarian',
      status: 'Active',
      joined: '2021-03-15',
      booksCount: 5
    },
    {
      id: 5,
      name: 'Emily Davis',
      email: 'emily.davis@student.mdc.edu.ph',
      phone: '+63 922 345 6789',
      type: 'Student',
      studentId: 'MDC-2024-298',
      course: 'Business Administration',
      year: '4th Year',
      status: 'Active',
      joined: '2023-08-20',
      booksCount: 2
    },
  ];

  const memberTypes = ['all', 'Student', 'Faculty', 'Staff'];

  $: filteredMembers = members.filter(member => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      member.name.toLowerCase().includes(search) ||
      member.email.toLowerCase().includes(search) ||
      (member.studentId && member.studentId.toLowerCase().includes(search)) ||
      (member.employeeId && member.employeeId.toLowerCase().includes(search));
    const matchesType = selectedType === 'all' || member.type === selectedType;
    return matchesSearch && matchesType;
  });

  function getStatusColor(status: string) {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Suspended':
        return 'bg-red-100 text-red-800';
      case 'Inactive':
        return 'bg-slate-100 text-slate-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  }

  function getTypeColor(type: string) {
    switch (type) {
      case 'Student':
        return 'bg-slate-100 text-slate-800';
      case 'Faculty':
        return 'bg-slate-200 text-slate-900';
      case 'Staff':
        return 'bg-slate-300 text-slate-900';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  }
</script>

<Layout>
  <div class="space-y-4 lg:space-y-6">
    <!-- Header -->
    <div class="flex flex-col space-y-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
      <div>
        <h2 class="text-xl lg:text-2xl font-bold text-gray-900">Member Management</h2>
        <p class="text-sm lg:text-base text-gray-600">Manage library members and their accounts</p>
      </div>
      <button class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200">
        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        Add New Member
      </button>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-slate-100 rounded-lg">
            <svg class="h-4 w-4 lg:h-6 lg:w-6 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          </div>
          <div class="ml-2 lg:ml-4">
            <p class="text-xs lg:text-sm font-medium text-gray-600">Total</p>
            <p class="text-lg lg:text-2xl font-semibold text-gray-900">{members.length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-green-50 rounded-lg">
            <svg class="h-4 w-4 lg:h-6 lg:w-6 text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="ml-2 lg:ml-4">
            <p class="text-xs lg:text-sm font-medium text-gray-600">Active</p>
            <p class="text-lg lg:text-2xl font-semibold text-gray-900">{members.filter(m => m.status === 'Active').length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-slate-50 rounded-lg">
            <svg class="h-4 w-4 lg:h-6 lg:w-6 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"/>
            </svg>
          </div>
          <div class="ml-2 lg:ml-4">
            <p class="text-xs lg:text-sm font-medium text-gray-600">Students</p>
            <p class="text-lg lg:text-2xl font-semibold text-gray-900">{members.filter(m => m.type === 'Student').length}</p>
          </div>
        </div>
      </div>
      <div class="bg-white p-3 lg:p-4 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-slate-50 rounded-lg">
            <svg class="h-4 w-4 lg:h-6 lg:w-6 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
          </div>
          <div class="ml-2 lg:ml-4">
            <p class="text-xs lg:text-sm font-medium text-gray-600">Faculty & Staff</p>
            <p class="text-lg lg:text-2xl font-semibold text-gray-900">{members.filter(m => m.type === 'Faculty' || m.type === 'Staff').length}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters and Search -->
    <div class="bg-white p-4 lg:p-6 rounded-lg shadow-sm border">
      <div class="flex flex-col space-y-3 lg:flex-row lg:space-y-0 lg:gap-4">
        <div class="flex-1">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              bind:value={searchTerm}
              class="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm lg:text-base"
            />
          </div>
        </div>
        <div>
          <select
            bind:value={selectedType}
            class="px-4 py-2 w-full lg:w-auto border border-gray-300 rounded-md focus:ring-2 focus:ring-slate-500 focus:border-slate-500 text-sm lg:text-base"
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

    <!-- Desktop Table View -->
    <div class="hidden lg:block bg-white shadow-sm border rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Member Details
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Type & ID
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Academic Info
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Books
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each filteredMembers as member}
              <tr class="hover:bg-slate-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div class="text-sm font-medium text-gray-900">{member.name}</div>
                    <div class="text-sm text-gray-500 flex items-center">
                      <svg class="h-3 w-3 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <rect width="20" height="14" x="2" y="5" rx="2"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M22 5 12 13 2 5"/>
                      </svg>
                      {member.email}
                    </div>
                    <div class="text-sm text-gray-500 flex items-center">
                      <svg class="h-3 w-3 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2A19.72 19.72 0 0 1 3.08 5.18 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.72c.13 1.05.37 2.07.72 3.05a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6.29 6.29l1.27-1.27a2 2 0 0 1 2.11-.45c.98.35 2 .59 3.05.72A2 2 0 0 1 22 16.92z"/>
                      </svg>
                      {member.phone}
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div>
                    <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(member.type)}`}>
                      {member.type}
                    </span>
                    <div class="text-sm text-gray-500 mt-1">
                      {member.studentId || member.employeeId}
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">
                    {#if member.course}
                      <div>{member.course}</div>
                      <div class="text-gray-500">{member.year}</div>
                    {/if}
                    {#if member.department}
                      <div>{member.department}</div>
                      <div class="text-gray-500">{member.position}</div>
                    {/if}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <svg class="h-4 w-4 mr-2 text-slate-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                    </svg>
                    <div>
                      <div class="text-sm font-medium text-gray-900">
                        {member.booksCount} books
                      </div>
                      <div class="text-sm text-gray-500">
                        Currently borrowed
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(member.status)}`}>
                    {member.status}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex space-x-2">
                    <button class="text-slate-600 hover:text-slate-900 transition-colors duration-200" title="View Details">
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                    </button>
                    <button class="text-slate-600 hover:text-slate-900 transition-colors duration-200" title="Edit Member">
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                      </svg>
                    </button>
                    <button class="text-red-600 hover:text-red-900 transition-colors duration-200" title="Remove Member">
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Mobile Card View -->
    <div class="lg:hidden space-y-3">
      {#each filteredMembers as member}
        <div class="bg-white rounded-lg shadow-sm border p-4">
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1">
              <h3 class="font-medium text-gray-900 text-sm">{member.name}</h3>
              <div class="flex items-center space-x-2 mt-1">
                <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(member.type)}`}>
                  {member.type}
                </span>
                <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(member.status)}`}>
                  {member.status}
                </span>
              </div>
            </div>
            <div class="flex space-x-1 ml-2">
              <button class="p-1 text-slate-600 hover:text-slate-900 transition-colors duration-200" title="View Details">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </button>
              <button class="p-1 text-slate-600 hover:text-slate-900 transition-colors duration-200" title="Edit Member">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button class="p-1 text-red-600 hover:text-red-900 transition-colors duration-200" title="Remove Member">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
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
                <path stroke-linecap="round" stroke-linejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2A19.72 19.72 0 0 1 3.08 5.18 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.72c.13 1.05.37 2.07.72 3.05a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6.29 6.29l1.27-1.27a2 2 0 0 1 2.11-.45c.98.35 2 .59 3.05.72A2 2 0 0 1 22 16.92z"/>
              </svg>
              <span>{member.phone}</span>
            </div>
            <div class="flex items-center">
              <svg class="h-3 w-3 mr-2 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
              </svg>
              <span>{member.studentId || member.employeeId}</span>
            </div>
          </div>

          <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <div class="text-xs text-gray-600">
              {#if member.course}
                <div class="font-medium">{member.course}</div>
                <div>{member.year}</div>
              {/if}
              {#if member.department}
                <div class="font-medium">{member.department}</div>
                <div>{member.position}</div>
              {/if}
            </div>
            <div class="flex items-center text-xs text-gray-600">
              <svg class="h-3 w-3 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
              <span class="font-medium">{member.booksCount} books</span>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    <div class="bg-white px-4 lg:px-6 py-3 border rounded-lg flex flex-col space-y-3 lg:space-y-0 lg:flex-row lg:items-center lg:justify-between">
      <div class="text-sm text-gray-700 text-center lg:text-left">
        Showing <span class="font-medium">1</span> to <span class="font-medium">{filteredMembers.length}</span> of
        <span class="font-medium">{filteredMembers.length}</span> results
      </div>
      <nav class="flex justify-center lg:justify-end">
        <div class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
          <button class="relative inline-flex items-center px-3 lg:px-4 py-2 border border-gray-300 text-sm font-medium rounded-l-md text-gray-500 bg-white hover:bg-slate-50 transition-colors duration-200">
            <svg class="h-4 w-4 lg:mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            <span class="hidden lg:inline">Previous</span>
          </button>
          <button class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors duration-200">
            1
          </button>
          <button class="relative inline-flex items-center px-3 lg:px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-500 bg-white hover:bg-slate-50 transition-colors duration-200">
            <span class="hidden lg:inline">Next</span>
            <svg class="h-4 w-4 lg:ml-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </nav>
    </div>
  </div>
</Layout>