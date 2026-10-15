import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

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

async function setupReviewerAccount() {
  const phone = "9999999999";
  const email = "9999999999@speakhub.com";
  const password = "Test@123";

  let uid = "";
  try {
    console.log(`Checking/Creating test student in Firebase Auth: ${email}...`);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
    console.log(`Successfully created test user with UID: ${uid}`);
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      console.log(`User already exists in Firebase Auth. Logging in to verify password...`);
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        uid = cred.user.uid;
        console.log(`Verified login successfully for ${email} with password: ${password}`);
      } catch (loginErr) {
        console.error(`Login failed with Test@123:`, loginErr.message);
        process.exit(1);
      }
    } else {
      console.error(`Error creating test student:`, err);
      process.exit(1);
    }
  }

  // Ensure user document exists in Firestore
  try {
    const userDocRef = doc(db, "users", uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      await setDoc(userDocRef, {
        name: "Google Play Reviewer",
        firstName: "Google Play",
        lastName: "Reviewer",
        email: email,
        phone: phone,
        mobile: phone,
        role: "student",
        status: "active",
        forcePasswordChange: false,
        isDemoMode: false,
        createdAt: new Date().toISOString(),
      });
      console.log("Firestore student profile created successfully.");
    } else {
      await setDoc(userDocRef, {
        name: "Google Play Reviewer",
        email: email,
        phone: phone,
        mobile: phone,
        role: "student",
        status: "active",
        forcePasswordChange: false,
      }, { merge: true });
      console.log("Firestore student profile verified and updated.");
    }
  } catch (dbErr) {
    console.error("Firestore update error:", dbErr);
  }

  console.log("\n==========================================");
  console.log("GOOGLE PLAY REVIEWER CREDENTIALS READY:");
  console.log(`Mobile Number: ${phone}`);
  console.log(`Password:      ${password}`);
  console.log("==========================================\n");
  process.exit(0);
}

setupReviewerAccount();
