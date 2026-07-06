import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Handle newlines in the private key if needed
        privateKey: process.env.FIREBASE_PRIVATE_KEY
          ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/gm, '\n').replace(/^"|"$/g, '')
          : undefined,
      }),
    });
    console.log('Firebase Admin Initialized successfully.');
  } catch (error) {
    console.error('Firebase Admin Initialization Error', error);
  }
}

// Safely get firestore to prevent build crashes
export const adminDb = getApps().length > 0 ? getFirestore() : ({} as any);
