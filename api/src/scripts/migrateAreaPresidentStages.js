/**
 * Migration: Add area_president to existing application stages
 *
 * - Adds 'area_president' to allowedRoles of all application stages that have 'area_admin'
 * - Enables areaPresident commentConfig for stages that have areaAdmin comment enabled
 * - Initialises areaPresident comment slot (null) on all stages missing it
 *
 * Run from the api directory:
 *   node src/scripts/migrateAreaPresidentStages.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const collection = db.collection('applications');

  // 1. Add area_president to allowedRoles where area_admin is present
  const addToAllowedRoles = await collection.updateMany(
    { 'applicationStages.allowedRoles': 'area_admin' },
    { $addToSet: { 'applicationStages.$[elem].allowedRoles': 'area_president' } },
    { arrayFilters: [{ 'elem.allowedRoles': 'area_admin' }] }
  );
  console.log(`allowedRoles updated: ${addToAllowedRoles.modifiedCount} applications`);

  // 2. Enable areaPresident commentConfig for stages where areaAdmin comment is enabled
  const enableComment = await collection.updateMany(
    { 'applicationStages.commentConfig.areaAdmin.enabled': true },
    {
      $set: {
        'applicationStages.$[elem].commentConfig.areaPresident.enabled': true,
        'applicationStages.$[elem].commentConfig.areaPresident.required': false
      }
    },
    { arrayFilters: [{ 'elem.commentConfig.areaAdmin.enabled': true }] }
  );
  console.log(`commentConfig.areaPresident enabled: ${enableComment.modifiedCount} applications`);

  // 3. Initialise areaPresident comment slot on all stages that don't have it yet
  const initComment = await collection.updateMany(
    { 'applicationStages': { $exists: true }, 'applicationStages.comments.areaPresident': { $exists: false } },
    {
      $set: {
        'applicationStages.$[].comments.areaPresident': {
          comment: null,
          commentedBy: null,
          commentedAt: null
        }
      }
    }
  );
  console.log(`comments.areaPresident initialised: ${initComment.modifiedCount} applications`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
