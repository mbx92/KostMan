import { z } from 'zod';

export const settingSchema = z.object({
    key: z.string().min(1, 'Key is required').max(100, 'Key must be at most 100 characters'),
    value: z.string().min(1, 'Value is required').max(500, 'Value must be at most 500 characters'),
    description: z.string().max(255, 'Description must be at most 255 characters').optional(),
});

export const updateSettingsSchema = z.record(
    z.string().min(1, 'Key is required'),
    z.string().min(1, 'Value is required')
);

export type SettingInput = z.infer<typeof settingSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
