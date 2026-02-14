require('dotenv').config({ path: '.env.local' });
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();

    try {
        // Create roles
        await prisma.role.createMany({
            data: [
                { id: 1, name: 'Admin' },
                { id: 2, name: 'Employee' }
            ],
            skipDuplicates: true
        });
        console.log('✅ Roles created');

        // Create default site
        await prisma.site.create({ data: { id: 1, name: 'Default' } });
        console.log('✅ Site created');

        // Hash password and create admin user
        const hash = await bcrypt.hash('pepe1234', 10);
        const user = await prisma.user.create({
            data: {
                email: 'francaballe@gmail.com',
                password: hash,
                firstname: 'Fran',
                lastname: 'Caballe',
                userroleid: 1,
                siteid: 1
            }
        });
        console.log('✅ Admin user created, id:', user.id);
    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
