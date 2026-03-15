<script lang="ts">
  import { goto } from '$app/navigation';
  export let data: { maskedEmail?: string; rememberMe?: boolean };

  let otp = '';
  let errorMsg = '';
  let infoMsg = '';
  let isSubmitting = false;
  let isResending = false;
  let maskedEmail = data?.maskedEmail || 'your registered email';
  let rememberMe = data?.rememberMe ?? false;

  function clearPending2FA() {
    document.cookie = 'twoFactorToken=; Path=/; max-age=0;';
    rememberMe = false;
  }


  async function submitOtp() {
    errorMsg = '';
    infoMsg = '';

    if (!otp) {
      errorMsg = 'Please enter the OTP code.';
      return;
    }

    isSubmitting = true;
    try {
      const res = await fetch('/api/login/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp, rememberMe })
      });
      const result = await res.json();

      if (result.success) {
        await clearPending2FA();
        await goto('/dashboard');
      } else {
        errorMsg = result.message || 'Invalid OTP. Please try again.';
      }
    } catch (err) {
      errorMsg = 'Network error. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }

  async function resendOtp() {
    errorMsg = '';
    infoMsg = '';

    isResending = true;
    try {
      const res = await fetch('/api/login/resend-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ })
      });
      const result = await res.json();

      if (result.success) {
        infoMsg = result.message || 'OTP resent. Check your email.';
      } else {
        errorMsg = result.message || 'Failed to resend OTP.';
      }
    } catch (err) {
      errorMsg = 'Unable to resend OTP. Please try again.';
    } finally {
      isResending = false;
    }
  }
</script>

<svelte:head>
  <title>Two-Factor Authentication | e-Kalibro</title>
</svelte:head>

<style>
  .login-wrapper {
    background: url('/assets/login_bg.png') no-repeat center center fixed;
    background-size: cover;
  }
</style>

<div class="login-wrapper relative min-h-screen flex">

  <!-- Left side - 2FA Form -->
  <div class="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-[#FFF9E6]/70 backdrop-blur-sm">
    <div class="max-w-md w-full space-y-8">

      <!-- Header -->
      <div class="text-center">
        <img src="/assets/logo.png" alt="E-Kalibro Logo" class="mx-auto h-20 w-20 rounded-full object-cover" />
        <h2 class="mt-6 text-3xl font-bold text-[#0D5C29]">
          Two-Factor Authentication
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          Enter the verification code sent to
        </p>
        <p class="text-sm font-medium text-[#0D5C29]">
          {maskedEmail || 'your registered email'}
        </p>
      </div>

      <!-- OTP Icon -->
      <div class="flex justify-center">
        <div class="bg-[#0D5C29]/10 p-4 rounded-full">
          <svg class="h-10 w-10 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
      </div>

      <!-- Form -->
      <div class="mt-2 space-y-6">
        <div class="space-y-4">
          <div>
            <label for="otp" class="block text-sm font-medium text-[#0D5C29]">Verification Code</label>
            <input
              id="otp"
              type="text"
              inputmode="numeric"
              maxlength="6"
              bind:value={otp}
              on:keydown={(e) => e.key === 'Enter' && submitOtp()}
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0D5C29] focus:border-[#0D5C29] bg-white/80 text-center text-lg tracking-widest font-mono"
              placeholder="_ _ _ _ _ _"
            />
          </div>
        </div>

        {#if errorMsg}
          <div class="text-red-600 text-sm">{errorMsg}</div>
        {/if}
        {#if infoMsg}
          <div class="text-green-700 text-sm">{infoMsg}</div>
        {/if}

        <!-- Resend + Back row -->
        <div class="flex items-center justify-between text-sm">
          <button
            type="button"
            on:click={resendOtp}
            disabled={isResending}
            class="font-medium text-[#0D5C29] hover:text-[#E8B923] disabled:opacity-50 transition-colors duration-200"
          >
            {isResending ? 'Resending...' : "Didn't get a code? Resend"}
          </button>
          <button
            type="button"
            on:click={async () => { await clearPending2FA(); await goto('/'); }}
            class="font-medium text-gray-500 hover:text-gray-700 transition-colors duration-200"
          >
            ← Back to login
          </button>
        </div>

        <!-- Verify Button -->
        <div>
          <button
            type="button"
            on:click={submitOtp}
            disabled={isSubmitting}
            class="group relative w-full flex items-center justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#0D5C29] hover:bg-[#0D5C29]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D5C29] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {#if isSubmitting}
              <svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying...
            {:else}
              Verify & Continue
            {/if}
          </button>
        </div>
      </div>

    </div>
  </div>

  <!-- Right side - Feature showcase (same as login) -->
  <div class="hidden lg:block lg:flex-1 relative bg-gradient-to-br from-[#0D5C29] to-[#1a8c42]">
    <div class="relative flex flex-col justify-center items-center h-full p-12 text-white z-10">
      <div class="max-w-md text-center">
        <h1 class="text-4xl font-bold mb-6">
          Secure Access
        </h1>
        <p class="text-xl mb-8 text-slate-200">
          Protect your account with an extra layer of security
        </p>
        <div class="space-y-6">
          <div class="flex items-center space-x-4">
            <div class="bg-[#E8B923] p-3 rounded-full">
              <svg class="h-6 w-6 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div class="text-left">
              <h3 class="font-semibold">Two-Factor Authentication</h3>
              <p class="text-sm text-slate-300">Verify your identity with a one-time code</p>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <div class="bg-[#E8B923] p-3 rounded-full">
              <svg class="h-6 w-6 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
              </svg>
            </div>
            <div class="text-left">
              <h3 class="font-semibold">Email Verification</h3>
              <p class="text-sm text-slate-300">Code sent to your registered email address</p>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <div class="bg-[#E8B923] p-3 rounded-full">
              <svg class="h-6 w-6 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div class="text-left">
              <h3 class="font-semibold">Account Protection</h3>
              <p class="text-sm text-slate-300">Keep your admin account safe and secure</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

</div>