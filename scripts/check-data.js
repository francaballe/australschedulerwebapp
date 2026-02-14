const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking shifts with positionId=0...');
    try {
        const count = await prisma.shift.count({
            where: { positionId: 0 }
        });
        console.log(`Found ${count} shifts.`);
    } catch (e) {
        console.error('❌ Error querying data:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
