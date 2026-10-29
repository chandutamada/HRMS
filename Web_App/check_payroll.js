const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.payrollRecord.count();
  const periods = await prisma.payrollPeriod.findMany();
  console.log('PayrollRecords:', count, 'Periods:', periods);
  const circulars = await prisma.circular.findMany();
  console.log('Circulars in DB:', JSON.stringify(circulars, null, 2));
}

main().then(() => prisma.$disconnect()).catch(err => { console.error(err); process.exit(1); });
