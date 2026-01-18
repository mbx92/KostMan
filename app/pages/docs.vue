<script setup lang="ts">
import { useKosStore } from '~/stores/kos';

const kosStore = useKosStore();

// Check authentication from API (cookie-based)
const { data: authData, error } = await useFetch('/api/auth/me');

if (error.value || !authData.value) {
  await navigateTo('/login');
}

// Fetch documentation list
const { data: docsList } = await useFetch<{ name: string; title: string; category: string }[]>('/api/docs');

// State
const selectedDoc = ref<string | null>(null);
const searchQuery = ref('');
const selectedCategory = ref<string>('all');

// Fetch selected document content
const { data: docContent, pending: loadingDoc } = await useFetch<{ content: string; metadata: any }>(() => `/api/docs/${selectedDoc.value}`, {
  watch: [selectedDoc],
  immediate: false,
});

// Categories
const categories = computed(() => {
  if (!docsList.value) return [];
  const cats = new Set(docsList.value.map(doc => doc.category));
  return ['all', ...Array.from(cats)];
});

// Filtered documents
const filteredDocs = computed(() => {
  if (!docsList.value) return [];
  
  let docs = docsList.value;
  
  // Filter by category
  if (selectedCategory.value !== 'all') {
    docs = docs.filter(doc => doc.category === selectedCategory.value);
  }
  
  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    docs = docs.filter(doc => 
      doc.title.toLowerCase().includes(query) || 
      doc.name.toLowerCase().includes(query)
    );
  }
  
  return docs;
});

// Group documents by category
const groupedDocs = computed(() => {
  const groups: Record<string, typeof filteredDocs.value> = {};
  
  filteredDocs.value.forEach(doc => {
    if (!groups[doc.category]) {
      groups[doc.category] = [];
    }
    groups[doc.category].push(doc);
  });
  
  return groups;
});

// Select first document on mount
onMounted(() => {
  if (docsList.value && docsList.value.length > 0) {
    selectedDoc.value = docsList.value[0].name;
  }
});

// Format category name
const formatCategory = (category: string) => {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Sidebar collapsed state
const sidebarCollapsed = ref(false);
</script>

<template>
  <div class="flex h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-950">
    <!-- Sidebar -->
    <aside 
      class="border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-300 overflow-hidden"
      :class="sidebarCollapsed ? 'w-0' : 'w-80'"
    >
      <div class="flex flex-col h-full">
        <!-- Header -->
        <div class="p-4 border-b border-gray-200 dark:border-gray-800">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-gray-900 dark:text-white">Documentation</h2>
            <UButton
              icon="i-heroicons-x-mark"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="sidebarCollapsed = true"
              class="lg:hidden"
            />
          </div>
          
          <!-- Search -->
          <UInput
            v-model="searchQuery"
            icon="i-heroicons-magnifying-glass"
            placeholder="Search docs..."
            class="mb-3"
          />
          
          <!-- Category Filter -->
          <USelectMenu
            v-model="selectedCategory"
            :options="categories.map(cat => ({ label: formatCategory(cat), value: cat }))"
            placeholder="Filter by category"
            size="sm"
          />
        </div>
        
        <!-- Document List -->
        <nav class="flex-1 overflow-y-auto p-4">
          <div v-if="filteredDocs.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-8">
            No documents found
          </div>
          
          <div v-else-if="selectedCategory === 'all'" class="space-y-6">
            <div v-for="(docs, category) in groupedDocs" :key="category">
              <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                {{ formatCategory(category) }}
              </h3>
              <ul class="space-y-1">
                <li v-for="doc in docs" :key="doc.name">
                  <button
                    @click="selectedDoc = doc.name"
                    class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                    :class="[
                      selectedDoc === doc.name
                        ? 'bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    ]"
                  >
                    {{ doc.title }}
                  </button>
                </li>
              </ul>
            </div>
          </div>
          
          <ul v-else class="space-y-1">
            <li v-for="doc in filteredDocs" :key="doc.name">
              <button
                @click="selectedDoc = doc.name"
                class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                :class="[
                  selectedDoc === doc.name
                    ? 'bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                ]"
              >
                {{ doc.title }}
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
    
    <!-- Main Content -->
    <main class="flex-1 overflow-hidden flex flex-col">
      <!-- Toolbar -->
      <div class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UButton
            v-if="sidebarCollapsed"
            icon="i-heroicons-bars-3"
            color="neutral"
            variant="ghost"
            @click="sidebarCollapsed = false"
          />
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">
            {{ docsList?.find(d => d.name === selectedDoc)?.title || 'Documentation' }}
          </h1>
        </div>
        
        <div class="flex items-center gap-2">
          <UBadge v-if="docsList?.find(d => d.name === selectedDoc)" color="neutral" variant="subtle">
            {{ formatCategory(docsList.find(d => d.name === selectedDoc)!.category) }}
          </UBadge>
        </div>
      </div>
      
      <!-- Document Content -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="loadingDoc" class="flex items-center justify-center h-full">
          <div class="text-center">
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 text-primary-500 animate-spin mb-2" />
            <p class="text-gray-500 dark:text-gray-400">Loading document...</p>
          </div>
        </div>
        
        <div v-else-if="!selectedDoc" class="flex items-center justify-center h-full">
          <div class="text-center max-w-md">
            <UIcon name="i-heroicons-document-text" class="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Document Selected</h3>
            <p class="text-gray-500 dark:text-gray-400">Select a document from the sidebar to view its content.</p>
          </div>
        </div>
        
        <article v-else-if="docContent" class="prose prose-gray dark:prose-invert max-w-4xl mx-auto px-6 py-8">
          <div v-html="docContent.content" />
        </article>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Additional documentation-specific styles */
:deep(.prose) {
  max-width: 100%;
}

:deep(.prose pre) {
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 1rem;
  overflow-x: auto;
}

:deep(.prose code) {
  background-color: #f1f5f9;
  color: #0ea5e9;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

:deep(.prose pre code) {
  background-color: transparent;
  color: #e2e8f0;
  padding: 0;
}

:deep(.prose h1) {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.5rem;
}

:deep(.prose h2) {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.5rem;
  margin-top: 2rem;
}

:deep(.prose a) {
  color: #0ea5e9;
  text-decoration: none;
}

:deep(.prose a:hover) {
  text-decoration: underline;
}

:deep(.prose blockquote) {
  border-left: 4px solid #0ea5e9;
  background-color: #f0f9ff;
  padding: 1rem;
}

:deep(.prose table) {
  border: 1px solid #e5e7eb;
  border-collapse: collapse;
  width: 100%;
}

:deep(.prose th) {
  background-color: #f9fafb;
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
}

:deep(.prose td) {
  border-top: 1px solid #e5e7eb;
  padding: 0.75rem;
}

/* Dark mode overrides */
:deep(.dark .prose pre) {
  background-color: #0f172a;
  border-color: #1e293b;
}

:deep(.dark .prose code) {
  background-color: #1e293b;
  color: #38bdf8;
}

:deep(.dark .prose h1),
:deep(.dark .prose h2) {
  border-color: #374151;
}

:deep(.dark .prose blockquote) {
  background-color: rgba(14, 165, 233, 0.1);
}

:deep(.dark .prose table) {
  border-color: #374151;
}

:deep(.dark .prose th) {
  background-color: #1f2937;
  border-color: #374151;
}

:deep(.dark .prose td) {
  border-color: #374151;
}
</style>
