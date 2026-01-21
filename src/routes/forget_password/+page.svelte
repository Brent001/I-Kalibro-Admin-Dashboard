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
      
      console.log('API Response:', data); // Debug log
      
      if (data.success) {
        actualEmail = data.email; // Store the actual email from DB
        step = 2;
        startResendTimer();
        successMsg = `OTP has been sent to ${data.maskedEmail}`;
      } else {
        errorMsg = data.message || 'Failed to send OTP.';
        generateMathProblem();
      }
    } catch (err) {
      console.error('Fetch error:', err); // Debug log
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
  <title>Forgot Password | i-Kalibro Admin Portal</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
  <!-- Left Panel - Branding & Features -->
  <div class="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-[#0D5C29] to-[#1a8c42] text-white flex-col justify-center p-12">
    <div class="max-w-lg">
      <!-- Logo & Brand -->
      <div class="mb-10">
        <div class="flex items-center mb-5">
          <div class="w-10 h-10 bg-[#E8B923] rounded-lg flex items-center justify-center mr-3 shadow-lg">
            <svg class="h-6 w-6 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <h1 class="text-2xl font-bold">i-Kalibro</h1>
        </div>
        <h2 class="text-3xl font-bold mb-3 leading-tight text-[#E8B923]">Admin Portal</h2>
        <p class="text-slate-300 leading-relaxed">Reset your admin or staff password securely with OTP verification.</p>
      </div>
      <!-- Features List -->
      <div class="space-y-6">
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0 w-9 h-9 bg-[#E8B923] rounded-lg flex items-center justify-center mt-0.5">
            <svg class="h-4 w-4 text-[#0D5C29]" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div>
            <h3 class="font-semibold mb-1">Email or Username</h3>
            <p class="text-slate-300 text-sm">Admins and staff can use either to recover their account</p>
          </div>
        </div>
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0 w-9 h-9 bg-[#E8B923] rounded-lg flex items-center justify-center mt-0.5">
            <svg class="h-4 w-4 text-[#0D5C29]" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div>
            <h3 class="font-semibold mb-1">OTP Verification</h3>
            <p class="text-slate-300 text-sm">A secure code will be sent to your registered email</p>
          </div>
        </div>
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0 w-9 h-9 bg-[#E8B923] rounded-lg flex items-center justify-center mt-0.5">
            <svg class="h-4 w-4 text-[#0D5C29]" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div>
            <h3 class="font-semibold mb-1">Quick & Secure</h3>
            <p class="text-slate-300 text-sm">Reset your admin/staff password in minutes</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Right Panel - Forms -->
  <div class="flex-1 flex items-center justify-center p-6 lg:p-12">
    <div class="w-full max-w-md">
      <!-- Mobile Header -->
      <div class="lg:hidden text-center mb-8">
        <div class="flex items-center justify-center mb-2">
          <div class="w-9 h-9 bg-[#0D5C29] rounded-lg flex items-center justify-center mr-2">
            <svg class="h-5 w-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <h1 class="text-xl font-bold text-slate-900">i-Kalibro</h1>
        </div>
        <p class="text-slate-600 text-sm">Metro Dagupan Colleges</p>
      </div>

      <!-- Progress Steps -->
      <div class="mb-8">
        <div class="flex items-center justify-center space-x-2">
          <div class="flex items-center">
            <div class="w-8 h-8 rounded-full {step >= 1 ? 'bg-[#0D5C29] text-white' : 'bg-slate-200 text-slate-500'} flex items-center justify-center text-sm font-semibold">
              1
            </div>
            <span class="ml-2 text-xs font-medium {step >= 1 ? 'text-[#0D5C29]' : 'text-slate-400'}">Admin Account</span>
          </div>
          <div class="w-12 h-0.5 {step >= 2 ? 'bg-[#0D5C29]' : 'bg-slate-200'}"></div>
          <div class="flex items-center">
            <div class="w-8 h-8 rounded-full {step >= 2 ? 'bg-[#0D5C29] text-white' : 'bg-slate-200 text-slate-500'} flex items-center justify-center text-sm font-semibold">
              2
            </div>
            <span class="ml-2 text-xs font-medium {step >= 2 ? 'text-[#0D5C29]' : 'text-slate-400'}">OTP</span>
          </div>
          <div class="w-12 h-0.5 {step >= 3 ? 'bg-[#0D5C29]' : 'bg-slate-200'}"></div>
          <div class="flex items-center">
            <div class="w-8 h-8 rounded-full {step >= 3 ? 'bg-[#0D5C29] text-white' : 'bg-slate-200 text-slate-500'} flex items-center justify-center text-sm font-semibold">
              3
            </div>
            <span class="ml-2 text-xs font-medium {step >= 3 ? 'text-[#0D5C29]' : 'text-slate-400'}">Reset</span>
          </div>
        </div>
      </div>

      <!-- Step 1: Email/Username -->
      {#if step === 1}
        <div class="mb-8">
          <h2 class="text-3xl font-bold text-[#0D5C29] mb-2">Forgot Admin Password</h2>
          <p class="text-slate-600">
            Enter your {useUsername ? 'username' : 'email'} to receive a one-time code for admin/staff password reset.
          </p>
        </div>

        <form class="space-y-5" on:submit|preventDefault={handleIdentifierSubmit}>
          <div>
            <label class="block text-sm font-semibold text-[#0D5C29] mb-2" for="identifier">
              {useUsername ? 'Username' : 'Email Address'}
            </label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {#if useUsername}
                  <svg class="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                {:else}
                  <svg class="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                  </svg>
                {/if}
              </div>
              <input
                id="identifier"
                type={useUsername ? 'text' : 'email'}
                required
                bind:value={identifier}
                class="w-full pl-10 pr-3.5 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent transition-all placeholder-slate-400 shadow-sm"
                placeholder={useUsername ? 'Enter your username' : 'Enter your email'}
              />
            </div>
            <button
              type="button"
              on:click={toggleInputMode}
              class="mt-2 text-sm text-slate-600 hover:text-[#0D5C29] transition-colors flex items-center"
            >
              <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
              </svg>
              Use {useUsername ? 'email' : 'username'} instead
            </button>
          </div>

          <div>
            <label class="block text-sm font-semibold text-[#0D5C29] mb-2" for="captcha">
              Verify you're human
            </label>
            <div class="flex items-center gap-2.5">
              <div class="flex-1 bg-[#FFF9E6] border border-[#E8B923] rounded-lg px-3.5 py-3 flex items-center justify-center">
                <span class="text-lg font-bold text-[#0D5C29]">
                  {num1} + {num2} = ?
                </span>
              </div>
              <input
                id="captcha"
                type="number"
                required
                bind:value={captchaAnswer}
                class="w-20 px-3.5 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent transition-all text-center shadow-sm"
              />
              <button
                type="button"
                on:click={generateMathProblem}
                class="p-3 border border-slate-200 rounded-lg hover:bg-[#FFF9E6] transition-colors"
                title="Generate new problem"
              >
                <svg class="h-5 w-5 text-[#0D5C29]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              </button>
            </div>
          </div>

          {#if errorMsg}
            <div class="text-red-600 bg-red-50 p-3 rounded-lg text-sm flex items-start">
              <svg class="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              <span>{errorMsg}</span>
            </div>
          {/if}

          <!-- Info Banner -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex items-start">
            <svg class="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
            </svg>
            <span>
              <strong>Can't find your email?</strong> You can use your username instead. The OTP will be sent to your registered email address.
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            class="w-full bg-[#0D5C29] text-white py-3.5 px-4 rounded-lg font-semibold hover:bg-[#0D5C29]/90 focus:outline-none focus:ring-2 focus:ring-[#0D5C29] focus:ring-offset-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if isLoading}
              <span class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending OTP...
              </span>
            {:else}
              Send OTP
            {/if}
          </button>

          <div class="mt-5 text-center">
            <p class="text-slate-600 text-sm">
              Remembered your password?
              <a href="/" class="ml-1 font-semibold text-[#0D5C29] hover:text-[#E8B923] transition-colors">
                Sign in
              </a>
            </p>
          </div>
        </form>
      {/if}

      <!-- Step 2: OTP Verification -->
      {#if step === 2}
        <div class="mb-8">
          <button on:click={handleBack} class="flex items-center text-slate-600 hover:text-[#0D5C29] mb-4 transition-colors">
            <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <h2 class="text-3xl font-bold text-[#0D5C29] mb-2">Verify OTP</h2>
          <p class="text-slate-600">Enter the 6-digit code sent to your admin/staff email</p>
        </div>

        <form class="space-y-5" on:submit|preventDefault={handleOTPSubmit}>
          <div>
            <label class="block text-sm font-semibold text-[#0D5C29] mb-2" for="otp">
              One-Time Password
            </label>
            <input
              id="otp"
              type="text"
              required
              maxlength="6"
              bind:value={otp}
              class="w-full px-3.5 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent transition-all placeholder-slate-400 shadow-sm text-center text-2xl tracking-widest font-semibold"
              placeholder="000000"
            />
          </div>

          {#if successMsg}
            <div class="text-green-700 bg-green-50 p-3 rounded-lg text-sm flex items-start">
              <svg class="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
              <span>{successMsg}</span>
            </div>
          {/if}

          {#if errorMsg}
            <div class="text-red-600 bg-red-50 p-3 rounded-lg text-sm flex items-start">
              <svg class="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              <span>{errorMsg}</span>
            </div>
          {/if}

          <div class="bg-[#FFF9E6] border border-[#E8B923] rounded-lg p-3 text-sm text-slate-600 text-center">
            {#if resendTimer > 0}
              Resend OTP in <span class="font-semibold text-[#0D5C29]">{resendTimer}s</span>
            {:else}
              Didn't receive the code?
              <button
                type="button"
                on:click={handleResendOTP}
                disabled={isLoading}
                class="ml-1 font-semibold text-[#0D5C29] hover:text-[#E8B923] transition-colors disabled:opacity-50"
              >
                Resend OTP
              </button>
            {/if}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            class="w-full bg-[#0D5C29] text-white py-3.5 px-4 rounded-lg font-semibold hover:bg-[#0D5C29]/90 focus:outline-none focus:ring-2 focus:ring-[#0D5C29] focus:ring-offset-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if isLoading}
              <span class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </span>
            {:else}
              Verify OTP
            {/if}
          </button>
        </form>
      {/if}

      <!-- Step 3: New Password -->
      {#if step === 3}
        <div class="mb-8">
          <button on:click={handleBack} class="flex items-center text-slate-600 hover:text-[#0D5C29] mb-4 transition-colors">
            <svg class="h-4 w-4 mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
          <h2 class="text-3xl font-bold text-[#0D5C29] mb-2">Set New Admin Password</h2>
          <p class="text-slate-600">Create a strong password for your admin or staff account</p>
        </div>

        <form class="space-y-5" on:submit|preventDefault={handlePasswordSubmit}>
          <div>
            <label class="block text-sm font-semibold text-[#0D5C29] mb-2" for="newPassword">
              New Password
            </label>
            <div class="relative">
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                required
                bind:value={newPassword}
                class="w-full px-3.5 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent transition-all placeholder-slate-400 shadow-sm pr-10"
                placeholder="Enter new password"
              />
              <button
                type="button"
                on:click={() => showNewPassword = !showNewPassword}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {#if showNewPassword}
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                  </svg>
                {:else}
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                {/if}
              </button>
            </div>
            <p class="text-xs text-slate-500 mt-1">Must be at least 8 characters</p>
          </div>

          <div>
            <label class="block text-sm font-semibold text-[#0D5C29] mb-2" for="confirmPassword">
              Confirm Password
            </label>
            <div class="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                bind:value={confirmPassword}
                class="w-full px-3.5 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D5C29] focus:border-transparent transition-all placeholder-slate-400 shadow-sm pr-10"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                on:click={() => showConfirmPassword = !showConfirmPassword}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0D5C29]"
              >
                {#if showConfirmPassword}
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                  </svg>
                {:else}
                  <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                {/if}
              </button>
            </div>
          </div>

          {#if successMsg}
            <div class="text-green-700 bg-green-50 p-3 rounded-lg text-sm flex items-start">
              <svg class="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
              <span>{successMsg}</span>
            </div>
          {/if}

          {#if errorMsg}
            <div class="text-red-600 bg-red-50 p-3 rounded-lg text-sm flex items-start">
              <svg class="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
              </svg>
              <span>{errorMsg}</span>
            </div>
          {/if}

          <div class="bg-[#FFF9E6] border border-[#E8B923] rounded-lg p-3 text-sm text-slate-600">
            <p class="font-semibold mb-1 text-[#0D5C29]">Password Requirements:</p>
            <ul class="space-y-0.5 text-xs">
              <li class="flex items-center">
                <svg class="h-3 w-3 mr-1.5 {newPassword.length >= 8 ? 'text-[#0D5C29]' : 'text-slate-400'}" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                At least 8 characters
              </li>
              <li class="flex items-center">
                <svg class="h-3 w-3 mr-1.5 {/[A-Z]/.test(newPassword) ? 'text-[#0D5C29]' : 'text-slate-400'}" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                One uppercase letter
              </li>
              <li class="flex items-center">
                <svg class="h-3 w-3 mr-1.5 {/[a-z]/.test(newPassword) ? 'text-[#0D5C29]' : 'text-slate-400'}" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                One lowercase letter
              </li>
              <li class="flex items-center">
                <svg class="h-3 w-3 mr-1.5 {/[0-9]/.test(newPassword) ? 'text-[#0D5C29]' : 'text-slate-400'}" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                One number
              </li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            class="w-full bg-[#0D5C29] text-white py-3.5 px-4 rounded-lg font-semibold hover:bg-[#0D5C29]/90 focus:outline-none focus:ring-2 focus:ring-[#0D5C29] focus:ring-offset-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if isLoading}
              <span class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Resetting Password...
              </span>
            {:else}
              Reset Password
            {/if}
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>