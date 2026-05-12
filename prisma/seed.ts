import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Seed Roles
  console.log('📝 Creating roles...');
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'Farmer' },
      update: {},
      create: {
        name: 'Farmer',
        description: 'Smallholder farmer accessing loans and warehouse receipts',
      },
    }),
    prisma.role.upsert({
      where: { name: 'Warehouse Operator' },
      update: {},
      create: {
        name: 'Warehouse Operator',
        description: 'Manages warehouse and electronic warehouse receipts',
      },
    }),
    prisma.role.upsert({
      where: { name: 'Financial Institution' },
      update: {},
      create: {
        name: 'Financial Institution',
        description: 'Reviews and approves loan applications',
      },
    }),
    prisma.role.upsert({
      where: { name: 'Admin' },
      update: {},
      create: {
        name: 'Admin',
        description: 'System administrator with broad access',
      },
    }),
    prisma.role.upsert({
      where: { name: 'Super Admin' },
      update: {},
      create: {
        name: 'Super Admin',
        description: 'Super administrator with full system access',
      },
    }),
  ]);

  console.log(`✅ Created ${roles.length} roles`);

  // Seed Permissions
  console.log('🔐 Creating permissions...');
  const permissions = await Promise.all([
    // Auth permissions
    prisma.permission.upsert({
      where: { resource_action: { resource: 'auth', action: 'signup' } },
      update: {},
      create: { resource: 'auth', action: 'signup', description: 'User signup' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'auth', action: 'login' } },
      update: {},
      create: { resource: 'auth', action: 'login', description: 'User login' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'auth', action: 'verify_email' } },
      update: {},
      create: { resource: 'auth', action: 'verify_email', description: 'Verify email' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'auth', action: 'reset_password' } },
      update: {},
      create: { resource: 'auth', action: 'reset_password', description: 'Reset password' },
    }),
    // Loan permissions
    prisma.permission.upsert({
      where: { resource_action: { resource: 'loans', action: 'read' } },
      update: {},
      create: { resource: 'loans', action: 'read', description: 'View loans' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'loans', action: 'create' } },
      update: {},
      create: { resource: 'loans', action: 'create', description: 'Create loan application' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'loans', action: 'approve' } },
      update: {},
      create: { resource: 'loans', action: 'approve', description: 'Approve loan' },
    }),
    // Warehouse Receipt permissions
    prisma.permission.upsert({
      where: { resource_action: { resource: 'receipts', action: 'read' } },
      update: {},
      create: { resource: 'receipts', action: 'read', description: 'View warehouse receipts' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'receipts', action: 'create' } },
      update: {},
      create: { resource: 'receipts', action: 'create', description: 'Create warehouse receipt' },
    }),
    // Admin permissions
    prisma.permission.upsert({
      where: { resource_action: { resource: 'users', action: 'manage' } },
      update: {},
      create: { resource: 'users', action: 'manage', description: 'Manage users and roles' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'kyc', action: 'review' } },
      update: {},
      create: { resource: 'kyc', action: 'review', description: 'Review KYC documents' },
    }),
    prisma.permission.upsert({
      where: { resource_action: { resource: 'audit', action: 'read' } },
      update: {},
      create: { resource: 'audit', action: 'read', description: 'View audit logs' },
    }),
  ]);

  console.log(`✅ Created ${permissions.length} permissions`);

  // Assign permissions to roles
  console.log('🔗 Assigning permissions to roles...');
  
  // Farmer role
  const farmerRole = roles.find(r => r.name === 'Farmer')!;
  const farmerPermissions = permissions.filter(p =>
    (p.resource === 'loans' && (p.action === 'read' || p.action === 'create')) ||
    (p.resource === 'receipts' && p.action === 'read') ||
    (p.resource === 'auth' && (p.action === 'verify_email' || p.action === 'reset_password'))
  );

  for (const perm of farmerPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: farmerRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: farmerRole.id, permissionId: perm.id },
    });
  }

  // Admin role - all permissions
  const adminRole = roles.find(r => r.name === 'Admin')!;
  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }

  console.log('✅ Permissions assigned to roles');

  // Seed Admin User
  console.log('👤 Creating admin user...');
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@cropcoin.local' },
    update: {},
    create: {
      email: 'admin@cropcoin.local',
      passwordHash: adminPassword,
      emailVerified: true,
      status: 'active',
      userRoles: {
        create: [
          {
            roleId: adminRole.id,
            assignedBy: null, // System-created
          },
        ],
      },
    },
  });

  console.log(`✅ Created admin user: ${adminUser.email}`);

  // Seed Sample Farmer User
  console.log('🚜 Creating sample farmer user...');
  const farmerPassword = await bcrypt.hash('Farmer123!', 12);
  const farmerUser = await prisma.user.upsert({
    where: { email: 'farmer@cropcoin.local' },
    update: {},
    create: {
      email: 'farmer@cropcoin.local',
      phone: '+254712345678',
      passwordHash: farmerPassword,
      emailVerified: true,
      status: 'active',
      userRoles: {
        create: [
          {
            roleId: farmerRole.id,
            assignedBy: null,
          },
        ],
      },
      farmerProfile: {
        create: {
          county: 'Uasin Gishu',
          subCounty: 'Turbo',
          farmSizeAcres: 5.5,
          primaryCommodity: 'Maize',
        },
      },
    },
  });

  console.log(`✅ Created sample farmer user: ${farmerUser.email}`);

  // Seed Commodities
  console.log('🌾 Creating commodities...');
  const commodities = await Promise.all([
    prisma.commodity.upsert({
      where: { name: 'Maize' },
      update: {},
      create: {
        name: 'Maize',
        unit: 'bags (90kg)',
        standardGrades: { grades: ['Grade A', 'Grade B', 'Grade C'] },
        currentPrice: 4200, // KES cents
      },
    }),
    prisma.commodity.upsert({
      where: { name: 'Beans' },
      update: {},
      create: {
        name: 'Beans',
        unit: 'bags (50kg)',
        standardGrades: { grades: ['Grade A', 'Grade B'] },
        currentPrice: 8500,
      },
    }),
    prisma.commodity.upsert({
      where: { name: 'Wheat' },
      update: {},
      create: {
        name: 'Wheat',
        unit: 'bags (90kg)',
        standardGrades: { grades: ['Grade A', 'Grade B'] },
        currentPrice: 4800,
      },
    }),
  ]);

  console.log(`✅ Created ${commodities.length} commodities`);

  console.log('✨ Database seeding completed successfully!');
  console.log('📊 Summary:');
  console.log(`   - Roles: ${roles.length}`);
  console.log(`   - Permissions: ${permissions.length}`);
  console.log(`   - Commodities: ${commodities.length}`);
  console.log(`   - Users: 2 (1 admin, 1 farmer)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
