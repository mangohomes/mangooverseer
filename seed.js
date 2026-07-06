const fs = require('fs');
const admin = require('firebase-admin');

const envContent = fs.readFileSync('.env.local', 'utf8');
const keyMatch = envContent.match(/FIREBASE_SERVICE_ACCOUNT_KEY=(.+)/);
const keyStr = keyMatch ? keyMatch[1].trim() : null;

if (!keyStr) {
  console.error("Missing key!");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(keyStr))
});

const db = admin.firestore();

async function seed() {
  await db.collection('tasks').add({
    title: 'New Construction Bee',
    description: 'Daily compiler for builder incentives and new neighborhoods in Horry and Brunswick county. Sends weekly email summary.',
    category: 'bee',
    beeType: 'new-construction',
    status: 'idle',
    weeklyFindings: [],
    createdAt: new Date().toISOString()
  });
  console.log('Seeded New Construction Bee');
  process.exit(0);
}

seed();
