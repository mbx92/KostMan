import { db } from '../../utils/drizzle';
import { rooms, meterReadings, globalSettings } from '../../database/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { calculateMonthsCovered } from '../../utils/billing';
import { z } from 'zod';

const calculateUtilitySchema = z.object({
    roomId: z.string().uuid(),
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export default defineEventHandler(async (event) => {
    // Check authentication
    if (!event.context.user) {
        throw createError({ statusCode: 401, message: 'Unauthorized' });
    }

    const body = await readBody(event);
    const { roomId, periodStart, periodEnd } = calculateUtilitySchema.parse(body);

    // Get room data for trash service flag
    const room = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
    if (!room.length) throw createError({ statusCode: 404, message: 'Room not found' });

    // Get global settings for rates
    const settings = await db.select().from(globalSettings).limit(1);
    const rates = settings.length ? settings[0] : {
        costPerKwh: '1500',
        waterFee: '50000',
        trashFee: '25000'
    };

    const utilityItems = [];
    const monthsCovered = calculateMonthsCovered(periodStart, periodEnd);

    // 1. Electricity (Listrik) - Based on Meter Readings
    // We reuse logic from billing utils, but here we want to return items format
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const costPerKwh = parseFloat(rates.costPerKwh || '1500');

    // Get meter readings in range
    const readings = await db.select()
        .from(meterReadings)
        .where(
            and(
                eq(meterReadings.roomId, roomId),
                gte(meterReadings.period, start.toISOString().slice(0, 7)), // Compare YYYY-MM
                lte(meterReadings.period, end.toISOString().slice(0, 7))
            )
        )
        .orderBy(desc(meterReadings.period));

    for (const reading of readings) {
        const consumption = reading.meterEnd - reading.meterStart;

        // Format period name
        const [year, month] = reading.period.split('-');
        const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const monthName = monthNames[parseInt(month) - 1];

        if (consumption > 0) {
            utilityItems.push({
                itemName: `Listrik - ${monthName} ${year} (${consumption} kWh)`,
                itemQty: consumption,
                itemUnitPrice: costPerKwh,
                itemDiscount: 0,
                itemType: 'utility'
            });
        }
    }

    // 2. Water (Air) - Flat fee per month
    const waterFee = parseFloat(rates.waterFee || '50000');
    if (waterFee > 0) {
        utilityItems.push({
            itemName: `Tagihan Air (${monthsCovered} bulan)`,
            itemQty: monthsCovered,
            itemUnitPrice: waterFee,
            itemDiscount: 0,
            itemType: 'utility'
        });
    }

    // 3. Trash (Sampah) - Flat fee per month (if enabled)
    if (room[0].useTrashService) {
        const trashFee = parseFloat(rates.trashFee || '25000');
        if (trashFee > 0) {
            utilityItems.push({
                itemName: `Iuran Kebersihan (${monthsCovered} bulan)`,
                itemQty: monthsCovered,
                itemUnitPrice: trashFee,
                itemDiscount: 0,
                itemType: 'utility'
            });
        }
    }

    return {
        success: true,
        data: utilityItems
    };
});
