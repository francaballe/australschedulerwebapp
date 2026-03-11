// Script to initialize the default company and map existing records to it
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting Default Company Migration...');

  // 1. Ensure the default company exists
  const defaultCompanyName = 'Default Company';
  let defaultCompany = await prisma.company.findFirst({
    where: { name: defaultCompanyName }
  });

  if (!defaultCompany) {
    console.log(`Creating default company "${defaultCompanyName}"...`);
    defaultCompany = await prisma.company.create({
      data: { name: defaultCompanyName }
    });
    console.log(`Created default company with ID: ${defaultCompany.id}`);
  } else {
    console.log(`Default company already exists with ID: ${defaultCompany.id}`);
  }

  const companyId = defaultCompany.id;

  // 2. Loop through all relevant entities and update them if they don't have a companyId
  const updatePromises = [
    prisma.user.updateMany({ where: { companyId: null }, data: { companyId } }),
    prisma.site.updateMany({ where: { companyId: null }, data: { companyId } }),
    prisma.position.updateMany({ where: { companyId: null }, data: { companyId } }),
    prisma.shift.updateMany({ where: { companyId: null }, data: { companyId } }),
    prisma.userUnavailability.updateMany({ where: { companyId: null }, data: { companyId } }),
    prisma.userPushToken.updateMany({ where: { companyId: null }, data: { companyId } }),
    prisma.message.updateMany({ where: { companyId: null }, data: { companyId } }),
    prisma.confirmedWeek.updateMany({ where: { companyId: null }, data: { companyId } }),
    prisma.log.updateMany({ where: { companyId: null }, data: { companyId } })
  ];

  try {
    const results = await prisma.$transaction(updatePromises);
    
    console.log('--- Migration Results ---');
    console.log(`Users updated: ${results[0].count}`);
    console.log(`Sites updated: ${results[1].count}`);
    console.log(`Positions updated: ${results[2].count}`);
    console.log(`Shifts updated: ${results[3].count}`);
    console.log(`User Unavailability updated: ${results[4].count}`);
    console.log(`Push Tokens updated: ${results[5].count}`);
    console.log(`Messages updated: ${results[6].count}`);
    console.log(`Confirmed Weeks updated: ${results[7].count}`);
    console.log(`Logs updated: ${results[8].count}`);
    console.log('All existing records have been assigned to the default company successfully.');
  } catch (err) {
    console.error('Error updating records:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
