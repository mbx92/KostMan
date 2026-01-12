<script setup lang="ts">
import { useKosStore, type Property } from "~/stores/kos";

const route = useRoute();
const router = useRouter();
const store = useKosStore();
const toast = useToast();

const propertyId = computed(() => route.params.id as string);
const property = computed(() => store.getPropertyById(propertyId.value));
const rooms = computed(() => store.getRoomsByPropertyId(propertyId.value));

// Redirect if property not found
watch(
  property,
  (newProperty) => {
    if (!newProperty && propertyId.value) {
      router.push("/properties");
    }
  },
  { immediate: true }
);

const isPreviewOpen = ref(false); // Added isPreviewOpen ref

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

// Sync form with property data when loaded, but only if not dirty (simplified for now: just sync on load)
watch(
  property,
  (p) => {
    if (p) {
      // Only update if seemingly empty to avoid overwriting user typing (basic safeguard)
      if (!form.name) {
        form.name = p.name;
        form.address = p.address;
        form.description = p.description;
        form.image = p.image;
        form.mapUrl = (p as any).mapUrl || "";
        form.useCustomSettings = !!p.settings;
        form.costPerKwh = p.settings?.costPerKwh || store.settings.costPerKwh;
        form.trashFee = p.settings?.trashFee || store.settings.trashFee;
        form.waterFee = p.settings?.waterFee || store.settings.waterFee;
      }
    }
  },
  { immediate: true }
);

const saveChanges = () => {
  const updates: Partial<Property> & { mapUrl?: string } = {
    name: form.name,
    address: form.address,
    description: form.description,
    image: form.image,
    mapUrl: form.mapUrl,
  };

  if (form.useCustomSettings) {
    updates.settings = {
      costPerKwh: form.costPerKwh,
      trashFee: form.trashFee,
      waterFee: form.waterFee,
    };
  } else {
    updates.settings = undefined;
  }

  store.updateProperty(propertyId.value, updates);
  toast.add({
    title: "Changes Saved",
    description: "Property details updated successfully.",
    color: "success",
  });
};

const deleteProperty = () => {
  if (
    confirm(
      `Delete "${property.value?.name}"? This will also delete ${rooms.value.length} room(s).`
    )
  ) {
    store.deleteProperty(propertyId.value);
    router.push("/properties");
  }
};

const occupiedRooms = computed(
  () => rooms.value.filter((r) => r.status === "occupied").length
);
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
          color="white"
          icon="i-heroicons-arrow-left"
          >Back to Properties</UButton
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
              placeholder="Property Name"
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
              placeholder="Property Address"
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
              {{ rooms.length }}
            </div>
            <div
              class="text-xs text-gray-500 uppercase tracking-wide font-medium"
            >
              Total Rooms
            </div>
          </div>
          <div
            class="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 p-4 text-center"
          >
            <div class="text-2xl font-bold text-primary-500">
              {{ occupiedRooms }}
            </div>
            <div
              class="text-xs text-gray-500 uppercase tracking-wide font-medium"
            >
              Occupied
            </div>
          </div>
          <div
            class="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 p-4 text-center"
          >
            <div class="text-2xl font-bold text-green-500">
              {{ Math.round((occupiedRooms / (rooms.length || 1)) * 100) }}%
            </div>
            <div
              class="text-xs text-gray-500 uppercase tracking-wide font-medium"
            >
              Occupancy
            </div>
          </div>
        </div>
        <!-- Desktop stats bar -->
        <div
          class="hidden md:flex bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 p-6 items-center justify-around"
        >
          <div class="text-center">
            <div class="text-3xl font-bold text-gray-900 dark:text-white">
              {{ rooms.length }}
            </div>
            <div
              class="text-sm text-gray-500 uppercase tracking-wide font-medium"
            >
              Total Rooms
            </div>
          </div>
          <div class="w-px h-12 bg-gray-200 dark:bg-gray-800"></div>
          <div class="text-center">
            <div class="text-3xl font-bold text-primary-500">
              {{ occupiedRooms }}
            </div>
            <div
              class="text-sm text-gray-500 uppercase tracking-wide font-medium"
            >
              Occupied
            </div>
          </div>
          <div class="w-px h-12 bg-gray-200 dark:bg-gray-800"></div>
          <div class="text-center">
            <div class="text-3xl font-bold text-green-500">
              {{ Math.round((occupiedRooms / (rooms.length || 1)) * 100) }}%
            </div>
            <div
              class="text-sm text-gray-500 uppercase tracking-wide font-medium"
            >
              Occupancy
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
            General Information
          </h3>

          <!-- Description -->
          <div class="space-y-4">
            <label
              class="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >Description</label
            >
            <UTextarea
              v-model="form.description"
              variant="none"
              placeholder="Describe your property here..."
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
                >Cover Image URL</label
              >
              <UButton
                size="xs"
                color="gray"
                variant="ghost"
                icon="i-heroicons-eye"
                @click="isPreviewOpen = true"
                >Preview</UButton
              >
            </div>
            <UInput
              v-model="form.image"
              icon="i-heroicons-photo"
              class="w-full"
              placeholder="https://..."
            />
            <p class="text-xs text-gray-500">
              Paste a URL to update the hero background.
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
              Billing Configuration
            </h3>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-500">{{
                form.useCustomSettings ? "Custom Rates" : "Global Rates"
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
                >Electricity / kWh</label
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
                >Water Fee / mo</label
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
                >Trash Fee / mo</label
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
                {{ rooms.length }} Rooms
              </span>
            </div>

            <h3 class="text-2xl font-bold mb-2">Manage Rooms</h3>
            <p class="text-primary-100/90 text-sm mb-6 leading-relaxed">
              Control occupancy, manage tenants, and handle monthly billing
              efficiently.
            </p>
          </div>
        </div>

        <!-- Actions Card -->
        <div
          class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 space-y-3"
        >
          <h3 class="font-bold text-gray-900 dark:text-white mb-4">
            Property Actions
          </h3>
          <UButton
            color="black"
            variant="solid"
            block
            size="lg"
            icon="i-heroicons-check"
            class="dark:bg-white dark:text-black"
            @click="saveChanges"
            >Save Changes</UButton
          >
          <UButton
            color="error"
            variant="soft"
            block
            icon="i-heroicons-trash"
            @click="deleteProperty"
            >Delete Property</UButton
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
            Location
          </h3>

          <div class="space-y-4">
            <UInput
              v-model="form.mapUrl"
              icon="i-heroicons-link"
              placeholder="Paste Embed URL"
              class="text-sm w-full"
            />
            <p class="text-xs text-gray-500">
              If not provided, map will be displayed based on the address.
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
      :ui="{ width: 'w-full sm:max-w-4xl' }"
      title="Cover Image Preview"
      description="Full size view of the property cover image"
    >
      <template #content>
        <div class="p-1">
          <img :src="form.image" class="w-full h-auto rounded-lg" />
        </div>
      </template>
    </UModal>
  </div>
</template>
