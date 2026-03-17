import dotenv from 'dotenv';
import User from './models/userModel.js';
import connectDB from './config/db.js';

dotenv.config();

const superAdmin = {
  username: 'superadmin',
  email: 'superadmin@pacs.com',
  password: 'SuperAdmin123!',
  fullName: 'System Super Administrator',
  role: 'super_admin'
};

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Check if super admin already exists
    const existing = await User.findOne({ email: superAdmin.email });
    if (existing) {
      console.log(`⚠️  Super admin already exists: ${superAdmin.email}`);
      process.exit(0);
    }

    // Create super admin
    console.log('👑 Creating super admin...');
    const superAdminUser = new User(superAdmin);
    await superAdminUser.save();

    console.log('\n🎉 Super admin created successfully!');
    console.log(`   👑 Email:    ${superAdmin.email}`);
    console.log(`   🔑 Password: ${superAdmin.password}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

// Run the seed
connectDB().then(() => {
  seedDatabase();
});