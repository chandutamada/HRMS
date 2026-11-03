const { PrismaClient } = require('./packages/database/dist/src');
const prisma = new PrismaClient();

async function main() {
  console.log('Updating all shifts across all companies to 09:00 AM - 05:30 PM (09:00 - 17:30)...');
  try {
    const result = await prisma.shift.updateMany({
      data: {
        startTime: '09:00',
        endTime: '17:30',
        lunchStartTime: '13:00',
        lunchEndTime: '14:00',
        gracePeriodMinutes: 30,
        lateExceptionMaxMinutes: 60,
        netWorkSpanMinutes: 450,
        totalSpanMinutes: 510,
      },
    });
    console.log(`Successfully updated ${result.count} shift records to 09:00 - 17:30.`);
  } catch (err) {
    console.error('Database connection error or table not reachable:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
