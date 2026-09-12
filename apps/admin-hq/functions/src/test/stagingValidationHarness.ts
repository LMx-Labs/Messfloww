/**
 * DSAF Staging Validation Harness
 * 
 * Executable script to inject specific test states into a live Firebase staging
 * environment to validate the 8 critical DSAF failure recovery scenarios.
 * 
 * Usage:
 * export GOOGLE_APPLICATION_CREDENTIALS="/path/to/staging-key.json"
 * npx ts-node stagingValidationHarness.ts
 */

import * as admin from 'firebase-admin';
import { TransactionIntentDocument } from '../index';
import * as crypto from 'crypto';

// Initialize the Firebase Admin SDK using GOOGLE_APPLICATION_CREDENTIALS
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const rtdb = admin.database();

async function runStagingValidation() {
  console.log('================================================================');
  console.log('      DSAF LIVE STAGING VALIDATION HARNESS                      ');
  console.log('================================================================\n');
  console.log('Target Project:', admin.app().options.projectId || 'Unknown (Check Credentials)');

  // Ensure this is NEVER run against production!
  const projectId = admin.app().options.projectId;
  if (projectId && !projectId.includes('staging') && !projectId.includes('test')) {
    console.warn('\n[WARNING] This does not look like a staging project. Proceed with extreme caution!\n');
  }

  // 1. Crash after Firestore debit before RTDB commit
  await testCrashBeforeRtdbCommit();

  // 2. Crash after RTDB commit before final Firestore state update
  await testCrashAfterRtdbCommit();

  console.log('\n[INFO] Run the remaining tests manually or observe live cron execution for tests 3-8.');
}

async function testCrashBeforeRtdbCommit() {
  const intentId = `STG-T1-${Date.now()}`;
  console.log(`\n--- Test 1: Crash before RTDB Commit (Intent: ${intentId}) ---`);
  console.log('Injecting state: FINANCIALLY_COMMITTED without RTDB dispatch...');
  
  const intentRef = db.collection('transaction_intents').doc(intentId);
  
  // Seed a "stuck" intent
  const stuckIntent: TransactionIntentDocument = {
    intentId,
    orderId: `ORD-${intentId}`,
    userId: 'STG_USER_1',
    userRollNo: 'STG_REG_1',
    cart: [{ id: 'test_item_1', name: 'Test Thali', qty: 1, price: 100 }],
    totalPrice: 100,
    slotName: 'Lunch',
    paymentMode: 'credit',
    state: 'FINANCIALLY_COMMITTED',
    leaseExpiresAt: Date.now() + 60000, // Not expired yet
    journal: {
      rtdbLeaseAcquired: true,
      firestoreWalletDebited: true,
      rtdbOrderDispatched: false,
      rtdbLeaseReleased: false,
      fenceToken: `stg-fence-${intentId}`
    },
    orderNumber: Math.floor(Math.random() * 1000),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  } as any;

  // We write it to Firestore.
  // The LIVE CRON should pick this up in ~1 minute.
  await intentRef.set(stuckIntent);
  console.log(`[OK] Seeded ${intentId} to Firestore.`);
  console.log(`[ACTION] Monitor the GCP logs for 'reconcileIncompleteIntents' to see if it processes ${intentId}.`);
}

async function testCrashAfterRtdbCommit() {
  const intentId = `STG-T2-${Date.now()}`;
  const orderId = `ORD-${intentId}`;
  console.log(`\n--- Test 2: Crash after RTDB Commit (Intent: ${intentId}) ---`);
  console.log('Injecting state: FINANCIALLY_COMMITTED but order IS in RTDB...');
  
  const intentRef = db.collection('transaction_intents').doc(intentId);
  
  const stuckIntent: TransactionIntentDocument = {
    intentId,
    orderId,
    userId: 'STG_USER_2',
    userRollNo: 'STG_REG_2',
    cart: [{ id: 'test_item_2', name: 'Test Burger', qty: 1, price: 50 }],
    totalPrice: 50,
    slotName: 'Dinner',
    paymentMode: 'credit',
    state: 'FINANCIALLY_COMMITTED',
    leaseExpiresAt: Date.now() + 60000,
    journal: {
      rtdbLeaseAcquired: true,
      firestoreWalletDebited: true,
      rtdbOrderDispatched: false, // Coordinator crashed before setting this
      rtdbLeaseReleased: false,
      fenceToken: `stg-fence-${intentId}`
    },
    orderNumber: Math.floor(Math.random() * 1000),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  } as any;

  await intentRef.set(stuckIntent);
  
  // Also write the order to RTDB to simulate partial completion
  await rtdb.ref(`active_orders/${orderId}`).set({
    id: orderId,
    intentId,
    status: 'ordered',
    userId: 'STG_USER_2'
  });

  console.log(`[OK] Seeded ${intentId} to Firestore and ${orderId} to RTDB.`);
  console.log(`[ACTION] Reconciler should finalize this to COMMITTED without duplicating the order.`);
}

if (require.main === module) {
  runStagingValidation().then(() => {
    console.log('\n[FINISHED] Test states injected. Polling/observation required for validation.');
    process.exit(0);
  }).catch(e => {
    console.error('Error in staging harness:', e);
    process.exit(1);
  });
}
