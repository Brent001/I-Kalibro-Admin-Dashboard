<script lang="ts">
  export let open = false;
  export let transaction: {
    id: number;
    bookTitle?: string;
    memberName?: string;
    memberId?: string;
    bookId?: string;
  } | null = null;
  export let customDueDate: string = "";

  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  let password = "";
  let showPassword = false;
  let errorMessage = "";
  let isSubmitting = false;
  let showDateTimePicker = false;
  let selectedDate = "";
  let selectedTime = "";

  // Initialize date and time from customDueDate
  $: if (customDueDate) {
    const [date, time] = customDueDate.split('T');
    selectedDate = date;
    selectedTime = time || "12:00";
  }

  function close() {
    password = "";
    errorMessage = "";
    showPassword = false;
    isSubmitting = false;
    showDateTimePicker = false;
    dispatch("close");
  }

  function toggleDateTimePicker() {
    showDateTimePicker = !showDateTimePicker;
    if (showDateTimePicker && !selectedDate) {
      // Set default to 24 hours from now
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      selectedDate = tomorrow.toISOString().split('T')[0];
      selectedTime = "12:00";
    }
  }

  function applyDateTime() {
    if (selectedDate && selectedTime) {
      customDueDate = `${selectedDate}T${selectedTime}`;
      showDateTimePicker = false;
    }
  }

  function clearDateTime() {
    customDueDate = "";
    selectedDate = "";
    selectedTime = "";
    showDateTimePicker = false;
  }

  function formatDisplayDate(dateTimeString: string) {
    if (!dateTimeString) return "24 hours from now (default)";
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return "24 hours from now (default)";
    }
  }

  async function confirm() {
    errorMessage = "";
    if (!password.trim()) {
      errorMessage = "Password is required";
      return;
    }
    isSubmitting = true;
    try {
      const res = await fetch(`/api/transactions/${transaction?.id}/confirm-borrow`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: "password",
          password,
          dueDate: customDueDate
        }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        alert("Book borrowed successfully!");
        close();
        location.reload();
      } else {
        if (res.status === 401) {
          errorMessage = data.message || "Authentication failed. Please log in again.";
          if (data.message?.includes("log in")) {
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
          }
        } else {
          errorMessage = data.message || "Failed to confirm borrow.";
        }
        isSubmitting = false;
      }
    } catch (err: any) {
      errorMessage = "Network error. Please try again.";
      isSubmitting = false;
    }
  }
</script>

{#if open && transaction}
  <div class="fixed inset-0 flex items-center justify-center p-4 z-50"
       style="backdrop-filter: blur(8px); background: rgba(30, 41, 59, 0.15);">
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto hide-scrollbar">
      <div class="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 rounded-t-2xl">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <div class="p-2 bg-white bg-opacity-20 rounded-lg mr-3 flex items-center justify-center w-10 h-10">
              <!-- Blue book icon -->
              <svg class="h-7 w-7 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                <circle cx="12" cy="12" r="2"/>
              </svg>
            </div>
            <h3 class="text-xl font-bold text-white">Confirm Borrow</h3>
          </div>
          <button
            on:click={close}
            class="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
            aria-label="Close modal"
            disabled={isSubmitting}
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="px-6 py-5">
        <div class="bg-slate-50 rounded-xl p-4 mb-5">
          <div class="flex items-start mb-3">
            <div class="flex-shrink-0 h-12 w-12 flex items-center justify-center bg-blue-100 rounded-lg mr-3">
              <svg class="h-7 w-7 text-blue-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>
              </svg>
            </div>
            <div class="flex-1">
              <h4 class="font-semibold text-gray-900 mb-1">{transaction.bookTitle}</h4>
              <p class="text-sm text-gray-600">ID: {transaction.bookId}</p>
            </div>
          </div>
          <div class="pt-3 border-t border-slate-200">
            <div class="flex items-center text-sm">
              <div class="flex-shrink-0 h-8 w-8 flex items-center justify-center bg-blue-100 rounded-full mr-2">
                <span class="text-xs font-semibold text-blue-700">
                  {transaction.memberName?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p class="font-medium text-gray-900">{transaction.memberName}</p>
                <p class="text-xs text-gray-500">{transaction.memberId}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Custom Date & Time Selector -->
        <div class="mb-5">
          <label class="block text-sm font-semibold text-gray-700 mb-2">
            <svg class="inline h-4 w-4 mr-1 text-gray-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
            </svg>
            Due Date & Time
          </label>
          
          <button
            type="button"
            on:click={toggleDateTimePicker}
            class="w-full px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left flex items-center justify-between"
            disabled={isSubmitting}
          >
            <span class="text-sm {customDueDate ? 'text-gray-900 font-medium' : 'text-gray-500'}">
              <svg class="inline h-4 w-4 mr-2 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {formatDisplayDate(customDueDate)}
            </span>
            <svg class="h-5 w-5 text-gray-400 transition-transform {showDateTimePicker ? 'rotate-180' : ''}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          {#if showDateTimePicker}
            <div class="mt-3 p-4 bg-gradient-to-br from-slate-50 to-blue-50 border border-blue-200 rounded-lg space-y-4">
              <!-- Date Picker -->
              <div>
                <label for="date-picker" class="block text-xs font-semibold text-gray-700 mb-2">
                  <svg class="inline h-3.5 w-3.5 mr-1 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z"/>
                  </svg>
                  Select Date
                </label>
                <input
                  id="date-picker"
                  type="date"
                  bind:value={selectedDate}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <!-- Time Picker -->
              <div>
                <label for="time-picker" class="block text-xs font-semibold text-gray-700 mb-2">
                  <svg class="inline h-3.5 w-3.5 mr-1 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Select Time
                </label>
                <input
                  id="time-picker"
                  type="time"
                  bind:value={selectedTime}
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <!-- Action Buttons -->
              <div class="flex gap-2 pt-2">
                <button
                  type="button"
                  on:click={clearDateTime}
                  class="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
                >
                  <svg class="h-3.5 w-3.5 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                  Clear
                </button>
                <button
                  type="button"
                  on:click={applyDateTime}
                  class="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                  disabled={!selectedDate || !selectedTime}
                >
                  <svg class="h-3.5 w-3.5 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                  </svg>
                  Apply
                </button>
              </div>
            </div>
          {/if}
        </div>

        <!-- Password Input -->
        <div class="mb-5">
          <label for="password-input" class="block text-sm font-semibold text-gray-700 mb-2">
            <svg class="inline h-4 w-4 mr-1 text-gray-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
            </svg>
            Staff Password
          </label>
          <div class="relative">
            <input
              id="password-input"
              type={showPassword ? "text" : "password"}
              bind:value={password}
              placeholder="Enter your staff password"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
              disabled={isSubmitting}
              on:keydown={(e) => e.key === 'Enter' && confirm()}
            />
            <button
              type="button"
              on:click={() => showPassword = !showPassword}
              class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              disabled={isSubmitting}
            >
              {#if showPassword}
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
                </svg>
              {:else}
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              {/if}
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            <svg class="inline h-3 w-3 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>
            </svg>
            Enter your currently logged-in staff account password
          </p>
        </div>

        {#if errorMessage}
          <div class="mt-4 bg-red-50 border-l-4 border-red-500 p-3 rounded flex items-start gap-2">
            <svg class="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
            <span class="text-xs sm:text-sm text-red-800 font-medium">
              {errorMessage}
            </span>
          </div>
        {/if}

        <div class="flex gap-3 mt-6">
          <button
            on:click={close}
            class="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors flex items-center justify-center"
            disabled={isSubmitting}
          >
            <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            Cancel
          </button>
          <button
            on:click={confirm}
            class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm flex items-center justify-center"
            disabled={!password.trim() || isSubmitting}
          >
            {#if isSubmitting}
              <svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            {:else}
              <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
              </svg>
              Confirm Borrow
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Hide scrollbar for modal content */
  .hide-scrollbar {
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
  }
  .hide-scrollbar::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
  }
</style>