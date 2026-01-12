<script setup lang="ts">
definePageMeta({
  layout: false
})

const selectedPlan = ref<'saas' | 'perpetual' | null>(null)

const saasPlan = {
  name: 'SaaS',
  tagline: 'Langganan Bulanan',
  setupPrice: 'Rp 10.000.000',
  setupNote: 'Sekali bayar, tergantung jumlah properti & scope',
  monthlyPrice: 'Rp 600.000',
  period: '/bulan',
  contract: 'Kontrak minimal 12 bulan',
  description: 'Model langganan agar sistem selalu stabil, aman, dan terawat.',
  features: [
    { text: 'VPS Cloud Server (dedicated / isolated)', included: true },
    { text: 'Domain (1 domain)', included: true },
    { text: 'SSL (HTTPS)', included: true },
    { text: 'Backup data rutin', included: true },
    { text: 'Monitoring server', included: true },
    { text: 'Maintenance & update sistem', included: true },
    { text: 'Support teknis sistem', included: true },
  ],
  limitations: [
    'Biaya bulanan adalah biaya operasional sistem',
    'Data tersimpan di server kami',
    'Membutuhkan koneksi internet',
  ]
}

const perpetualPlan = {
  name: 'Beli Putus',
  tagline: 'Bayar Sekali, Miliki Selamanya',
  mainPrice: 'Rp 20.000.000',
  mainNote: 'Sistem & Lisensi',
  yearlyVps: 'Rp 3.000.000',
  yearlyDomain: 'Rp 300.000',
  description: 'Kepemilikan penuh sistem dengan scope & support terbatas.',
  features: [
    { text: 'Source code & lisensi', included: true },
    { text: 'Instalasi di server', included: true },
    { text: 'Domain & VPS tahun pertama', included: true },
    { text: 'Training penggunaan', included: true },
    { text: 'Garansi bug 6 bulan', included: true },
  ],
  limitations: [
    'Maintenance lanjutan opsional & berbayar',
    'Upgrade fitur di luar scope → quotation terpisah',
    'Membutuhkan koneksi internet',
    'Harga VPS dan domain bisa naik sewaktu-waktu',
  ]
}

const addons = [
  { name: 'Notifikasi WhatsApp', icon: 'i-simple-icons-whatsapp', description: 'Tagihan, reminder, dan info ke tenant' },
  { name: 'Payment Gateway', icon: 'i-heroicons-credit-card', description: 'Integrasi QRIS & Virtual Account' },
  { name: 'Custom Laporan', icon: 'i-heroicons-document-chart-bar', description: 'Laporan sesuai kebutuhan bisnis' },
  { name: 'Modul Keluhan / Maintenance', icon: 'i-heroicons-wrench-screwdriver', description: 'Sistem ticketing perbaikan' },
  { name: 'Penyesuaian Alur Kerja', icon: 'i-heroicons-cog-8-tooth', description: 'Sesuaikan workflow sistem' },
]
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black text-white">
    <!-- Hero Section -->
    <div class="relative overflow-hidden">
      
      <div class="relative max-w-6xl mx-auto px-6 py-16 text-center">
        <div class="mb-8">
          <div class="inline-flex items-center gap-3 bg-white/5 backdrop-blur-lg px-6 py-3 rounded-full border border-white/10">
            <div class="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center">
              <UIcon name="i-heroicons-home-modern" class="w-6 h-6 text-white" />
            </div>
            <span class="text-xl font-bold">Kos Manajer</span>
          </div>
        </div>
        
        <h1 class="text-4xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
          Model Harga Transparan
        </h1>
        <p class="text-xl text-gray-400 max-w-2xl mx-auto">
          Pilih model kerjasama yang sesuai dengan kebutuhan dan skala bisnis properti Anda.
        </p>
      </div>
    </div>

    <!-- Pricing Cards -->
    <div class="max-w-5xl mx-auto px-6 pb-16">
      <div class="grid md:grid-cols-2 gap-8">
        
        <!-- SaaS Plan -->
        <div 
          class="relative bg-gray-900/50 backdrop-blur-xl rounded-3xl border border-gray-800 p-8 transition-all duration-300 hover:border-primary-500/50 hover:shadow-2xl hover:shadow-primary-500/10"
          :class="{ 'ring-2 ring-primary-500 border-primary-500': selectedPlan === 'saas' }"
          @click="selectedPlan = 'saas'"
        >
          <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-primary-500/10 rounded-2xl mb-4">
              <UIcon name="i-heroicons-cloud" class="w-8 h-8 text-primary-400" />
            </div>
            <h3 class="text-2xl font-bold mb-1">{{ saasPlan.name }}</h3>
            <p class="text-gray-400 text-sm">{{ saasPlan.tagline }}</p>
          </div>
          
          <!-- Setup Cost -->
          <div class="bg-gray-800/50 rounded-xl p-4 mb-4 text-center">
            <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Biaya Setup & Implementasi</p>
            <div class="text-xl font-bold">{{ saasPlan.setupPrice }}</div>
            <p class="text-xs text-gray-500">{{ saasPlan.setupNote }}</p>
          </div>
          
          <!-- Monthly Cost -->
          <div class="text-center mb-6">
            <div class="flex items-baseline justify-center gap-1">
              <span class="text-5xl font-extrabold text-primary-400">{{ saasPlan.monthlyPrice }}</span>
              <span class="text-gray-400">{{ saasPlan.period }}</span>
            </div>
            <p class="text-gray-500 text-sm mt-1">{{ saasPlan.contract }}</p>
          </div>
          
          <!-- Features -->
          <div class="space-y-3 mb-6">
            <p class="text-xs text-gray-400 uppercase tracking-wide font-medium">Sudah Termasuk</p>
            <div v-for="feature in saasPlan.features" :key="feature.text" class="flex items-start gap-3">
              <div class="bg-green-500/10 text-green-400 p-1 rounded-full shrink-0">
                <UIcon name="i-heroicons-check" class="w-4 h-4" />
              </div>
              <span class="text-gray-300 text-sm">{{ feature.text }}</span>
            </div>
          </div>
          
          <!-- Limitations -->
          <div class="border-t border-gray-800 pt-6">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-3 font-medium">Catatan</p>
            <ul class="space-y-2">
              <li v-for="limit in saasPlan.limitations" :key="limit" class="flex items-start gap-2 text-sm text-gray-400">
                <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                {{ limit }}
              </li>
            </ul>
          </div>
          
          <button class="w-full mt-8 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40">
            Pilih SaaS
          </button>
        </div>
        
        <!-- Beli Putus Plan -->
        <div 
          class="relative bg-gray-900/50 backdrop-blur-xl rounded-3xl border border-gray-800 p-8 transition-all duration-300 hover:border-green-500/50 hover:shadow-2xl hover:shadow-green-500/10"
          :class="{ 'ring-2 ring-green-500 border-green-500': selectedPlan === 'perpetual' }"
          @click="selectedPlan = 'perpetual'"
        >
          <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 rounded-2xl mb-4">
              <UIcon name="i-heroicons-server-stack" class="w-8 h-8 text-green-400" />
            </div>
            <h3 class="text-2xl font-bold mb-1">{{ perpetualPlan.name }}</h3>
            <p class="text-gray-400 text-sm">{{ perpetualPlan.tagline }}</p>
          </div>
          
          <!-- Main Cost -->
          <div class="text-center mb-4">
            <div class="flex items-baseline justify-center gap-1">
              <span class="text-5xl font-extrabold text-green-400">{{ perpetualPlan.mainPrice }}</span>
            </div>
            <p class="text-gray-500 text-sm mt-1">{{ perpetualPlan.mainNote }}</p>
          </div>
          
          <!-- Yearly Costs -->
          <div class="bg-gray-800/50 rounded-xl p-4 mb-6">
            <p class="text-xs text-gray-400 uppercase tracking-wide mb-3 text-center">Biaya Tahunan Terpisah</p>
            <div class="flex justify-between items-center py-2 border-b border-gray-700">
              <span class="text-gray-400 text-sm">VPS Server</span>
              <span class="font-bold">{{ perpetualPlan.yearlyVps }}<span class="text-gray-500 text-xs">/tahun</span></span>
            </div>
            <div class="flex justify-between items-center py-2">
              <span class="text-gray-400 text-sm">Domain</span>
              <span class="font-bold">{{ perpetualPlan.yearlyDomain }}<span class="text-gray-500 text-xs">/tahun</span></span>
            </div>
          </div>
          
          <!-- Features -->
          <div class="space-y-3 mb-6">
            <p class="text-xs text-gray-400 uppercase tracking-wide font-medium">Termasuk</p>
            <div v-for="feature in perpetualPlan.features" :key="feature.text" class="flex items-start gap-3">
              <div class="bg-green-500/10 text-green-400 p-1 rounded-full shrink-0">
                <UIcon name="i-heroicons-check" class="w-4 h-4" />
              </div>
              <span class="text-gray-300 text-sm">{{ feature.text }}</span>
            </div>
          </div>
          
          <!-- Limitations -->
          <div class="border-t border-gray-800 pt-6">
            <p class="text-xs text-gray-500 uppercase tracking-wider mb-3 font-medium">Catatan</p>
            <ul class="space-y-2">
              <li v-for="limit in perpetualPlan.limitations" :key="limit" class="flex items-start gap-2 text-sm text-gray-400">
                <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                {{ limit }}
              </li>
            </ul>
          </div>
          
          <button class="w-full mt-8 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg shadow-green-500/25 hover:shadow-green-500/40">
            Pilih Beli Putus
          </button>
        </div>
      </div>
      
      <!-- Add-ons Section -->
      <div class="mt-16">
        <h2 class="text-2xl font-bold text-center mb-2">Fitur Tambahan (Add-On)</h2>
        <p class="text-gray-400 text-center mb-8">Opsional - sesuai kebutuhan</p>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="addon in addons" :key="addon.name" class="bg-gray-900/30 backdrop-blur-lg rounded-2xl border border-gray-800 p-5 hover:border-gray-700 transition-colors">
            <div class="flex items-start gap-4">
              <div class="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center shrink-0">
                <UIcon :name="addon.icon" class="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <h3 class="font-bold mb-1">{{ addon.name }}</h3>
                <p class="text-gray-500 text-sm">{{ addon.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Comparison Table -->
      <div class="mt-16">
        <h2 class="text-2xl font-bold text-center mb-8">Perbandingan Paket</h2>
        <div class="overflow-x-auto">
          <table class="w-full bg-gray-900/30 backdrop-blur-lg rounded-2xl border border-gray-800 overflow-hidden">
            <thead>
              <tr class="border-b border-gray-800">
                <th class="text-left p-6 font-medium text-gray-400">Aspek</th>
                <th class="p-6 text-center">
                  <span class="text-primary-400 font-bold">SaaS</span>
                </th>
                <th class="p-6 text-center">
                  <span class="text-green-400 font-bold">Beli Putus</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800">
              <tr>
                <td class="p-6 text-gray-300">Biaya Setup</td>
                <td class="p-6 text-center text-gray-400">Rp 10 juta</td>
                <td class="p-6 text-center text-gray-400">Termasuk</td>
              </tr>
              <tr>
                <td class="p-6 text-gray-300">Biaya Sistem</td>
                <td class="p-6 text-center text-gray-400">—</td>
                <td class="p-6 text-center text-gray-400">Rp 15 juta</td>
              </tr>
              <tr>
                <td class="p-6 text-gray-300">Biaya Bulanan</td>
                <td class="p-6 text-center text-primary-400 font-semibold">Rp 600.000</td>
                <td class="p-6 text-center text-green-400 font-semibold">Rp 0</td>
              </tr>
              <tr>
                <td class="p-6 text-gray-300">Biaya Tahunan (VPS + Domain)</td>
                <td class="p-6 text-center text-gray-400">Termasuk</td>
                <td class="p-6 text-center text-gray-400">Rp 3,3 juta</td>
              </tr>
              <tr>
                <td class="p-6 text-gray-300">Hosting & Server</td>
                <td class="p-6 text-center text-gray-400">Kami kelola</td>
                <td class="p-6 text-center text-gray-400">Mandiri</td>
              </tr>
              <tr>
                <td class="p-6 text-gray-300">Update & Maintenance</td>
                <td class="p-6 text-center">
                  <UIcon name="i-heroicons-check-circle" class="w-6 h-6 text-green-500 mx-auto" />
                </td>
                <td class="p-6 text-center text-gray-400">Opsional</td>
              </tr>
              <tr>
                <td class="p-6 text-gray-300">Source Code</td>
                <td class="p-6 text-center">
                  <UIcon name="i-heroicons-x-circle" class="w-6 h-6 text-red-500 mx-auto" />
                </td>
                <td class="p-6 text-center">
                  <UIcon name="i-heroicons-check-circle" class="w-6 h-6 text-green-500 mx-auto" />
                </td>
              </tr>
              <tr>
                <td class="p-6 text-gray-300">Support Teknis</td>
                <td class="p-6 text-center text-gray-400">Unlimited</td>
                <td class="p-6 text-center text-gray-400">3 bulan gratis</td>
              </tr>
              <tr>
                <td class="p-6 text-gray-300">Backup Data</td>
                <td class="p-6 text-center">
                  <UIcon name="i-heroicons-check-circle" class="w-6 h-6 text-green-500 mx-auto" />
                </td>
                <td class="p-6 text-center text-gray-400">Mandiri</td>
              </tr>
              <tr>
                <td class="p-6 text-gray-300">Kepemilikan Data</td>
                <td class="p-6 text-center text-gray-400">Server Kami</td>
                <td class="p-6 text-center text-gray-400">Server Anda</td>
              </tr>
              <tr>
                <td class="p-6 text-gray-300">Kontrak Minimal</td>
                <td class="p-6 text-center text-gray-400">12 bulan</td>
                <td class="p-6 text-center text-gray-400">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- CTA Section -->
      <div class="mt-16 text-center bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-12 border border-gray-700">
        <h2 class="text-3xl font-bold mb-4">Siap Kelola Properti Lebih Efisien?</h2>
        <p class="text-gray-400 mb-8 max-w-xl mx-auto">
          Hubungi kami untuk konsultasi gratis dan demo sistem secara langsung.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="https://wa.me/6281234567890" target="_blank" class="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white font-bold py-4 px-8 rounded-xl transition-colors">
            <UIcon name="i-simple-icons-whatsapp" class="w-5 h-5" />
            Hubungi via WhatsApp
          </a>
          <a href="/" class="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-8 rounded-xl transition-colors border border-white/20">
            <UIcon name="i-heroicons-play" class="w-5 h-5" />
            Lihat Demo
          </a>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="mt-16 text-center text-gray-500 text-sm">
        <p>Harga dapat berubah sewaktu-waktu tanpa pemberitahuan sebelumnya.</p>
        <p class="mt-1">&copy; 2026 Kos Manajer. All rights reserved.</p>
      </div>
    </div>
  </div>
</template>
