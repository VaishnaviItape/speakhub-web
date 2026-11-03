import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { getFirestore, doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAIwp35Kbg7QayG-gvBTcTVU0ihrSiXgHg",
  authDomain: "speak-hub-academy.firebaseapp.com",
  projectId: "speak-hub-academy",
  storageBucket: "speak-hub-academy.firebasestorage.app",
  messagingSenderId: "1061470676783",
  appId: "1:1061470676783:web:21088635a13f043a5223da"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const target = process.argv[2];
const customPwd = process.argv[3];

if (!target) {
  console.log("Usage: node delete_user.mjs <phone_or_email> [password]");
  console.log("Example: node delete_user.mjs 9175021130 komal2014");
  process.exit(1);
}

const cleanPhone = target.replace(/[^0-9]/g, '');
const email = target.includes('@') ? target.trim() : `${cleanPhone}@speakhub.com`;

async function run() {
  console.log(`Processing deletion for target: ${target} (${email})...`);

  // 1. Delete from Firestore
  try {
    const q1 = query(collection(db, 'users'), where('email', '==', email));
    const s1 = await getDocs(q1);
    s1.forEach(async (d) => {
      await deleteDoc(doc(db, 'users', d.id));
      console.log(`Deleted Firestore document: ${d.id}`);
    });

    if (cleanPhone.length >= 10) {
      const q2 = query(collection(db, 'users'), where('phone', '==', cleanPhone.slice(-10)));
      const s2 = await getDocs(q2);
      s2.forEach(async (d) => {
        await deleteDoc(doc(db, 'users', d.id));
        console.log(`Deleted Firestore document by phone: ${d.id}`);
      });
    }
  } catch (dbErr) {
    console.warn("Firestore lookup/delete notice:", dbErr.message);
  }

  // 2. Delete from Firebase Authentication
  const candidatePasswords = [
    customPwd,
    'komal2014',
    'Test@123',
    'Teacher@123',
    'password123',
    cleanPhone
  ].filter(Boolean);

  let deletedAuth = false;
  for (const pwd of candidatePasswords) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pwd);
      await deleteUser(cred.user);
      console.log(`SUCCESS: Deleted user from Firebase Authentication (${email}, UID: ${cred.user.uid})`);
      deletedAuth = true;
      break;
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        console.log(`User does not exist in Firebase Authentication (${email}).`);
        deletedAuth = true;
        break;
      }
    }
  }

  if (!deletedAuth) {
    console.log(`\nNote: Auth account could not be signed in automatically with standard passwords.`);
    console.log(`If a custom password was set, pass it as second argument: node delete_user.mjs ${target} <password>`);
    console.log(`Or delete from Firebase Console: https://console.firebase.google.com/project/speak-hub-academy/authentication/users`);
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
