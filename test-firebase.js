const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey:            'AIzaSyDQOO_Evu8Om9xx7KTOFfBakibJ6QM7PaE',
  authDomain:        'pos-system-license.firebaseapp.com',
  projectId:         'pos-system-license',
  storageBucket:     'pos-system-license.firebasestorage.app',
  messagingSenderId: '222025185405',
  appId:             '1:222025185405:web:0ee0a0a9b290d0446e9914',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    const q = query(collection(db, 'licenses'));
    const snap = await getDocs(q);
    console.log(`Success! Found ${snap.size} documents.`);
    snap.forEach(doc => console.log(doc.data()));
  } catch (err) {
    console.error('Firebase Error:', err.message);
  }
}

test();
