const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emp = await prisma.employee.findUnique({
    where: { id: '020d1d13-e087-4c6e-bc51-4db8aff3efdb' },
    include: { salaryStructures: true, company: true }
  });
  console.log('Employee:', emp.firstName, emp.employeeCode, 'Company:', emp.company?.code);
  console.log('Salary Structures:', emp.salaryStructures);
}

main().then(() => prisma.$disconnect()).catch(err => { console.error(err); process.exit(1); });
