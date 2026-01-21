
import { defineEventHandler } from 'h3';
import { db } from '../../utils/drizzle';
import { rentBills, utilityBills, tenants, rooms, properties } from '../../database/schema';
import { eq, and, lte, gt, desc, asc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // Get today's date at start of handler
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 1. Fetch all unpaid bills (Rent & Utility)
    const unpaidRentBills = await db.select({
        id: rentBills.id,
        amount: rentBills.totalAmount,
        dueDate: rentBills.dueDate,
        createdAt: rentBills.generatedAt,
        tenantId: rentBills.tenantId,
        roomId: rentBills.roomId,
        // Rent specific
        period: rentBills.period,
        monthsCovered: rentBills.monthsCovered,
        roomPrice: rentBills.roomPrice,
        // Join details
        tenantName: tenants.name,
        tenantContact: tenants.contact,
        roomName: rooms.name,
        propertyName: properties.name,
        propertyId: properties.id,
        occupantCount: rooms.occupantCount
    })
        .from(rentBills)
        .leftJoin(tenants, eq(rentBills.tenantId, tenants.id))
        .leftJoin(rooms, eq(rentBills.roomId, rooms.id))
        .leftJoin(properties, eq(rooms.propertyId, properties.id))
        .where(eq(rentBills.isPaid, false));

    const unpaidUtilityBills = await db.select({
        id: utilityBills.id,
        amount: utilityBills.totalAmount,
        dueDate: utilityBills.generatedAt, // Using generatedAt as proxy
        createdAt: utilityBills.generatedAt,
        tenantId: utilityBills.tenantId,
        roomId: utilityBills.roomId,
        // Utility specific
        period: utilityBills.period,
        meterStart: utilityBills.meterStart,
        meterEnd: utilityBills.meterEnd,
        usageCost: utilityBills.usageCost,
        waterFee: utilityBills.waterFee,
        trashFee: utilityBills.trashFee,
        // Join details
        tenantName: tenants.name,
        tenantContact: tenants.contact,
        roomName: rooms.name,
        propertyName: properties.name,
        propertyId: properties.id,
        occupantCount: rooms.occupantCount
    })
        .from(utilityBills)
        .leftJoin(tenants, eq(utilityBills.tenantId, tenants.id))
        .leftJoin(rooms, eq(utilityBills.roomId, rooms.id))
        .leftJoin(properties, eq(rooms.propertyId, properties.id))
        .where(eq(utilityBills.isPaid, false));

    // 2. Normalize and Combine
    // today already set at top of handler
    
    console.log('\n=== PROCESSING BILLS ===');
    console.log('Sample: Creating test date for 20 Jan 2026:');
    const testDate = new Date(2026, 0, 20, 0, 0, 0, 0);
    console.log('  Test Date (local):', testDate.toString());
    console.log('  Test Date (ISO):', testDate.toISOString());
    console.log('  Test vs Today diff (ms):', testDate.getTime() - today.getTime());
    console.log('  Test vs Today diff (days):', Math.floor((testDate.getTime() - today.getTime()) / (1000*60*60*24)));
    console.log('  Expected category: OVERDUE (since today is 21 Jan)\n');
    
    console.log('Today (midnight):', today.toISOString(), 'Local:', today.toString());

    const allBills = [
        ...unpaidRentBills.map(b => {
            // Parse date string properly - avoid timezone issues
            const dueDate = b.dueDate;
            let dueDateObj: Date;
            
            if (!dueDate) {
                return null;
            }
            
            // Handle both Date object and string
            if (dueDate instanceof Date) {
                // Extract date components to avoid timezone issues
                const year = dueDate.getFullYear();
                const month = dueDate.getMonth();
                const day = dueDate.getDate();
                dueDateObj = new Date(year, month, day, 0, 0, 0, 0);
                
                // Debug first few
                if (unpaidRentBills.indexOf(b) < 3) {
                    console.log(`\n[RENT BILL ${b.id}] ${b.tenantName}`);
                    console.log('  Raw dueDate from DB:', dueDate);
                    console.log('  Type:', typeof dueDate, 'instanceof Date:', dueDate instanceof Date);
                    console.log('  Components: year=${year}, month=${month}, day=${day}');
                    console.log('  Parsed dueDateObj:', dueDateObj.toString());
                    console.log('  Parsed ISO:', dueDateObj.toISOString());
                    console.log('  Parsed timestamp:', dueDateObj.getTime());
                }
            } else if (typeof dueDate === 'string') {
                // Parse as local date (not UTC)
                const dateOnly = dueDate.split('T')[0]; // Get YYYY-MM-DD part
                const [year, month, day] = dateOnly.split('-').map(Number);
                dueDateObj = new Date(year, month - 1, day, 0, 0, 0, 0);
            } else {
                console.error('Invalid due date type for bill:', b.id, typeof dueDate);
                return null;
            }
            
            // Validate date
            if (isNaN(dueDateObj.getTime())) {
                console.error('Invalid due date for bill:', b.id, dueDate);
                return null;
            }
            
            // Ensure midnight
            dueDateObj.setHours(0, 0, 0, 0);
            
            return {
                ...b,
                type: 'rent',
                dueDateObj
            };
        }).filter(Boolean), // Remove null entries
        ...unpaidUtilityBills.map(b => {
            // Logic: Utility bill due 7 days after generation
            const createdAt = b.createdAt;
            
            if (!createdAt) {
                return null;
            }
            
            // Handle both Date object and string
            let d: Date;
            if (createdAt instanceof Date) {
                // Extract date components to avoid timezone issues
                const year = createdAt.getFullYear();
                const month = createdAt.getMonth();
                const day = createdAt.getDate();
                d = new Date(year, month, day, 0, 0, 0, 0);
            } else if (typeof createdAt === 'string') {
                // Parse as local date
                const dateOnly = createdAt.split('T')[0];
                const [year, month, day] = dateOnly.split('-').map(Number);
                d = new Date(year, month - 1, day, 0, 0, 0, 0);
            } else {
                console.error('Invalid created date type for utility bill:', b.id, typeof createdAt);
                return null;
            }
            
            // Validate date
            if (isNaN(d.getTime())) {
                console.error('Invalid created date for utility bill:', b.id, createdAt);
                return null;
            }
            
            // Add 7 days for utility bill due date
            d.setDate(d.getDate() + 7);
            d.setHours(0, 0, 0, 0);
            
            return {
                ...b,
                type: 'utility',
                dueDateObj: d
            };
        }).filter(Boolean) // Remove null entries
    ];



    // 3. Categorize
    const overdue = [];
    const dueSoon = [];
    const upcoming = [];

    for (const bill of allBills) {
        const dueDate = bill.dueDateObj;

        // Skip if invalid date somehow got through
        if (!dueDate || isNaN(dueDate.getTime())) {
            continue;
        }

        // Calculate days diff (negative means overdue)
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        // Use local date string for display (not UTC)
        const year = dueDate.getFullYear();
        const month = String(dueDate.getMonth() + 1).padStart(2, '0');
        const day = String(dueDate.getDate()).padStart(2, '0');
        const dueDateStr = `${year}-${month}-${day}`;
        
        const todayStr = today.toISOString().split('T')[0];
        
        // Show only bills with due date = 2026-01-20 (first 3 only)
        if (dueDateStr === '2026-01-20' && dueSoon.length + overdue.length < 3) {
            console.log(`\n[BILL ${bill.id}] ${bill.tenantName} - Due 2026-01-20:`);
            console.log('  Due Date Object:', dueDate.toString());
            console.log('  Due Date ISO:', dueDate.toISOString());
            console.log('  Due timestamp:', dueDate.getTime());
            console.log('  Today Object:', today.toString());
            console.log('  Today ISO:', today.toISOString());
            console.log('  Today timestamp:', today.getTime());
            console.log('  Diff Time (ms):', diffTime);
            console.log('  Diff Days:', diffDays);
            console.log('  Expected: -1 (OVERDUE since today is 21 Jan)');
        }

        const formattedBill = {
            ...bill,
            dueDate: dueDateStr,
            daysUntilDue: diffDays,
            isOverdue: diffDays < 0
        };

        // FIXED LOGIC: Due date 20 Jan when today is 21 Jan should be OVERDUE (diffDays = -1)
        if (diffDays < 0) {
            // Past due date = overdue (includes yesterday, 2 days ago, etc)
            overdue.push(formattedBill);
        } else if (diffDays === 0) {
            // Due TODAY = should be in dueSoon to get attention
            dueSoon.push(formattedBill);
        } else if (diffDays <= 3) {
            // Due in 1-3 days = dueSoon
            dueSoon.push(formattedBill);
        } else {
            // Due in 4+ days = upcoming
            upcoming.push(formattedBill);
        }
    }

    // 4. Sort (Most urgent first)
    const sortByDate = (a: any, b: any) => a.dueDateObj.getTime() - b.dueDateObj.getTime();

    overdue.sort(sortByDate);
    dueSoon.sort(sortByDate);
    upcoming.sort(sortByDate);



    return {
        overdue,
        dueSoon,
        upcoming,
        counts: {
            total: allBills.length,
            overdue: overdue.length,
            dueSoon: dueSoon.length
        }
    };
});
