const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Executing raw SQL to make position_id nullable...');
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "app"."shifts" ALTER COLUMN "position_id" DROP NOT NULL;`);
        console.log('✅ Column modified successfully.');
    } catch (e) {
        console.error('❌ Error executing raw SQL:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
