<script lang="ts">
  import Layout from "$lib/components/ui/layout.svelte";

  const recentActivity = [
    { id: 1, action: "Book borrowed", book: "Introduction to Computer Science", member: "John Doe", time: "2 hours ago" },
    { id: 2, action: "Book returned", book: "Calculus and Analytic Geometry", member: "Jane Smith", time: "3 hours ago" },
    { id: 3, action: "New member registered", book: "", member: "Michael Johnson", time: "5 hours ago" },
    { id: 4, action: "Book reserved", book: "Physics Principles", member: "Sarah Wilson", time: "1 day ago" },
  ];

  const overdueBooks = [
    { id: 1, book: "Advanced Mathematics", member: "Tom Brown", dueDate: "2024-01-10", daysOverdue: 5 },
    { id: 2, book: "Chemistry Fundamentals", member: "Lisa Garcia", dueDate: "2024-01-12", daysOverdue: 3 },
    { id: 3, book: "World History", member: "David Lee", dueDate: "2024-01-13", daysOverdue: 2 },
  ];
</script>

<Layout>
  <div class="space-y-4 sm:space-y-6">
    <!-- Stats Cards - Mobile First Grid -->
    <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
      <div class="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div class="flex-1">
            <p class="text-xs sm:text-sm font-medium text-gray-600 mb-1">Total Books</p>
            <p class="text-xl sm:text-3xl font-bold text-gray-900 mb-1">12,847</p>
            <p class="text-xs sm:text-sm text-slate-600">+125 this month</p>
          </div>
          <div class="hidden sm:block p-3 bg-slate-50 rounded-lg mt-2 sm:mt-0">
            <svg class="h-6 w-6 sm:h-8 sm:w-8 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V6.5A2.5 2.5 0 016.5 4H20v13M4 19.5V21h16"></path>
            </svg>
          </div>
        </div>
      </div>
      
      <div class="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div class="flex-1">
            <p class="text-xs sm:text-sm font-medium text-gray-600 mb-1">Active Members</p>
            <p class="text-xl sm:text-3xl font-bold text-gray-900 mb-1">2,456</p>
            <p class="text-xs sm:text-sm text-slate-600">+48 this month</p>
          </div>
          <div class="hidden sm:block p-3 bg-slate-50 rounded-lg mt-2 sm:mt-0">
            <svg class="h-6 w-6 sm:h-8 sm:w-8 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/>
            </svg>
          </div>
        </div>
      </div>
      
      <div class="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div class="flex-1">
            <p class="text-xs sm:text-sm font-medium text-gray-600 mb-1">Books Borrowed</p>
            <p class="text-xl sm:text-3xl font-bold text-gray-900 mb-1">1,247</p>
            <p class="text-xs sm:text-sm text-slate-600">This month</p>
          </div>
          <div class="hidden sm:block p-3 bg-slate-50 rounded-lg mt-2 sm:mt-0">
            <svg class="h-6 w-6 sm:h-8 sm:w-8 text-slate-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/>
            </svg>
          </div>
        </div>
      </div>
      
      <div class="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div class="flex-1">
            <p class="text-xs sm:text-sm font-medium text-gray-600 mb-1">Overdue Books</p>
            <p class="text-xl sm:text-3xl font-bold text-red-600 mb-1">23</p>
            <p class="text-xs sm:text-sm text-red-600">Needs attention</p>
          </div>
          <div class="hidden sm:block p-3 bg-red-50 rounded-lg mt-2 sm:mt-0">
            <svg class="h-6 w-6 sm:h-8 sm:w-8 text-red-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Activity and Overdue Books - Stack on Mobile -->
    <div class="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6">
      <!-- Recent Activity -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 class="text-base sm:text-lg font-semibold text-gray-900">Recent Activity</h3>
          <svg class="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
          </svg>
        </div>
        <div class="divide-y divide-gray-100">
          {#each recentActivity as activity}
            <div class="p-3 sm:p-4 hover:bg-gray-50 transition-colors duration-150">
              <div class="flex items-start space-x-3">
                <div class="w-2 h-2 bg-slate-900 rounded-full mt-2 flex-shrink-0"></div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 truncate sm:whitespace-normal">{activity.action}</p>
                  {#if activity.book}
                    <p class="text-xs sm:text-sm text-gray-600 mt-1 truncate sm:whitespace-normal">{activity.book}</p>
                  {/if}
                  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-2 space-y-1 sm:space-y-0">
                    <span class="text-xs sm:text-sm text-slate-700 font-medium truncate">{activity.member}</span>
                    <span class="text-xs text-gray-500 flex-shrink-0">{activity.time}</span>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Overdue Books -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 class="text-base sm:text-lg font-semibold text-gray-900">Overdue Books</h3>
          <svg class="h-4 w-4 sm:h-5 sm:w-5 text-red-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
          </svg>
        </div>
        <div class="divide-y divide-gray-100">
          {#each overdueBooks as book}
            <div class="p-3 sm:p-4 hover:bg-gray-50 transition-colors duration-150">
              <div class="flex items-start space-x-3">
                <div class="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 truncate sm:whitespace-normal">{book.book}</p>
                  <p class="text-xs sm:text-sm text-gray-600 mt-1 truncate">{book.member}</p>
                  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-2 space-y-2 sm:space-y-0">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 w-fit">
                      {book.daysOverdue} days overdue
                    </span>
                    <span class="text-xs text-gray-500 flex-shrink-0">Due: {book.dueDate}</span>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</Layout>