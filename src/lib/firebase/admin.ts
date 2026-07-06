import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  try {
    let pk = process.env.FIREBASE_PRIVATE_KEY || '';
    if (pk.startsWith('"') && pk.endsWith('"')) {
      pk = pk.substring(1, pk.length - 1);
    }
    pk = pk.replace(/\\n/g, '\n').replace(/\r/g, '');

    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: pk,
      }),
    });
    console.log('Firebase Admin Initialized successfully.');
  } catch (error) {
    console.error('Firebase Admin Initialization Error', error);
  }
}

// Safely get firestore to prevent build crashes
export const adminDb = getApps().length > 0 ? getFirestore() : ({} as any);
