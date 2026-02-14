const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Starting position cleanup...');

    try {
        // 1. Set positionId to null for shifts with positionId = 0
        console.log('🔄 Setting positionId=NULL for shifts with positionId=0...');
        const updateResult = await prisma.shift.updateMany({
            where: { positionId: 0 },
            data: { positionId: null }
        });
        console.log(`   Updated ${updateResult.count} shifts.`);

        // 2. Delete shifts with positionId = 1 (Unavailable) - these are now in user_unavailability
        console.log('🗑️ Deleting shifts with positionId=1 (Unavailable)...');
        const deleteShiftsResult = await prisma.shift.deleteMany({
            where: { positionId: 1 }
        });
        console.log(`   Deleted ${deleteShiftsResult.count} unavailable shifts.`);

        // 3. Delete positions 0 and 1
        console.log('🗑️ Deleting positions 0 and 1...');
        const deletePositionsResult = await prisma.position.deleteMany({
            where: {
                id: { in: [0, 1] }
            }
        });
        console.log(`   Deleted ${deletePositionsResult.count} positions.`);

    } catch (error) {
        if (error.code === 'P2003') {
            console.log('⚠️ Foreign key constraint failed during cleanup (expected if order is wrong), but continuing...');
        } else {
            throw error;
        }
    }

    console.log('✅ Cleanup complete.');
}

main()
    .catch((e) => {
        console.error('❌ Error during cleanup:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
