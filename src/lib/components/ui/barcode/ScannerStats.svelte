<script lang="ts">
  export let label: string;
  export let value: number;
  export let icon: 'clipboard' | 'users' | 'briefcase';

  const icons = {
    clipboard: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />`,
    users: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />`,
    briefcase: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />`
  };

  const colorMap = {
    clipboard: 'bg-blue-50 text-blue-600',
    users: 'bg-blue-50 text-blue-600',
    briefcase: 'bg-purple-50 text-purple-600'
  };
</script>

<div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
  <div class="flex items-center justify-between">
    <div>
      <p class="text-sm font-medium text-slate-600">{label}</p>
      <p class="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
    <div class="p-3 {colorMap[icon]} rounded-lg">
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {@html icons[icon]}
      </svg>
    </div>
  </div>
</div>
