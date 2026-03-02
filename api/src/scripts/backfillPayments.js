/**
 * Backfill Payment Records for Approved Applications
 *
 * This script finds all applications with status 'approved' (or 'completed'/'disbursed')
 * that do NOT have corresponding Payment records, and creates them.
 *
 * Run from api directory:
 *   node src/scripts/backfillPayments.js
 *
 * Options:
 *   --dry-run    Show what would be created without actually creating
 *   --status     Comma-separated statuses to process (default: approved,completed,disbursed)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/environment');

const isDryRun = process.argv.includes('--dry-run');

// Parse --status flag
const statusArgIndex = process.argv.indexOf('--status');
const statusesToProcess = statusArgIndex !== -1 && process.argv[statusArgIndex + 1]
  ? process.argv[statusArgIndex + 1].split(',')
  : ['approved', 'completed', 'disbursed'];

async function backfillPayments() {
  try {
    // Connect to database
    await mongoose.connect(config.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    const Application = require('../models/Application');
    const Payment = require('../models/Payment');

    // Find all approved/completed/disbursed applications
    const applications = await Application.find({
      status: { $in: statusesToProcess },
      approvedAmount: { $gt: 0 }
    })
      .populate('beneficiary', 'name phone')
      .populate('scheme', 'name code')
      .populate('project', 'name code');

    console.log(`\n📋 Found ${applications.length} applications with status in [${statusesToProcess.join(', ')}]\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const app of applications) {
      // Check if payments already exist for this application
      const existingPayments = await Payment.countDocuments({ application: app._id });

      if (existingPayments > 0) {
        console.log(`⏭️  SKIP: ${app.applicationNumber} — already has ${existingPayments} payment(s)`);
        skipped++;
        continue;
      }

      const beneficiaryName = app.beneficiary?.name || 'Unknown';
      const schemeName = app.scheme?.name || 'Unknown';

      console.log(`\n🔄 Processing: ${app.applicationNumber} | ${beneficiaryName} | ${schemeName} | ₹${app.approvedAmount?.toLocaleString('en-IN')}`);

      if (app.distributionTimeline && app.distributionTimeline.length > 0) {
        // Create installment payments from distribution timeline
        console.log(`   📅 Distribution timeline: ${app.distributionTimeline.length} phases`);

        for (let i = 0; i < app.distributionTimeline.length; i++) {
          const timeline = app.distributionTimeline[i];
          const amount = timeline.amount || Math.round(app.approvedAmount * (timeline.percentage || 0) / 100);

          if (isDryRun) {
            console.log(`   [DRY-RUN] Would create payment ${i + 1}/${app.distributionTimeline.length}: ₹${amount.toLocaleString('en-IN')} — ${timeline.description || `Phase ${i + 1}`}`);
            continue;
          }

          try {
            const paymentCount = await Payment.countDocuments();
            const year = new Date().getFullYear();
            const paymentNumber = `PAY${year}${String(paymentCount + 1).padStart(6, '0')}`;

            const payment = new Payment({
              paymentNumber,
              application: app._id,
              beneficiary: app.beneficiary?._id || app.beneficiary,
              project: app.project?._id || app.project,
              scheme: app.scheme?._id || app.scheme,
              amount: amount,
              type: 'installment',
              method: 'bank_transfer',
              status: timeline.status === 'completed' ? 'completed' : 'pending',
              installment: {
                number: i + 1,
                totalInstallments: app.distributionTimeline.length,
                description: timeline.description || `Phase ${i + 1}`
              },
              timeline: {
                expectedCompletionDate: timeline.expectedDate
                  ? new Date(timeline.expectedDate)
                  : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                approvedAt: app.approvedAt || new Date()
              },
              approvals: [{
                level: 'finance',
                approver: app.approvedBy || app.updatedBy,
                status: 'approved',
                approvedAt: app.approvedAt || new Date(),
                comments: 'Backfilled from approved application'
              }],
              metadata: {
                notes: `Backfilled payment. Original approval: ${app.approvedAt?.toISOString() || 'N/A'}`
              },
              initiatedBy: app.approvedBy || app.updatedBy || app.createdBy,
              location: {
                state: app.location?.state,
                district: app.location?.district,
                area: app.location?.area,
                unit: app.location?.unit
              }
            });

            await payment.save();
            console.log(`   ✅ Payment ${i + 1}/${app.distributionTimeline.length} created: ${paymentNumber} — ₹${amount.toLocaleString('en-IN')}`);
            created++;
          } catch (err) {
            console.error(`   ❌ Error creating payment ${i + 1} for ${app.applicationNumber}:`, err.message);
            errors++;
          }
        }
      } else {
        // No timeline — create single full payment
        if (isDryRun) {
          console.log(`   [DRY-RUN] Would create single payment: ₹${app.approvedAmount.toLocaleString('en-IN')}`);
          continue;
        }

        try {
          const paymentCount = await Payment.countDocuments();
          const year = new Date().getFullYear();
          const paymentNumber = `PAY${year}${String(paymentCount + 1).padStart(6, '0')}`;

          const payment = new Payment({
            paymentNumber,
            application: app._id,
            beneficiary: app.beneficiary?._id || app.beneficiary,
            project: app.project?._id || app.project,
            scheme: app.scheme?._id || app.scheme,
            amount: app.approvedAmount,
            type: 'full_payment',
            method: 'bank_transfer',
            status: 'pending',
            timeline: {
              expectedCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              approvedAt: app.approvedAt || new Date()
            },
            approvals: [{
              level: 'finance',
              approver: app.approvedBy || app.updatedBy,
              status: 'approved',
              approvedAt: app.approvedAt || new Date(),
              comments: 'Backfilled from approved application'
            }],
            metadata: {
              notes: `Backfilled payment. Original approval: ${app.approvedAt?.toISOString() || 'N/A'}`
            },
            initiatedBy: app.approvedBy || app.updatedBy || app.createdBy,
            location: {
              state: app.location?.state,
              district: app.location?.district,
              area: app.location?.area,
              unit: app.location?.unit
            }
          });

          await payment.save();
          console.log(`   ✅ Single payment created: ${paymentNumber} — ₹${app.approvedAmount.toLocaleString('en-IN')}`);
          created++;
        } catch (err) {
          console.error(`   ❌ Error creating payment for ${app.applicationNumber}:`, err.message);
          errors++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 BACKFILL SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Total applications processed: ${applications.length}`);
    console.log(`   Skipped (already have payments): ${skipped}`);
    console.log(`   Payments created: ${created}`);
    console.log(`   Errors: ${errors}`);
    if (isDryRun) {
      console.log('\n   ⚠️  DRY RUN — no records were actually created');
      console.log('   Run without --dry-run to create payment records');
    }
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
    process.exit(0);
  }
}

backfillPayments();
