/**
 * Repair invalid PickerUser.status values.
 * under_review / UNDER_REVIEW / docs_required → PENDING
 * Ensures onboarding applications use under_review when the rider submitted.
 *
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/repair-picker-user-status.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const VALID = new Set([
  'PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED', 'SUSPENDED', 'BLOCKED', 'DELETION_PENDING',
]);

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI required');
  await mongoose.connect(uri);
  const col = mongoose.connection.collection('picker_users');
  const apps = mongoose.connection.collection('picker_onboarding_applications');

  const invalid = await col.find({ status: { $nin: Array.from(VALID) } }).project({ phone: 1, email: 1, status: 1 }).toArray();
  console.log(`Found ${invalid.length} picker_users with invalid status`);

  for (const row of invalid) {
    const raw = String(row.status || '');
    const upper = raw.toUpperCase().replace(/-/g, '_');
    let next = 'PENDING';
    if (VALID.has(upper)) next = upper;
    // under_review / docs_required → PENDING (onboarding application may still be under_review)
    console.log(`  ${row.phone || row.email}: ${raw} → ${next}`);
    await col.updateOne({ _id: row._id }, { $set: { status: next } });

    if (upper === 'UNDER_REVIEW' || raw === 'under_review') {
      const existing = await apps.findOne({ pickerId: row._id });
      if (existing && existing.status === 'draft') {
        await apps.updateOne({ _id: existing._id }, { $set: { status: 'under_review', submittedAt: existing.submittedAt || new Date() } });
        console.log(`    synced onboarding application → under_review`);
      } else if (!existing) {
        await apps.insertOne({
          applicationId: `SL-RA-REPAIR-${String(row._id).slice(-6)}`,
          pickerId: row._id,
          status: 'under_review',
          submittedAt: new Date(),
          stepsAtSubmission: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`    created onboarding application under_review`);
      }
    }
  }

  console.log('Done.');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
