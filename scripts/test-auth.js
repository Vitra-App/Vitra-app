const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function test() {
  const user = await prisma.user.findUnique({ where: { email: 'demo@vitra.app' } });
  console.log('User found:', !!user);
  console.log('Has passwordHash:', !!user?.passwordHash);
  console.log('Hash prefix:', user?.passwordHash?.substring(0, 20));
  
  if (user?.passwordHash) {
    const valid = await bcrypt.compare('demo1234', user.passwordHash);
    console.log('bcrypt.compare result:', valid);
  }
  await prisma.$disconnect();
}

test().catch(console.error);
