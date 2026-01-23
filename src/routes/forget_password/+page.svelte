<script lang="ts">
  let step = 1; // 1: Email/Username, 2: OTP, 3: New Password
  let identifier = ''; // Can be email or username
  let actualEmail = ''; // Actual email from database
  let useUsername = false;
  let otp = '';
  let newPassword = '';
  let confirmPassword = '';
  let errorMsg = '';
  let successMsg = '';
  let isLoading = false;
  let resendTimer = 0;
  let resendInterval: any = null;

  // Math problem variables (humanizer)
  let num1 = 0;
  let num2 = 0;
  let correctAnswer = 0;
  let captchaAnswer = '';

  // Password visibility
  let showNewPassword = false;
  let showConfirmPassword = false;

  function generateMathProblem() {
    num1 = Math.floor(Math.random() * 10) + 1;
    num2 = Math.floor(Math.random() * 10) + 1;
    correctAnswer = num1 + num2;
    captchaAnswer = '';
  }

  generateMathProblem();

  function startResendTimer() {
    resendTimer = 60;
    resendInterval = setInterval(() => {
      resendTimer--;
      if (resendTimer <= 0) {
        clearInterval(resendInterval);
      }
    }, 1000);
  }

  async function handleIdentifierSubmit(e: Event) {
    e.preventDefault();
    errorMsg = '';
    successMsg = '';

    if (parseInt(captchaAnswer) !== correctAnswer) {
      errorMsg = 'Incorrect answer to the math problem. Please try again.';
      generateMathProblem();
      return;
    }

    if (!identifier || identifier.trim().length === 0) {
      errorMsg = 'Please enter your email or username.';
      return;
    }

    isLoading = true;
    try {
      const res = await fetch('/api/forget_password/sent_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() })
      });
      const data = await res.json();
      
      if (data.success) {
        actualEmail = data.email;
        step = 2;
        startResendTimer();
        successMsg = `OTP has been sent to ${data.maskedEmail}`;
      } else {
        errorMsg = data.message || 'Failed to send OTP.';
        generateMathProblem();
      }
    } catch (err) {
      errorMsg = 'Network error. Please try again.';
      generateMathProblem();
    } finally {
      isLoading = false;
    }
  }

  async function handleOTPSubmit(e: Event) {
    e.preventDefault();
    errorMsg = '';
    successMsg = '';

    if (otp.length !== 6) {
      errorMsg = 'Please enter a valid 6-digit OTP.';
      return;
    }

    isLoading = true;
    try {
      const res = await fetch('/api/forget_password/verify_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: actualEmail, otp })
      });
      const data = await res.json();
      if (data.success) {
        step = 3;
        successMsg = 'OTP verified. Please set your new password.';
      } else {
        errorMsg = data.message || 'Invalid OTP. Please try again.';
      }
    } catch (err) {
      errorMsg = 'Network error. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function handleResendOTP() {
    if (resendTimer > 0) return;
    
    errorMsg = '';
    successMsg = '';
    isLoading = true;

    try {
      const res = await fetch('/api/forget_password/sent_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: actualEmail })
      });
      const data = await res.json();
      if (data.success) {
        startResendTimer();
        successMsg = 'New OTP has been sent to your email.';
      } else {
        errorMsg = data.message || 'Failed to resend OTP.';
      }
    } catch (err) {
      errorMsg = 'Network error. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function handlePasswordSubmit(e: Event) {
    e.preventDefault();
    errorMsg = '';
    successMsg = '';

    if (newPassword.length < 8) {
      errorMsg = 'Password must be at least 8 characters long.';
      return;
    }

    if (newPassword !== confirmPassword) {
      errorMsg = 'Passwords do not match.';
      return;
    }

    isLoading = true;
    try {
      const res = await fetch('/api/forget_password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: actualEmail, otp, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        successMsg = 'Password reset successful! Redirecting to login...';
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } else {
        errorMsg = data.message || 'Failed to reset password.';
      }
    } catch (err) {
      errorMsg = 'Network error. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  function handleBack() {
    if (step === 2) {
      step = 1;
      otp = '';
      actualEmail = '';
      clearInterval(resendInterval);
      resendTimer = 0;
    } else if (step === 3) {
      step = 2;
      newPassword = '';
      confirmPassword = '';
    }
    errorMsg = '';
    successMsg = '';
  }

  function toggleInputMode() {
    useUsername = !useUsername;
    identifier = '';
    errorMsg = '';
    successMsg = '';
  }
</script>

<svelte:head>
  <title>Forgot Password | e-Kalibro Admin Portal</title>
</svelte:head>

<div class="min-h-screen flex">
  <!-- Left side - Form -->
  <div class="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-[#FFF9E6]">
    <div class="max-w-md w-full space-y-6">
      <!-- Header -->
      <div class="text-center">
        <h2 class="text-3xl font-bold text-[#0D5C29]">
          {#if step === 1}
            Forgot Password
          {:else if step === 2}
            Verify OTP
          {:else}
            Reset Password
          {/if}
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          {#if step === 1}
            Enter your credentials to receive a verification code
          {:else if step === 2}
            Enter the 6-digit code sent to your email
          {:else}
            Create a new password for your account
          {/if}
        </p>
        <p class="text-xs text-gray-500 mt-1">
          Metro Dagupan Colleges
        </p>
      </div>

      <!-- Step 1: Email/Username -->
      {#if step === 1}
        <form class="mt-6 space-y-4" on:submit|preventDefault={handleIdentifierSubmit}>
          <div>
            <label for="identifier" class="block text-sm font-medium text-[#0D5C29]">
              {useUsername ? 'Username' : 'Email Address'}
            </label>
            <input
              id="identifier"
              type={useUsername ? 'text' : 'email'}
              required
              bind:value={identifier}
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0D5C29] focus:border-[#0D5C29]"
              placeholder={useUsername ? 'Enter your username' : 'Enter your email'}
            />
            <button
              type="button"
              on:click={toggleInputMode}
              class="mt-2 text-sm text-[#0D5C29] hover:text-[#E8B923]"
            >
              Use {useUsername ? 'email' : 'username'} instead
            </button>
          </div>

          <div>
            <label for="captcha" class="block text-sm font-medium text-[#0D5C29]">
              Verify you're human
            </label>
            <div class="mt-1 flex items-center gap-2">
              <div class="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 flex items-center justify-center">
                <span class="text-lg font-bold text-[#0D5C29]">
                  {num1} + {num2} = ?
                </span>
              </div>
              <input
                id="captcha"
                type="number"
                required
                bind:value={captchaAnswer}
                class="w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#0D5C29] focus:border-[#0D5C29] text-center"
              />
              <button
                type="button"
                on:click={generateMathProblem}
                class="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
                title="Generate new problem"
              >
                <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              </button>
            </div>
          </div>

          {#if errorMsg}
            <div class="text-red-600 text-sm">{errorMsg}</div>
          {/if}

          <div class="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
            <strong>Note:</strong> If you use your username, the OTP will be sent to your registered email address.
          </div>

          <button
            type="submit"
            disabled={isLoading}
            class="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#0D5C29] hover:bg-[#0D5C29]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D5C29] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {#if isLoading}
              <svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending OTP...
            {:else}
              Send OTP
            {/if}
          </button>

          <div class="text-center">
            <p class="text-sm text-gray-600">
              Remember your password?
              <a href="/" class="font-medium text-[#0D5C29] hover:text-[#E8B923]">
                Sign in
              </a>
            </p>
          </div>
        </form>
      {/if}

      <!-- Step 2: OTP Verification -->
      {#if step === 2}
        <div class="mt-6">
          <button on:click={handleBack} class="flex items-center text-sm text-gray-600 hover:text-[#0D5C29] mb-4">
            <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
        </div>

        <form class="space-y-4" on:submit|preventDefault={handleOTPSubmit}>
          <div>
            <label for="otp" class="block text-sm font-medium text-[#0D5C29]">
              One-Time Password
            </label>
            <input
              id="otp"
              type="text"
              required
              maxlength="6"
              bind:value={otp}
              class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0D5C29] focus:border-[#0D5C29] text-center text-2xl tracking-widest font-semibold"
              placeholder="000000"
            />
          </div>

          {#if successMsg}
            <div class="text-green-700 text-sm">{successMsg}</div>
          {/if}

          {#if errorMsg}
            <div class="text-red-600 text-sm">{errorMsg}</div>
          {/if}

          <div class="bg-[#FFF9E6] border border-[#E8B923] rounded-md p-3 text-sm text-gray-600 text-center">
            {#if resendTimer > 0}
              Resend OTP in <span class="font-semibold text-[#0D5C29]">{resendTimer}s</span>
            {:else}
              Didn't receive the code?
              <button
                type="button"
                on:click={handleResendOTP}
                disabled={isLoading}
                class="ml-1 font-semibold text-[#0D5C29] hover:text-[#E8B923] disabled:opacity-50"
              >
                Resend OTP
              </button>
            {/if}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            class="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#0D5C29] hover:bg-[#0D5C29]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D5C29] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {#if isLoading}
              <svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying...
            {:else}
              Verify OTP
            {/if}
          </button>
        </form>
      {/if}

      <!-- Step 3: New Password -->
      {#if step === 3}
        <div class="mt-6">
          <button on:click={handleBack} class="flex items-center text-sm text-gray-600 hover:text-[#0D5C29] mb-4">
            <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
        </div>

        <form class="space-y-4" on:submit|preventDefault={handlePasswordSubmit}>
          <div>
            <label for="newPassword" class="block text-sm font-medium text-[#0D5C29]">
              New Password
            </label>
            <div class="mt-1 relative">
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                required
                bind:value={newPassword}
                class="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0D5C29] focus:border-[#0D5C29]"
                placeholder="Enter new password"
              />
              <button
                type="button"
                on:click={() => showNewPassword = !showNewPassword}
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
                tabindex="-1"
              >
                {#if showNewPassword}
                  <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M17.94 17.94A10.94 10.94 0 0112 19c-5 0-9.27-3.11-10.94-7.5a10.97 10.97 0 012.92-4.19M1 1l22 22" />
                    <path d="M9.53 9.53A3.5 3.5 0 0012 15.5a3.5 3.5 0 003.5-3.5c0-.88-.32-1.69-.85-2.32" />
                  </svg>
                {:else}
                  <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                {/if}
              </button>
            </div>
            <p class="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-[#0D5C29]">
              Confirm Password
            </label>
            <div class="mt-1 relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                bind:value={confirmPassword}
                class="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#0D5C29] focus:border-[#0D5C29]"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                on:click={() => showConfirmPassword = !showConfirmPassword}
                class="absolute inset-y-0 right-0 pr-3 flex items-center"
                tabindex="-1"
              >
                {#if showConfirmPassword}
                  <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M17.94 17.94A10.94 10.94 0 0112 19c-5 0-9.27-3.11-10.94-7.5a10.97 10.97 0 012.92-4.19M1 1l22 22" />
                    <path d="M9.53 9.53A3.5 3.5 0 0012 15.5a3.5 3.5 0 003.5-3.5c0-.88-.32-1.69-.85-2.32" />
                  </svg>
                {:else}
                  <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                {/if}
              </button>
            </div>
          </div>

          {#if successMsg}
            <div class="text-green-700 text-sm">{successMsg}</div>
          {/if}

          {#if errorMsg}
            <div class="text-red-600 text-sm">{errorMsg}</div>
          {/if}

          <button
            type="submit"
            disabled={isLoading}
            class="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#0D5C29] hover:bg-[#0D5C29]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D5C29] disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {#if isLoading}
              <svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Resetting Password...
            {:else}
              Reset Password
            {/if}
          </button>
        </form>
      {/if}
    </div>
  </div>

  <!-- Right side - Feature showcase -->
  <div class="hidden lg:block lg:flex-1 relative bg-gradient-to-br from-[#0D5C29] to-[#1a8c42]">
    <div class="relative flex flex-col justify-center items-center h-full p-12 text-white z-10">
      <div class="max-w-md text-center">
        <img src="/assets/logo.png" alt="E-Kalibro Logo" class="mx-auto h-20 w-20 rounded-full object-cover mb-6 shadow-lg ring-4 ring-white/20" />
        <h1 class="text-4xl font-bold mb-6">
          Password Recovery
        </h1>
        <p class="text-xl mb-8 text-slate-200">
          Secure password reset process for admin and staff accounts
        </p>
        <div class="space-y-6">
          <div class="flex items-center space-x-4">
            <div class="bg-[#E8B923] p-3 rounded-full">
              <svg class="h-6 w-6 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <div class="text-left">
              <h3 class="font-semibold">Email Verification</h3>
              <p class="text-sm text-slate-300">Secure OTP sent to your registered email</p>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <div class="bg-[#E8B923] p-3 rounded-full">
              <svg class="h-6 w-6 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </div>
            <div class="text-left">
              <h3 class="font-semibold">Secure Process</h3>
              <p class="text-sm text-slate-300">Multiple verification steps for safety</p>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <div class="bg-[#E8B923] p-3 rounded-full">
              <svg class="h-6 w-6 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div class="text-left">
              <h3 class="font-semibold">Quick Recovery</h3>
              <p class="text-sm text-slate-300">Reset your password in minutes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>