import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/userModel.js';

dotenv.config();

const MONGODB_URI = 'mongodb://admin:StrongPass123!@206.189.139.34:27018/orderent?authSource=admin&replicaSet=rs0&directConnection=true';

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

    const existing = await User.findOne({ email: superAdmin.email });
    if (existing) {
      console.log(`⚠️  Super admin already exists: ${superAdmin.email}`);
      process.exit(0);
    }

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

const connectAndSeed = async () => {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      directConnection: true,
    });
    console.log('✅ MongoDB Connected!');
    await seedDatabase();
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error);
    process.exit(1);
  }
};

connectAndSeed();