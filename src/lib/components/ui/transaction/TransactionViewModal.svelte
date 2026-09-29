<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let open: boolean = false;
  export let transaction: {
    id: number;
    itemTitle?: string;
    callNumber?: string;
    itemId?: number | string;
    userName?: string;
    userId?: number | string;
    userIdentifier?: string;
    itemType?: string;
    type?: string;
    status?: string;
    borrowDate?: string;
    dueDate?: string;
    returnDate?: string;
    [key: string]: any;
  } | null = null;

  export let finePerDay: number = 5.0;

  const dispatch = createEventDispatcher();

  let fineAmount = 0;
  let overdueDays = 0;
  let overdueHours = 0;

  function calculateFine() {
    if (!transaction) return;
    fineAmount = 0;
    overdueDays = 0;
    // Prefer server-provided values
    if ((transaction as any).fine !== undefined) {
      fineAmount = Number((transaction as any).fine) || 0;
      overdueDays = Number((transaction as any).daysOverdue) || 0;
      // fineAmount is in pesos; convert to hours (5 pesos / hour)
      overdueHours = Number((transaction as any).hoursOverdue) || Math.ceil(fineAmount / 5);
      return;
    }
    if (transaction.type?.toLowerCase() === 'borrow' && transaction.dueDate) {
      const due = new Date(transaction.dueDate);
      const now = new Date();
      if (now > due) {
        const diffMs = now.getTime() - due.getTime();
        const hours = Math.ceil(diffMs / (1000 * 60 * 60));
        overdueHours = hours;
        overdueDays = Math.floor(hours / 24);
        fineAmount = hours * finePerDay;
      }
    }
  }

  function formatDate(dateString: string | undefined) {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  }

  function formatFineCentavos(cents: number) {
    // `transaction.fine` and DB store fine as pesos (decimal). Format directly.
    return `₱${Number(cents || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatFine(amount: number) {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function getStatusColor(status: string) {
    const s = status?.toLowerCase() || '';
    switch (s) {
      case 'borrowed':  return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'returned':  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'overdue':   return 'bg-red-100 text-red-800 border-red-200';
      case 'active':    return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'fulfilled': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
      default:          return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function getStatusDot(status: string) {
    const s = status?.toLowerCase() || '';
    switch (s) {
      case 'borrowed':  return 'bg-blue-500';
      case 'returned':  return 'bg-emerald-500';
      case 'overdue':   return 'bg-red-500';
      case 'active':    return 'bg-amber-500';
      case 'fulfilled': return 'bg-green-500';
      case 'cancelled': return 'bg-gray-400';
      default:          return 'bg-gray-400';
    }
  }

  function getTypeColor(type: string) {
    const t = type?.toLowerCase() || '';
    switch (t) {
      case 'borrow':  return 'bg-[#0D5C29]/10 text-[#0D5C29] border-[#0D5C29]/20';
      case 'return':  return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'reserve': return 'bg-amber-100 text-amber-800 border-amber-200';
      default:        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function close() {
    dispatch('close');
  }

  $: if (transaction) calculateFine();

  $: daysLeft = (() => {
    if (!transaction?.dueDate || transaction.returnDate) return null;
    const today = new Date();
    const due = new Date(transaction.dueDate);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  })();

  $: isOverdue = overdueDays > 0 || overdueHours > 0 || (daysLeft !== null && daysLeft < 0);
  $: fineDisplay = (transaction as any)?.fine !== undefined
    ? formatFineCentavos(Number((transaction as any).fine) || 0)
    : formatFine(fineAmount);
</script>

{#if open && transaction}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <button
      class="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-default"
      onclick={close}
      aria-label="Close modal"
      type="button"
    ></button>

    <div class="relative w-full max-w-lg transform transition-all duration-300 scale-100">
      <div class="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-[#4A7C59]/30 overflow-hidden flex flex-col max-h-[90vh]">

        <!-- ── Header ── -->
        <div class="px-6 py-4 border-b border-[#4A7C59]/20 bg-white/80 flex-shrink-0">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="flex items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br from-[#0D5C29] to-[#4A7C59] shadow-lg flex-shrink-0">
                <svg class="h-5 w-5 sm:h-6 sm:w-6 text-white" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
                </svg>
              </div>
              <div class="min-w-0">
                <h3 class="text-lg sm:text-xl font-bold text-[#0D5C29] truncate">Transaction Details</h3>
                <p class="text-xs sm:text-sm text-[#4A7C59] font-mono">#{transaction.id.toString().padStart(6, '0')}</p>
              </div>
            </div>
            <button
              type="button" onclick={close}
              aria-label="Close modal"
              class="p-2 rounded-lg text-gray-400 hover:text-[#0D5C29] hover:bg-[#0D5C29]/10 transition-colors duration-200 flex-shrink-0"
            >
              <svg class="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- ── Body ── -->
        <div class="px-6 py-6 overflow-y-auto flex-1 min-h-0 custom-scrollbar space-y-5">

          <!-- Status row -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full flex-shrink-0 {getStatusDot(transaction.status ?? '')}"></span>
              <span class={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(transaction.status ?? '')}`}>
                {transaction.status?.charAt(0).toUpperCase()}{transaction.status?.slice(1) ?? ''}
              </span>
            </div>
            <span class={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getTypeColor(transaction.type ?? '')}`}>
              {transaction.type?.charAt(0).toUpperCase()}{transaction.type?.slice(1) ?? '—'}
            </span>
          </div>

          <!-- Item card -->
          <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4">
            <p class="text-[11px] font-semibold text-[#4A7C59] uppercase tracking-widest mb-3">Item</p>
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-xl bg-[#0D5C29]/10 flex items-center justify-center flex-shrink-0">
                <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/>
                </svg>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-gray-900 truncate">{transaction.itemTitle ?? '—'}</p>
                <div class="flex flex-col gap-0.5 mt-1">
                  <span class="text-[11px] text-gray-400 font-mono">#{transaction.itemId ?? '—'}</span>
                  {#if transaction.callNumber && (transaction.type === 'borrow' || transaction.type === 'return' || transaction.status === 'returned' || transaction.status === 'fulfilled')}
                    <span class="text-[11px] text-gray-500 font-mono">Call No: {transaction.callNumber}</span>
                  {/if}
                  {#if transaction.itemType}
                    <span class="text-[11px] text-gray-400 capitalize">{transaction.itemType}</span>
                  {/if}
                </div>
              </div>
            </div>
          </div>

          <!-- Member card -->
          <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4">
            <p class="text-[11px] font-semibold text-[#4A7C59] uppercase tracking-widest mb-3">Member</p>
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-full bg-gradient-to-br from-[#0D5C29] to-[#4A7C59] flex items-center justify-center flex-shrink-0 shadow-sm">
                <span class="text-sm font-bold text-white">
                  {transaction.userName?.charAt(0).toUpperCase() ?? 'U'}
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-gray-900 truncate">{transaction.userName ?? '—'}</p>
                <p class="text-[11px] text-gray-400 font-mono mt-0.5">
                  {transaction.userIdentifier ?? `ID ${transaction.userId ?? '—'}`}
                </p>
              </div>
            </div>
          </div>

          <!-- Timeline -->
          <div class="bg-[#f8faf9] border border-[#4A7C59]/20 rounded-xl p-4">
            <p class="text-[11px] font-semibold text-[#4A7C59] uppercase tracking-widest mb-3">Timeline</p>
            <div class="space-y-3">
              <!-- Borrow date -->
              <div class="flex items-center gap-3">
                <div class="h-1.5 w-1.5 rounded-full bg-[#4A7C59] flex-shrink-0 ml-0.5"></div>
                <div class="flex items-baseline gap-2 flex-1">
                  <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-16 flex-shrink-0">Start</span>
                  <span class="text-xs font-medium text-gray-700">{formatDate(transaction.borrowDate)}</span>
                </div>
              </div>
              <!-- Due date -->
              {#if transaction.dueDate}
                <div class="flex items-center gap-3">
                  <div class="h-1.5 w-1.5 rounded-full flex-shrink-0 ml-0.5 {isOverdue ? 'bg-red-400' : 'bg-amber-400'}"></div>
                  <div class="flex items-center gap-2 flex-1 flex-wrap">
                    <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-16 flex-shrink-0">Due</span>
                    <span class="text-xs font-medium {isOverdue ? 'text-red-600' : 'text-gray-700'}">{formatDate(transaction.dueDate)}</span>
                    {#if daysLeft !== null && !transaction.returnDate}
                      <span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border
                        {daysLeft < 0
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : daysLeft === 0
                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : daysLeft <= 3
                              ? 'bg-amber-100 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'}">
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
                      </span>
                    {/if}
                  </div>
                </div>
              {/if}
              <!-- Return date -->
              {#if transaction.returnDate}
                <div class="flex items-center gap-3">
                  <div class="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0 ml-0.5"></div>
                  <div class="flex items-baseline gap-2 flex-1">
                    <span class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-16 flex-shrink-0">Returned</span>
                    <span class="text-xs font-semibold text-emerald-600">{formatDate(transaction.returnDate)}</span>
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <!-- Overdue fine alert -->
          {#if isOverdue || (transaction as any).fine > 0}
            <div class="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <div class="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg class="h-4 w-4 text-red-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-red-800 uppercase tracking-wide mb-2">Overdue Fine</p>
                <div class="space-y-1">
                  {#if overdueDays > 0}
                    <div class="flex items-baseline justify-between text-xs">
                      <span class="text-red-700">Overdue by</span>
                      <span class="font-semibold text-red-800">{overdueDays} {overdueDays === 1 ? 'day' : 'days'}</span>
                    </div>
                  {/if}
                  <div class="flex items-baseline justify-between text-sm pt-1 border-t border-red-200 mt-1">
                    <span class="font-bold text-red-900">Total Fine</span>
                    <span class="font-bold text-red-700">{fineDisplay}</span>
                  </div>
                </div>
              </div>
            </div>
          {/if}

        </div>

        <!-- ── Footer ── -->
        <div class="px-6 py-4 border-t border-[#4A7C59]/20 bg-white/80 flex-shrink-0">
          <button
            type="button" onclick={close}
            class="w-full px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#0D5C29] to-[#4A7C59] text-sm font-semibold text-white hover:from-[#0A4520] hover:to-[#3D664A] shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Close
          </button>
        </div>

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