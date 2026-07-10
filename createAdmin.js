import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCeL-ERiFO8MEkguguI6zeYGjaoESp7nUw",
  authDomain: "speakhubacademy-cb02c.firebaseapp.com",
  projectId: "speakhubacademy-cb02c",
  storageBucket: "speakhubacademy-cb02c.firebasestorage.app",
  messagingSenderId: "897542136110",
  appId: "1:897542136110:web:e7b3b153db8fafdbaddabf",
  measurementId: "G-E1T90E5EGH"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createAdmin() {
  const email = "admin@speakhub.com";
  const password = "password123";
  try {
    console.log("Creating user in Firebase Auth...");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log("Adding admin role to Firestore...");
    await setDoc(doc(db, "users", user.uid), {
      name: "Super Admin",
      email: email,
      role: "admin",
      status: "active",
      createdAt: new Date()
    });

    console.log("-----------------------------------------");
    console.log("SUCCESS! Admin account created.");
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log("-----------------------------------------");
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log("Admin account already exists!");
      console.log(`Email: ${email}`);
      console.log(`Password: Try the password you used previously (or 'password123').`);
    } else {
      console.error("Error creating admin:", error);
    }
    process.exit(1);
  }
}

createAdmin();
