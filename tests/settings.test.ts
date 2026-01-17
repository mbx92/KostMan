import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';

describe('Settings API', async () => {
    await setup({
        server: true,
    });

    let authToken: string;
    let adminToken: string;

    beforeAll(async () => {
        // Register and login as admin
        await $fetch('/api/auth/register', {
            method: 'POST',
            body: {
                email: 'admin-settings@test.com',
                password: 'password123',
                name: 'Admin User',
                role: 'admin',
            },
        });

        const loginResponse = await $fetch('/api/auth/login', {
            method: 'POST',
            body: {
                email: 'admin-settings@test.com',
                password: 'password123',
            },
        });

        adminToken = loginResponse.token;

        // Register and login as regular owner
        await $fetch('/api/auth/register', {
            method: 'POST',
            body: {
                email: 'owner-settings@test.com',
                password: 'password123',
                name: 'Owner User',
                role: 'owner',
            },
        });

        const ownerLogin = await $fetch('/api/auth/login', {
            method: 'POST',
            body: {
                email: 'owner-settings@test.com',
                password: 'password123',
            },
        });

        authToken = ownerLogin.token;
    });

    describe('GET /api/settings', () => {
        it('should return empty settings object initially', async () => {
            const settings = await $fetch('/api/settings', {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
            });

            expect(settings).toBeDefined();
            expect(typeof settings).toBe('object');
        });

        it('should require authentication', async () => {
            await expect(
                $fetch('/api/settings')
            ).rejects.toThrow();
        });
    });

    describe('PUT /api/settings', () => {
        it('should update settings as admin', async () => {
            const response = await $fetch('/api/settings', {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                },
                body: {
                    defaultCostPerKwh: '1500',
                    defaultWaterFee: '50000',
                    defaultTrashFee: '25000',
                    companyName: 'KostMan Inc',
                },
            });

            expect(response.message).toBe('Settings updated successfully');
            expect(response.updated).toBe(4);
            expect(response.settings).toHaveLength(4);
        });

        it('should retrieve updated settings', async () => {
            const settings = await $fetch('/api/settings', {
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                },
            });

            expect(settings.defaultCostPerKwh).toBeDefined();
            expect(settings.defaultCostPerKwh.value).toBe('1500');
            expect(settings.companyName.value).toBe('KostMan Inc');
        });

        it('should reject non-admin users', async () => {
            await expect(
                $fetch('/api/settings', {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: {
                        testSetting: 'test',
                    },
                })
            ).rejects.toThrow();
        });

        it('should validate input', async () => {
            await expect(
                $fetch('/api/settings', {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                    },
                    body: {
                        '': 'invalid', // Empty key
                    },
                })
            ).rejects.toThrow();
        });

        it('should update existing settings', async () => {
            // First update
            await $fetch('/api/settings', {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                },
                body: {
                    testKey: 'value1',
                },
            });

            // Second update (should update, not create new)
            const response = await $fetch('/api/settings', {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                },
                body: {
                    testKey: 'value2',
                },
            });

            expect(response.updated).toBe(1);

            const settings = await $fetch('/api/settings', {
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                },
            });

            expect(settings.testKey.value).toBe('value2');
        });
    });
});
