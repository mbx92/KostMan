<script setup lang="ts">
interface User {
  id: string
  name: string
  email: string
  role: string
  status?: string
  createdAt: string
  updatedAt: string
}


const toast = useToast()
const page = ref(1)
const pageCount = ref(10)
const search = ref('')
const debouncedSearch = refDebounced(search, 300)

const queryParams = computed(() => ({
  page: page.value,
  limit: pageCount.value,
  search: debouncedSearch.value || undefined,
  role: undefined, // Add role filter if needed later
}))

const { data: userData, pending: loading, refresh } = await useFetch<any>('/api/users', {
  query: queryParams,
  watch: [page, debouncedSearch]
})

const users = computed<User[]>(() => userData.value?.users || [])
const totalUsers = computed(() => userData.value?.pagination?.total || 0)

// Reset page when search changes
watch(debouncedSearch, () => {
  page.value = 1
})

const isModalOpen = ref(false)
const selectedUser = ref<User | undefined>(undefined)

// Delete Modal
const isDeleteModalOpen = ref(false)
const userToDelete = ref<User | null>(null)
const deleteLoading = ref(false)

// Suspend Modal
const isSuspendModalOpen = ref(false)
const userToSuspend = ref<User | null>(null)
const suspendLoading = ref(false)

// Reset Password Modal
const isResetPasswordModalOpen = ref(false)
const userToReset = ref<User | null>(null)
const resetPasswordLoading = ref(false)
const newPassword = ref('') 

const openAddModal = () => {
    selectedUser.value = undefined
    isModalOpen.value = true
}

const openEditModal = (user: User) => {
    selectedUser.value = user
    isModalOpen.value = true
}

const openDeleteModal = (user: User) => {
    userToDelete.value = user
    isDeleteModalOpen.value = true
}

const openSuspendModal = (user: User) => {
    userToSuspend.value = user
    isSuspendModalOpen.value = true
}

const openResetPasswordModal = (user: User) => {
    userToReset.value = user
    newPassword.value = ''
    isResetPasswordModalOpen.value = true
}

const confirmDelete = async () => {
    if (!userToDelete.value) return
    deleteLoading.value = true
    try {
        await $fetch(`/api/users/${userToDelete.value.id}`, { method: 'DELETE' })
        toast.add({ title: 'User deleted', color: 'success' })
        isDeleteModalOpen.value = false
        refresh()
    } catch (e: any) {
        toast.add({ title: 'Error', description: e.data?.message || 'Failed to delete user', color: 'error' })
    } finally {
        deleteLoading.value = false
    }
}

const confirmSuspend = async () => {
    if (!userToSuspend.value) return
    suspendLoading.value = true
    try {
        const newStatus = userToSuspend.value.status === 'suspended' ? 'active' : 'suspended'
        await $fetch(`/api/users/${userToSuspend.value.id}`, { 
            method: 'PUT',
            body: { status: newStatus }
        })
        toast.add({ title: `User ${newStatus === 'active' ? 'activated' : 'suspended'}`, color: 'success' })
        isSuspendModalOpen.value = false
        refresh()
    } catch (e: any) {
        toast.add({ title: 'Error', description: e.data?.message || 'Failed to update status', color: 'error' })
    } finally {
        suspendLoading.value = false
    }
}

const confirmResetPassword = async () => {
    if (!userToReset.value) return
    resetPasswordLoading.value = true
    try {
        const res: any = await $fetch(`/api/users/${userToReset.value.id}/reset-password`, { method: 'POST' })
        newPassword.value = res.newPassword
        toast.add({ title: 'Success', description: 'Password reset successfully', color: 'success' })
    } catch (e: any) {
        toast.add({ title: 'Error', description: e.data?.message || 'Failed to reset password', color: 'error' })
    } finally {
        resetPasswordLoading.value = false
    }
}

const closeResetModal = () => {
    isResetPasswordModalOpen.value = false
    newPassword.value = ''
    userToReset.value = null
}

const columns = [
    { accessorKey: 'name', header: 'Nama' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'role', header: 'Role' },
    { accessorKey: 'status', header: 'Status' },
    { id: 'actions', header: 'Aksi' }
]

const getRoleColor = (role: string) => {
    switch (role) {
        case 'owner': return 'primary'
        case 'admin': return 'info'
        case 'staff': return 'neutral'
        default: return 'neutral'
    }
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
           <UIcon name="i-heroicons-user-group" class="w-8 h-8 text-primary-500" />
           Manajemen Pengguna
        </h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">Kelola akses pengguna aplikasi.</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-3">
        <UInput v-model="search" icon="i-heroicons-magnifying-glass" placeholder="Cari user..." class="w-full sm:w-64" />
        <UButton icon="i-heroicons-plus" size="md" @click="openAddModal">Tambah User</UButton>
      </div>
    </div>

    <!-- Users Table -->
    <UCard>
        <UTable :data="users" :columns="columns" :loading="loading">
            <template #role-cell="{ row }">
                <UBadge :color="getRoleColor(row.original.role)" variant="subtle" class="capitalize">
                    {{ row.original.role }}
                </UBadge>
            </template>
            <template #status-cell="{ row }">
                <UBadge :color="row.original.status === 'suspended' ? 'error' : 'success'" variant="subtle" class="capitalize">
                    {{ row.original.status || 'active' }}
                </UBadge>
            </template>
            <template #actions-cell="{ row }">
                <div class="flex gap-2">
                    <UButton 
                        :color="row.original.status === 'suspended' ? 'success' : 'warning'" 
                        variant="ghost" 
                        :icon="row.original.status === 'suspended' ? 'i-heroicons-play' : 'i-heroicons-pause'" 
                        size="xs" 
                        @click="openSuspendModal(row.original)" 
                        :title="row.original.status === 'suspended' ? 'Aktifkan' : 'Suspend'" 
                    />
                    <UButton color="warning" variant="ghost" icon="i-heroicons-key" size="xs" @click="openResetPasswordModal(row.original)" title="Reset Password" />
                    <UButton color="neutral" variant="ghost" icon="i-heroicons-pencil-square" size="xs" @click="openEditModal(row.original)" />
                    <UButton color="error" variant="ghost" icon="i-heroicons-trash" size="xs" @click="openDeleteModal(row.original)" />
                </div>
            </template>
        </UTable>
        <!-- Pagination -->
        <div class="flex justify-end px-4 py-4 border-t border-gray-200 dark:border-gray-700">
            <UPagination
                v-model="page"
                :page-count="pageCount"
                :total="totalUsers"
            />
        </div>
    </UCard>

    <UsersUserModal v-model="isModalOpen" :user="selectedUser" @success="refresh" />

    <!-- Delete Modal -->
    <UModal v-model:open="isDeleteModalOpen" title="Hapus User">
        <template #content>
            <div class="p-6">
                <p>Apakah Anda yakin ingin menghapus user <strong>{{ userToDelete?.name }}</strong>?</p>
                <div class="mt-4 p-3 bg-error-50 text-error-600 rounded text-sm">
                    Tindakan ini tidak dapat dibatalkan.
                </div>
                <div class="flex justify-end gap-3 mt-6">
                    <UButton color="neutral" variant="ghost" @click="isDeleteModalOpen = false">Batal</UButton>
                    <UButton color="error" :loading="deleteLoading" @click="confirmDelete">Hapus</UButton>
                </div>
            </div>
        </template>
    </UModal>

    <!-- Suspend Modal -->
    <UModal v-model:open="isSuspendModalOpen" :title="userToSuspend?.status === 'suspended' ? 'Aktifkan User' : 'Suspend User'">
        <template #content>
            <div class="p-6">
                <p v-if="userToSuspend?.status !== 'suspended'">
                    Apakah Anda yakin ingin menonaktifkan user <strong>{{ userToSuspend?.name }}</strong>?
                    <br>
                    <span class="text-sm text-gray-500">User tidak akan bisa login ke aplikasi.</span>
                </p>
                <p v-else>
                    Apakah Anda yakin ingin mengaktifkan kembali user <strong>{{ userToSuspend?.name }}</strong>?
                </p>
                
                <div class="flex justify-end gap-3 mt-6">
                    <UButton color="neutral" variant="ghost" @click="isSuspendModalOpen = false">Batal</UButton>
                    <UButton 
                        :color="userToSuspend?.status === 'suspended' ? 'success' : 'warning'" 
                        :loading="suspendLoading" 
                        @click="confirmSuspend"
                    >
                        {{ userToSuspend?.status === 'suspended' ? 'Aktifkan' : 'Suspend' }}
                    </UButton>
                </div>
            </div>
        </template>
    </UModal>

    <!-- Reset Password Modal -->
    <UModal v-model:open="isResetPasswordModalOpen" :prevent-close="!!newPassword" title="Reset Password">
        <template #content>
            <div class="p-6">
                <div v-if="!newPassword">
                    <p>Apakah Anda yakin ingin mereset password untuk user <strong>{{ userToReset?.name }}</strong>?</p>
                    <p class="text-sm text-gray-500 mt-2">Password baru akan digenerate secara otomatis.</p>
                </div>
                
                <div v-else class="text-center space-y-4">
                    <UIcon name="i-heroicons-check-circle" class="w-12 h-12 text-success-500" />
                    <p class="font-medium">Password berhasil direset!</p>
                    <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <p class="text-xs text-gray-500 mb-1 uppercase tracking-wide">Password Baru</p>
                        <p class="text-xl font-mono font-bold select-all text-primary-600 dark:text-primary-400">{{ newPassword }}</p>
                    </div>
                    <p class="text-xs text-error-500">Harap simpan password ini. Password tidak akan ditampilkan lagi setelah modal ditutup.</p>
                </div>

                <div class="flex justify-end gap-3 mt-6">
                    <template v-if="!newPassword">
                        <UButton color="neutral" variant="ghost" @click="closeResetModal" :disabled="resetPasswordLoading">Batal</UButton>
                        <UButton color="warning" :loading="resetPasswordLoading" @click="confirmResetPassword">Reset Password</UButton>
                    </template>
                    <template v-else>
                        <UButton color="primary" @click="closeResetModal">Tutup</UButton>
                    </template>
                </div>
            </div>
        </template>
    </UModal>
  </div>
</template>
