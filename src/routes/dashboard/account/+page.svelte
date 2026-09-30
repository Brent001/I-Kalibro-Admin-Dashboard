<script lang="ts">
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';
  import LockKeyhole from 'lucide-svelte/icons/lock-keyhole';
  import ShieldCheck from 'lucide-svelte/icons/shield-check';

  let { data } = $props();

  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let showCurrentPassword = $state(false);
  let showNewPassword = $state(false);
  let showConfirmPassword = $state(false);
  let isSubmitting = $state(false);
  let message = $state('');
  let messageType = $state<'success' | 'error' | ''>('');

  const passwordFields = [
    { label: 'Current password', name: 'currentPassword', value: () => currentPassword, set: (value: string) => currentPassword = value, shown: () => showCurrentPassword, toggle: () => showCurrentPassword = !showCurrentPassword },
    { label: 'New password', name: 'newPassword', value: () => newPassword, set: (value: string) => newPassword = value, shown: () => showNewPassword, toggle: () => showNewPassword = !showNewPassword },
    { label: 'Confirm new password', name: 'confirmPassword', value: () => confirmPassword, set: (value: string) => confirmPassword = value, shown: () => showConfirmPassword, toggle: () => showConfirmPassword = !showConfirmPassword }
  ];

  async function submitPasswordChange() {
    message = '';
    messageType = '';
    isSubmitting = true;

    try {
      const response = await fetch('/api/settings/change_pass', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        messageType = 'error';
        message = result.message || 'Password could not be changed.';
        return;
      }

      messageType = 'success';
      message = result.message || 'Password changed successfully. You can stay signed in.';
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
    } catch {
      messageType = 'error';
      message = 'Network error. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Account | e-Kalibro</title>
</svelte:head>

<div class="min-h-full bg-[#4A7C59]/5 px-4 py-6 sm:px-6 lg:px-8">
  <div class="mx-auto max-w-4xl space-y-6">
    <header>
      <p class="text-sm font-semibold uppercase tracking-wide text-[#B8860B]">Account</p>
      <h2 class="mt-1 text-2xl font-bold text-[#0D5C29] sm:text-3xl">Your account</h2>
      <p class="mt-2 max-w-2xl text-sm text-gray-600">Manage your sign-in password and keep your library account secure.</p>
    </header>

    <section class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <div class="rounded-xl border border-[#B8860B]/30 bg-white p-5 shadow-sm sm:p-6">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-lg bg-[#0D5C29] text-[#E8B923]">
            <ShieldCheck class="h-6 w-6" />
          </div>
          <div>
            <h3 class="font-semibold text-[#0D5C29]">Account identity</h3>
            <p class="text-xs text-gray-500">Signed-in profile</p>
          </div>
        </div>
        <dl class="mt-6 space-y-4 text-sm">
          <div>
            <dt class="text-gray-500">Name</dt>
            <dd class="mt-1 font-medium text-gray-900">Signed-in user</dd>
          </div>
          <div>
            <dt class="text-gray-500">Username</dt>
            <dd class="mt-1 font-medium text-gray-900">Available in Settings</dd>
          </div>
          <div>
            <dt class="text-gray-500">Email</dt>
            <dd class="mt-1 break-words font-medium text-gray-900">Available in Settings</dd>
          </div>
          <div>
            <dt class="text-gray-500">Role</dt>
            <dd class="mt-1 font-medium text-gray-900">Available in Settings</dd>
          </div>
        </dl>
      </div>

      <div class="rounded-xl border border-[#B8860B]/30 bg-white p-5 shadow-sm sm:p-6">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-lg bg-[#E8B923]/20 text-[#0D5C29]">
            <LockKeyhole class="h-6 w-6" />
          </div>
          <div>
            <h3 class="font-semibold text-[#0D5C29]">Change password</h3>
            <p class="text-xs text-gray-500">Confirm your current password first</p>
          </div>
        </div>

        <form class="mt-6 space-y-4" on:submit|preventDefault={submitPasswordChange}>
          {#each passwordFields as field}
            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700" for={field.name}>{field.label}</label>
              <div class="relative">
                <input
                  id={field.name}
                  name={field.name}
                  type={field.shown() ? 'text' : 'password'}
                  value={field.value()}
                  on:input={(event) => field.set(event.currentTarget.value)}
                  autocomplete={field.name === 'currentPassword' ? 'current-password' : 'new-password'}
                  required
                  class="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-11 text-sm outline-none transition focus:border-[#0D5C29] focus:ring-2 focus:ring-[#0D5C29]/20"
                />
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-[#0D5C29]"
                  aria-label={field.shown() ? `Hide ${field.label.toLowerCase()}` : `Show ${field.label.toLowerCase()}`}
                  on:click={field.toggle}
                >
                  {#if field.shown()}<EyeOff class="h-4 w-4" />{:else}<Eye class="h-4 w-4" />{/if}
                </button>
              </div>
            </div>
          {/each}

          <p class="text-xs leading-5 text-gray-500">Use at least 8 characters with uppercase, lowercase, a number, and a special character.</p>

          {#if message}
            <div class={`rounded-lg border px-3 py-2.5 text-sm ${messageType === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`} role="status">
              {message}
            </div>
          {/if}

          <button
            type="submit"
            disabled={isSubmitting}
            class="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0D5C29] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#08401c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LockKeyhole class="h-4 w-4" />
            {isSubmitting ? 'Updating password...' : 'Update password'}
          </button>
        </form>
      </div>
    </section>
  </div>
</div>
