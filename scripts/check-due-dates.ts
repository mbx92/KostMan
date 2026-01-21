import { db } from '../server/utils/drizzle';
import { rentBills } from '../server/database/schema';
import { eq } from 'drizzle-orm';

async function checkDueDates() {
    console.log('Checking due dates from database...\n');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('Today (local):', today.toString());
    console.log('Today (ISO):', today.toISOString());
    console.log('Today timestamp:', today.getTime());
    
    // Get a few unpaid rent bills
    const bills = await db.select({
        id: rentBills.id,
        dueDate: rentBills.dueDate,
        tenantId: rentBills.tenantId
    })
    .from(rentBills)
    .where(eq(rentBills.isPaid, false))
    .limit(10);
    
    console.log('\n=== First 10 unpaid bills ===');
    bills.forEach((bill, idx) => {
        console.log(`\n[${idx + 1}] Bill ID: ${bill.id}`);
        console.log('  Raw dueDate from DB:', bill.dueDate);
        console.log('  Type:', typeof bill.dueDate);
        console.log('  Is Date?', bill.dueDate instanceof Date);
        
        let dueDateObj: Date;
        if (bill.dueDate instanceof Date) {
            dueDateObj = new Date(bill.dueDate);
        } else if (typeof bill.dueDate === 'string') {
            const dateOnly = bill.dueDate.split('T')[0];
            const [year, month, day] = dateOnly.split('-').map(Number);
            dueDateObj = new Date(year, month - 1, day, 0, 0, 0, 0);
        } else {
            console.log('  ERROR: Unknown date type');
            return;
        }
        
        dueDateObj.setHours(0, 0, 0, 0);
        
        console.log('  Parsed (local):', dueDateObj.toString());
        console.log('  Parsed (ISO):', dueDateObj.toISOString());
        console.log('  Parsed timestamp:', dueDateObj.getTime());
        
        const diffTime = dueDateObj.getTime() - today.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        console.log('  Diff Days:', diffDays);
        console.log('  Category:', diffDays < 0 ? 'OVERDUE' : (diffDays === 0 ? 'TODAY' : (diffDays <= 3 ? 'DUE_SOON' : 'UPCOMING')));
    });
    
    process.exit(0);
}

checkDueDates().catch(console.error);
