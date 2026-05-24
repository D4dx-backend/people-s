const mongoose = require('mongoose');
const config = require('./environment');

/**
 * Drop the legacy unique index user_1_franchise_1 (no role field) that prevents
 * multi-role memberships, then sync to the correct user_1_franchise_1_role_1 index.
 * Safe to call every startup — no-ops when already migrated.
 */
async function migrateUserFranchiseIndex() {
  try {
    const coll = mongoose.connection.db.collection('userfranchises');
    const indexes = await coll.indexes();
    const legacy = indexes.find(i => i.name === 'user_1_franchise_1');
    if (legacy) {
      await coll.dropIndex('user_1_franchise_1');
      console.log('✅ [Migration] Dropped legacy UserFranchise index user_1_franchise_1');
    }
    // Let Mongoose recreate the correct { user, franchise, role } unique index
    const { UserFranchise } = require('../models');
    await UserFranchise.syncIndexes();
    console.log('✅ [Migration] UserFranchise indexes synced');
  } catch (err) {
    console.warn('⚠️ [Migration] UserFranchise index migration warning:', err.message);
  }
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Run one-time index migration (idempotent)
    await migrateUserFranchiseIndex();
    
    // Setup connection event listeners
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔄 MongoDB connection closed through app termination');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;