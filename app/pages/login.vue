<script setup lang="ts">
definePageMeta({
  layout: false,
});

const toast = useToast();
const isLoading = ref(false);
const config = useRuntimeConfig();

const form = reactive({
  email: "",
  password: "",
});

const errorMessage = ref("");
const isDev = computed(() => config.public.NODE_ENV === 'development' || import.meta.dev);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureSessionReady = async () => {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await $fetch('/api/auth/me', {
        credentials: 'include',
      });
      return;
    } catch {
      if (attempt === 3) {
        throw new Error('Session cookie was not available after login');
      }

      await wait(150 * (attempt + 1));
    }
  }
};

// Fill dev credentials
const fillDevCredentials = () => {
  form.email = "admin@example.com";
  form.password = "password123";
  toast.add({
    title: "Dev credentials filled",
    description: "Ready to login with admin account",
    color: "primary",
  });
};

const handleLogin = async () => {
  if (!form.email || !form.password) {
    errorMessage.value = "Email and password are required";
    return;
  }

  errorMessage.value = "";
  isLoading.value = true;

  try {
    const response = await $fetch<{ token: string, user: any }>("/api/auth/login", {
      method: "POST",
      credentials: 'include',
      body: {
        email: form.email,
        password: form.password,
      },
    });

    // Show success message
    toast.add({
      title: "Login successful",
      description: `Welcome back, ${response.user.name}!`,
      color: "success",
    });

    // Safari can lag slightly before the HttpOnly session cookie becomes available.
    await ensureSessionReady();
    window.location.href = '/'
  } catch (error: any) {
    // Handle error
    const message = error.data?.statusMessage || error.message || "Login failed";
    errorMessage.value = message;
    
    toast.add({
      title: "Login failed",
      description: message,
      color: "error",
    });
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex">
    <!-- Left Side - Image -->
    <div class="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gray-900">
      <img
        src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=2340&q=80"
        alt="Kos Interior"
        class="absolute inset-0 w-full h-full object-cover opacity-80"
      />
      <div
        class="absolute inset-0 bg-linear-to-t from-gray-900 via-transparent to-transparent"
      />

      <div
        class="relative z-10 p-12 flex flex-col justify-end h-full text-white"
      >
        <h1 class="text-4xl font-bold mb-4">Manage Your Kos Effortlessly</h1>
        <p class="text-lg text-gray-300">
          The most comprehensive solution for boarding house management. Track
          payments, manage rooms, and monitor electricity usage in one place.
        </p>
      </div>
    </div>

    <!-- Right Side - Login Form -->
    <div
      class="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-gray-950"
    >
      <div class="w-full max-w-md space-y-8">
        <div class="text-center">
          <div class="w-16 h-16 rounded-2xl bg-green-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <UIcon name="i-heroicons-home-modern" class="w-9 h-9 text-white" />
          </div>
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white">
            KostMan
          </h2>
          <p class="mt-2 text-gray-600 dark:text-gray-400">
            Masuk ke akun Anda
          </p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-6 mt-8">
          <!-- Error Message -->
          <UAlert
            v-if="errorMessage"
            color="error"
            variant="soft"
            :title="errorMessage"
            :close-button="{ icon: 'i-heroicons-x-mark-20-solid', color: 'red', variant: 'link' }"
            @close="errorMessage = ''"
          />

          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <UInput 
              v-model="form.email" 
              type="email"
              icon="i-heroicons-envelope" 
              placeholder="admin@example.com" 
              size="lg"
              class="w-full"
              autofocus
              required
            />
          </div>

          <div class="space-y-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            <UInput 
              v-model="form.password" 
              type="password" 
              icon="i-heroicons-lock-closed" 
              placeholder="••••••••" 
              size="lg"
              class="w-full"
              required
            />
          </div>

          <div class="flex items-center justify-between">
            <UCheckbox label="Remember me" />
            <a
              href="#"
              class="text-sm text-primary-500 hover:text-primary-600 font-medium"
              >Forgot password?</a
            >
          </div>

          <UButton
            type="submit"
            block
            size="lg"
            :loading="isLoading"
            class="font-bold"
          >
            Sign in
          </UButton>

          <!-- Dev Credentials Button (Only in Development) -->
          <UButton
            v-if="isDev"
            type="button"
            block
            size="lg"
            variant="outline"
            color="primary"
            icon="i-heroicons-code-bracket"
            @click="fillDevCredentials"
          >
            Fill Dev Credentials
          </UButton>
        </form>

        <p class="text-center text-sm text-gray-500 dark:text-gray-400">
          Don't have an account?
          <a
            href="#"
            class="text-primary-500 hover:text-primary-600 font-medium"
            >Contact Support</a
          >
        </p>
      </div>
    </div>
  </div>
</template>
