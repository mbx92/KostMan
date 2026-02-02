<script setup lang="ts">
import { useKosStore, type Property } from "~/stores/kos";
import ConfirmDialog from "~/components/ConfirmDialog.vue";

const route = useRoute();
const router = useRouter();
const store = useKosStore();
const toast = useToast();
const confirmDialog = ref<InstanceType<typeof ConfirmDialog>>()

const propertyId = computed(() => route.params.id as string);

// Fetch property from API
const property = ref<Property | null>(null);
const isLoading = ref(true);
const isSaving = ref(false);



async function loadProperty() {
  isLoading.value = true;
  try {
    const data = await store.fetchPropertyById(propertyId.value);
    if (data) {
      property.value = data;
    } else {
      router.push("/properties");
    }
  } catch {
    router.push("/properties");
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadProperty();
});

const isPreviewOpen = ref(false);

// Form state - initialized from property but editable
const form = reactive({
  name: "",
  address: "",
  description: "",
  image: "",
  mapUrl: "",
  useCustomSettings: false,
  costPerKwh: 0,
  trashFee: 0,
  waterFee: 0,
});

// Sync form with property data when loaded
watch(
  property,
  (p) => {
    if (p) {
      form.name = p.name || "";
      form.address = p.address || "";
      form.description = p.description || "";
      form.image = p.image || "";
      form.mapUrl = p.mapUrl || "";
      form.useCustomSettings = !!p.settings;
      form.costPerKwh = Number(p.settings?.costPerKwh) || Number(store.settings.costPerKwh);
      form.trashFee = Number(p.settings?.trashFee) || Number(store.settings.trashFee);
      form.waterFee = Number(p.settings?.waterFee) || Number(store.settings.waterFee);
    }
  },
  { immediate: true }
);

const saveChanges = async () => {
  // Validation - ensure required fields are filled
  if (!form.name || form.name.trim().length < 1) {
    toast.add({
      title: "Kesalahan Validasi",
      description: "Nama properti wajib diisi.",
      color: "error",
    });
    return;
  }
  
  if (!form.address || form.address.trim().length < 1) {
    toast.add({
      title: "Kesalahan Validasi",
      description: "Alamat properti wajib diisi.",
      color: "error",
    });
    return;
  }

  isSaving.value = true;
  try {
    // Ensure no null values are sent - convert to empty string or undefined
    const updates: Partial<Property> & { mapUrl?: string; costPerKwh?: number; waterFee?: number; trashFee?: number } = {
      name: form.name.trim(),
      address: form.address.trim(),
      description: form.description?.trim() || '',
      image: form.image?.trim() || '',
      mapUrl: form.mapUrl?.trim() || '',
    };

    if (form.useCustomSettings) {
      updates.costPerKwh = form.costPerKwh;
      updates.waterFee = form.waterFee;
      updates.trashFee = form.trashFee;
    }

    await store.updateProperty(propertyId.value, updates);
    
    // Reload property to get updated data with settings
    await loadProperty();
    
    toast.add({
      title: "Perubahan Disimpan",
      description: "Detail properti berhasil diperbarui.",
      color: "success",
      icon: "i-heroicons-check-circle"
    });
  } catch (err: any) {
    toast.add({
      title: "Gagal",
      description: err?.data?.message || err?.message || "Gagal menyimpan perubahan",
      color: "error",
    });
  } finally {
    isSaving.value = false;
  }
};

const deleteProperty = async () => {
  const confirmed = await confirmDialog.value?.confirm({
    title: 'Hapus Properti?',
    message: `Apakah Anda yakin ingin menghapus "${property.value?.name}"? Ini juga akan menghapus ${property.value?.roomCount || 0} kamar.`,
    confirmText: 'Ya, Hapus',
    confirmColor: 'error'
  })
  
  if (!confirmed) return
  
try {
      await store.deleteProperty(propertyId.value);
      toast.add({
        title: "Properti Dihapus",
        description: "Properti berhasil dihapus.",
        color: "success",
      });
      router.push("/properties");
    } catch (err: any) {
      toast.add({
        title: "Gagal",
        description: err?.data?.message || err?.message || "Gagal menghapus properti",
        color: "error",
      });
    }
};

</script>

<template>
  <div v-if="property" class="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
    <!-- Hero Header / Cover Image -->
    <div
      class="relative h-[50vh] min-h-[400px] group overflow-hidden mx-4 mt-4 rounded-t-3xl shadow-none"
    >
      <!-- Background Image -->
      <img
        :src="form.image || 'https://placehold.co/1920x800?text=No+Image'"
        class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        onerror="this.src = 'https://placehold.co/1920x800?text=No+Image'"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-gray-50 via-gray-50/90 dark:from-gray-950 dark:via-gray-950/90 to-transparent"
      ></div>

      <!-- Navbar Overlay -->
      <div
        class="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10"
      >
        <UButton
          to="/properties"
          variant="ghost"
          color="neutral"
          icon="i-heroicons-arrow-left"
          class="text-white hover:text-gray-100"
          >Kembali ke Properti</UButton
        >
      </div>

      <!-- Hero Content (Editable) -->
      <div
        class="absolute bottom-0 left-0 right-0 p-6 md:p-12 pb-16 md:pb-24 z-10 max-w-4xl"
      >
        <div class="space-y-4">
          <!-- Editable Name -->
          <div class="relative group/input">
            <input
              v-model="form.name"
              class="w-full bg-transparent text-4xl md:text-6xl font-extrabold text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-white/50 border-none outline-none focus:ring-0 px-0"
              placeholder="Nama Properti"
              autocomplete="off"
            />
            <UIcon
              name="i-heroicons-pencil"
              class="absolute right-0 top-1/2 -translate-y-1/2 text-gray-500 dark:text-white/30 w-6 h-6 opacity-0 group-hover/input:opacity-100 transition-opacity pointer-events-none"
            />
          </div>

          <!-- Editable Address -->
          <div
            class="flex items-center gap-2 text-gray-600 dark:text-gray-300 text-lg md:text-xl"
          >
            <UIcon
              name="i-heroicons-map-pin"
              class="w-6 h-6 shrink-0 text-primary-500 dark:text-primary-400"
            />
            <input
              v-model="form.address"
              class="w-full bg-transparent border-none outline-none focus:ring-0 px-0 text-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-white/50"
              placeholder="Alamat Properti"
              autocomplete="off"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div
      class="max-w-7xl mx-auto px-6 -mt-10 relative z-20 grid grid-cols-1 lg:grid-cols-3 gap-8 pb-32"
    >
      <!-- Left Col: Description & Settings -->
      <div class="lg:col-span-2 space-y-8">
        <!-- Stats Bar - Separate cards on mobile, single card on desktop -->
        <div class="grid grid-cols-1 gap-3 md:hidden">
          <div
            class="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 p-4 text-center"
          >
            <div class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ property?.roomCount || 0 }}
            </div>
            <div
              class="text-xs text-gray-500 uppercase tracking-wide font-medium"
            >
              Total Kamar
            </div>
          </div>
          <div
            class="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 p-4 text-center"
          >
            <div class="text-2xl font-bold text-primary-500">
              {{ property?.occupantCount || 0 }}
            </div>
            <div
              class="text-xs text-gray-500 uppercase tracking-wide font-medium"
            >
              Terisi
            </div>
          </div>
          <div
            class="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 p-4 text-center"
          >
            <div class="text-2xl font-bold text-green-500">
              {{ Math.round(property?.occupantPercentage || 0) }}%
            </div>
            <div
              class="text-xs text-gray-500 uppercase tracking-wide font-medium"
            >
              Tingkat Hunian
            </div>
          </div>
        </div>
        <!-- Desktop stats bar -->
        <div
          class="hidden md:flex bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 items-center justify-around"
        >
          <div class="text-center">
            <div class="text-3xl font-bold text-gray-900 dark:text-white">
              {{ property?.roomCount || 0 }}
            </div>
            <div
              class="text-sm text-gray-500 uppercase tracking-wide font-medium"
            >
              Total Kamar
            </div>
          </div>
          <div class="w-px h-12 bg-gray-200 dark:bg-gray-800"></div>
          <div class="text-center">
            <div class="text-3xl font-bold text-primary-500">
              {{ property?.occupantCount || 0 }}
            </div>
            <div
              class="text-sm text-gray-500 uppercase tracking-wide font-medium"
            >
              Terisi
            </div>
          </div>
          <div class="w-px h-12 bg-gray-200 dark:bg-gray-800"></div>
          <div class="text-center">
            <div class="text-3xl font-bold text-green-500">
              {{ Math.round(property?.occupantPercentage || 0) }}%
            </div>
            <div
              class="text-sm text-gray-500 uppercase tracking-wide font-medium"
            >
              Tingkat Hunian
            </div>
          </div>
        </div>

        <!-- General Information -->
        <div
          class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 space-y-6"
        >
          <h3
            class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"
          >
            <UIcon
              name="i-heroicons-information-circle"
              class="text-primary-500"
            />
            Informasi Umum
          </h3>

          <!-- Description -->
          <div class="space-y-4">
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >Deskripsi</label
            >
            <UTextarea
              v-model="form.description"
              variant="none"
              placeholder="Deskripsikan properti Anda di sini..."
              :rows="4"
              class="w-full text-gray-600 dark:text-gray-300 text-lg leading-relaxed bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 focus:ring-2 ring-primary-500 transition-all"
            />
          </div>

          <div class="border-t border-gray-100 dark:border-gray-800"></div>

          <!-- Cover Image -->
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <label
                class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >URL Gambar Cover</label
              >
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-heroicons-eye"
                @click="isPreviewOpen = true"
                >Pratinjau</UButton
              >
            </div>
            <UInput
              v-model="form.image"
              icon="i-heroicons-photo"
              class="w-full"
              placeholder="https://..."
            />
            <p class="text-xs text-gray-500">
              Tempelkan URL untuk memperbarui gambar latar belakang.
            </p>
          </div>
        </div>

        <!-- Billing Configuration -->
        <div
          class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-8"
        >
          <div class="flex items-center justify-between mb-6">
            <h3
              class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"
            >
              <UIcon name="i-heroicons-banknotes" class="text-primary-500" />
              Konfigurasi Tagihan
            </h3>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500">{{
                form.useCustomSettings ? "Tarif Khusus" : "Tarif Global"
              }}</span>
              <USwitch v-model="form.useCustomSettings" />
            </div>
          </div>

          <div
            :class="{
              'opacity-50 pointer-events-none grayscale':
                !form.useCustomSettings,
            }"
            class="grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-300"
          >
            <div class="space-y-2">
              <label
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >Listrik / kWh</label
              >
              <UInput
                v-model="form.costPerKwh"
                type="number"
                icon="i-heroicons-bolt"
                size="lg"
                class="w-full"
              >
                <template #trailing
                  ><span class="text-gray-500 text-xs">IDR</span></template
                >
              </UInput>
            </div>
            <div class="space-y-2">
              <label
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >Biaya Air / bulan</label
              >
              <UInput
                v-model="form.waterFee"
                type="number"
                icon="i-heroicons-beaker"
                size="lg"
                class="w-full"
              >
                <template #trailing
                  ><span class="text-gray-500 text-xs">IDR</span></template
                >
              </UInput>
            </div>
            <div class="space-y-2">
              <label
                class="text-sm font-medium text-gray-700 dark:text-gray-300"
                >Biaya Sampah / bulan</label
              >
              <UInput
                v-model="form.trashFee"
                type="number"
                icon="i-heroicons-trash"
                size="lg"
                class="w-full"
              >
                <template #trailing
                  ><span class="text-gray-500 text-xs">IDR</span></template
                >
              </UInput>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Col: Quick Actions & Image URL -->
      <div class="space-y-6">
        <!-- Room Management Card -->
        <div
          class="bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl shadow-lg p-6 text-white relative overflow-hidden group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer"
          @click="navigateTo(`/rooms?propertyId=${propertyId}`)"
        >
          <!-- Decorative Background -->
          <div
            class="absolute -right-8 -bottom-8 opacity-10 transform rotate-12 group-hover:rotate-6 group-hover:scale-110 transition-transform duration-700"
          >
            <UIcon name="i-heroicons-key" class="w-48 h-48" />
          </div>

          <div class="relative z-10">
            <div class="flex items-start justify-between mb-4">
              <div class="bg-white/20 backdrop-blur-sm p-3 rounded-2xl">
                <UIcon
                  name="i-heroicons-home-modern"
                  class="w-8 h-8 text-white"
                />
              </div>
              <span
                class="bg-white/10 text-xs font-bold px-3 py-1 rounded-full backdrop-blur-md border border-white/20"
              >
                {{ property?.roomCount || 0 }} Kamar
              </span>
            </div>

            <h3 class="text-2xl font-bold mb-2">Kelola Kamar</h3>
            <p class="text-primary-100/90 text-sm mb-6 leading-relaxed">
              Kontrol hunian, kelola penghuni, dan handle tagihan bulanan secara efisien.
            </p>
          </div>
        </div>

        <!-- Actions Card -->
        <div
          class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 space-y-3"
        >
          <h3 class="font-bold text-gray-900 dark:text-white mb-4">
            Aksi Properti
          </h3>
          <UButton
            color="neutral"
            variant="solid"
            block
            size="lg"
            icon="i-heroicons-check"
            class="dark:bg-white dark:text-black"
            :loading="isSaving"
            @click="saveChanges"
            >Simpan Perubahan</UButton
          >
          <UButton
            color="error"
            variant="soft"
            block
            icon="i-heroicons-trash"
            @click="deleteProperty"
            >Hapus Properti</UButton
          >
        </div>

        <!-- Location -->
        <div
          class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6"
        >
          <h3
            class="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"
          >
            <UIcon name="i-heroicons-map" class="text-primary-500" />
            Lokasi
          </h3>

          <div class="space-y-4">
            <UInput
              v-model="form.mapUrl"
              icon="i-heroicons-link"
              placeholder="Tempel URL Embed"
              class="text-sm w-full"
            />
            <p class="text-xs text-gray-500">
              Jika tidak disediakan, peta akan ditampilkan berdasarkan alamat.
            </p>

            <div
              class="w-full h-40 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            >
              <iframe
                width="100%"
                height="100%"
                frameborder="0"
                style="border: 0"
                :src="
                  form.mapUrl ||
                  `https://maps.google.com/maps?q=${encodeURIComponent(form.address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`
                "
                allowfullscreen
              ></iframe>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Image Preview Modal -->
    <UModal
      v-model:open="isPreviewOpen"
      :ui="{ content: 'sm:max-w-4xl' }"
      title="Pratinjau Gambar Cover"
      description="Tampilan ukuran penuh dari gambar cover properti"
    >
      <template #content>
        <div class="p-1">
          <img :src="form.image" class="w-full h-auto rounded-lg" />
        </div>
      </template>
    </UModal>
    
    <ConfirmDialog ref="confirmDialog" />
  </div>
</template>
