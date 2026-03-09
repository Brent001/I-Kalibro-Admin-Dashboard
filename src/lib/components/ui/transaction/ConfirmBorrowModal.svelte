<script lang="ts">
  export let open = false;
  export let user: { id?: number; username?: string; role?: string; email?: string } | null = null;
  export let transaction: {
    id: number;
    bookTitle?: string;
    memberName?: string;
    memberId?: string | number;
    bookId?: string | number;
    itemTitle?: string;
    title?: string;
    name?: string;
    itemId?: string | number;
    item_id?: string | number;
    userName?: string;
    member?: string;
    user?: string;
    userId?: string | number;
    user_id?: string | number;
    [key: string]: any;
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

  $: isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
  $: displayTitle = transaction?.bookTitle ?? transaction?.itemTitle ?? transaction?.title ?? transaction?.name ?? '';
  $: displayBookId = transaction?.bookId ?? transaction?.itemId ?? transaction?.item_id ?? transaction?.id ?? '';
  $: displayMemberName = transaction?.memberName ?? transaction?.userName ?? transaction?.member ?? transaction?.user ?? '';
  $: displayMemberId = transaction?.memberId ?? transaction?.userId ?? transaction?.member_id ?? transaction?.user_id ?? '';

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
      return new Date(dateTimeString).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
      });
    } catch {
      return "24 hours from now (default)";
    }
  }

  async function confirm() {
    errorMessage = "";
    const adminUser = user && (user.role === 'admin' || user.role === 'super_admin');
    if (!adminUser && !password.trim()) {
      errorMessage = "Password is required";
      return;
    }
    isSubmitting = true;
    try {
      const payload: any = { dueDate: customDueDate };
      if (adminUser) {
        payload.method = 'admin';
        payload.admin = { username: user?.username || null };
      } else {
        payload.method = 'password';
        payload.password = password;
      }
      const res = await fetch(`/api/transactions/${transaction?.id}/confirm-borrow`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
          if (data.message?.includes("log in")) setTimeout(() => { window.location.href = '/'; }, 2000);
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
  <div
    class="fixed inset-0 flex items-center justify-center p-4 z-50"
    style="backdrop-filter: blur(8px); background: rgba(15, 23, 42, 0.4);"
    on:click|self={close}
    role="dialog"
    aria-modal="true"
    aria-label="Confirm borrow"
  >
    <div class="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md max-h-[92vh] overflow-y-auto scrollbar-hide">

      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
        <div class="flex items-center gap-3">
          <div class="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <svg class="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </div>
          <div>
            <h3 class="text-base font-bold text-gray-900">Confirm Borrow</h3>
            <p class="text-xs text-gray-400 mt-0.5">Transaction #{transaction.id.toString().padStart(6, '0')}</p>
          </div>
        </div>
        <button
          on:click={close}
          class="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-150"
          aria-label="Close"
          disabled={isSubmitting}
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="px-6 py-5 space-y-5">

        <!-- Item + Member row -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Item card -->
          <div class="bg-gray-50 rounded-xl border border-gray-100 p-4">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Item</p>
            <div class="flex items-start gap-3">
              <div class="h-9 w-9 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
                <svg class="h-4.5 w-4.5 text-slate-500" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-gray-900 truncate leading-snug">{displayTitle || '—'}</p>
                <p class="text-[11px] text-gray-400 font-mono mt-0.5">#{displayBookId || '—'}</p>
              </div>
            </div>
          </div>

          <!-- Member card -->
          <div class="bg-gray-50 rounded-xl border border-gray-100 p-4">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2.5">Member</p>
            <div class="flex items-start gap-3">
              <div class="h-9 w-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span class="text-sm font-bold text-white">
                  {displayMemberName?.charAt(0).toUpperCase() ?? 'U'}
                </span>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-gray-900 truncate leading-snug">{displayMemberName || '—'}</p>
                <p class="text-[11px] text-gray-400 font-mono mt-0.5">{displayMemberId ? `ID ${displayMemberId}` : '—'}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Due Date picker -->
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Due Date</p>
          <button
            type="button"
            on:click={toggleDateTimePicker}
            disabled={isSubmitting}
            class="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-gray-50 hover:bg-white hover:border-slate-300 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <svg class="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
              </svg>
              <span class="truncate {customDueDate ? 'text-gray-900' : 'text-gray-400'}">
                {formatDisplayDate(customDueDate)}
              </span>
            </div>
            <svg class="h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-200 {showDateTimePicker ? 'rotate-180' : ''}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          {#if showDateTimePicker}
            <div class="mt-2 p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="date-picker" class="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Date</label>
                  <input
                    id="date-picker"
                    type="date"
                    bind:value={selectedDate}
                    class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none"
                  />
                </div>
                <div>
                  <label for="time-picker" class="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Time</label>
                  <input
                    id="time-picker"
                    type="time"
                    bind:value={selectedTime}
                    class="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none"
                  />
                </div>
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  on:click={clearDateTime}
                  class="flex-1 px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-white transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  on:click={applyDateTime}
                  disabled={!selectedDate || !selectedTime}
                  class="flex-1 px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          {/if}
        </div>

        <!-- Password (staff only) -->
        {#if !isAdmin}
          <div>
            <label for="password-input" class="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Staff Password</label>
            <div class="relative">
              <input
                id="password-input"
                type={showPassword ? "text" : "password"}
                bind:value={password}
                placeholder="Enter your staff password"
                class="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none pr-11 transition-all duration-150 disabled:opacity-50"
                disabled={isSubmitting}
                on:keydown={(e) => e.key === 'Enter' && confirm()}
              />
              <button
                type="button"
                on:click={() => showPassword = !showPassword}
                class="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                disabled={isSubmitting}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {#if showPassword}
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
                  </svg>
                {:else}
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                {/if}
              </button>
            </div>
            <p class="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
              <svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>
              </svg>
              Enter your currently logged-in staff account password
            </p>
          </div>
        {:else}
          <div class="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <svg class="h-4 w-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
            </svg>
            <p class="text-xs font-medium text-blue-700">Confirming as admin — no password required</p>
          </div>
        {/if}

        <!-- Error -->
        {#if errorMessage}
          <div class="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <svg class="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
            </svg>
            <p class="text-xs font-medium text-red-800">{errorMessage}</p>
          </div>
        {/if}

      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl flex gap-3">
        <button
          on:click={close}
          disabled={isSubmitting}
          class="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-white hover:border-gray-300 transition-all duration-150 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          on:click={confirm}
          disabled={(!isAdmin && !password.trim()) || isSubmitting}
          class="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 active:scale-95 transition-all duration-150 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
        >
          {#if isSubmitting}
            <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          {:else}
            <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
            </svg>
            Confirm Borrow
          {/if}
        </button>
      </div>

    </div>
  </div>
{/if}

<style>
  .scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
</style>