import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, addDoc, collection, Timestamp, updateDoc } from "firebase/firestore";

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

async function seedData() {
  console.log("Starting data seed process...");

  let studentId = "";
  let teacherId = "";

  // 1. Create Auth Users & Users Documents
  try {
    const sCred = await createUserWithEmailAndPassword(auth, "student@speakhub.com", "password123");
    studentId = sCred.user.uid;
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      console.log("Student already exists. Skipping auth creation.");
      // For testing, we'll just hardcode or assume the user exists, but it's hard to get UID without login
      // We will login to get UID
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      const sCred = await signInWithEmailAndPassword(auth, "student@speakhub.com", "password123");
      studentId = sCred.user.uid;
    } else throw e;
  }

  try {
    const tCred = await createUserWithEmailAndPassword(auth, "teacher@speakhub.com", "password123");
    teacherId = tCred.user.uid;
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      console.log("Teacher already exists. Skipping auth creation.");
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      const tCred = await signInWithEmailAndPassword(auth, "teacher@speakhub.com", "password123");
      teacherId = tCred.user.uid;
    } else throw e;
  }

  console.log(`Student ID: ${studentId}, Teacher ID: ${teacherId}`);

  // Create users in Firestore
  await setDoc(doc(db, "users", studentId), {
    name: "John Student",
    email: "student@speakhub.com",
    role: "student",
    status: "active",
    phone: "9876543210",
    address: "Mumbai, India",
    createdAt: Timestamp.now()
  });

  await setDoc(doc(db, "users", teacherId), {
    name: "Sarah Teacher",
    email: "teacher@speakhub.com",
    role: "teacher",
    status: "active",
    phone: "9876543211",
    specialization: "English Grammar",
    createdAt: Timestamp.now()
  });

  // 2. Create Course
  console.log("Creating Course...");
  const courseRef = await addDoc(collection(db, "courses"), {
    courseName: "Spoken English Masterclass",
    description: "Learn fluent English in 3 months with interactive sessions.",
    duration: "3 Months",
    monthlyFee: 1500,
    modeBadge: "HYBRID",
    demoVideoUrl: "https://youtube.com/@speakhubacademy",
    status: "active",
    createdAt: Timestamp.now()
  });
  const courseId = courseRef.id;

  // 3. Create Batch
  console.log("Creating Batch...");
  const batchRef = await addDoc(collection(db, "batches"), {
    batchName: "Morning Batch A1",
    courseId: courseId,
    teacherId: teacherId,
    teacherName: "Sarah Teacher",
    scheduleDays: ["Monday", "Wednesday", "Friday"],
    startTime: "09:00 AM",
    endTime: "10:30 AM",
    status: "active",
    createdAt: Timestamp.now()
  });
  const batchId = batchRef.id;

  // Link users to batch and course
  await updateDoc(doc(db, "users", studentId), {
    batchIds: [batchId],
    courseIds: [courseId]
  });
  
  await updateDoc(doc(db, "users", teacherId), {
    batchIds: [batchId]
  });

  // 4. Create Notes
  console.log("Creating Notes...");
  await addDoc(collection(db, "notes"), {
    title: "Grammar Basics PDF",
    description: "Introduction to Nouns and Verbs",
    batchId: batchId,
    courseId: courseId,
    teacherId: teacherId,
    fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    fileName: "Grammar_Basics.pdf",
    type: "pdf",
    createdAt: Timestamp.now()
  });

  // 5. Create Exams & Questions
  console.log("Creating Exams...");
  const examRef = await addDoc(collection(db, "exams"), {
    title: "Weekly Grammar Test 1",
    description: "Basic grammar test for week 1",
    batchId: batchId,
    courseId: courseId,
    duration: 30, // minutes
    totalMarks: 20,
    status: "published",
    createdAt: Timestamp.now()
  });
  
  await addDoc(collection(db, "exam_questions"), {
    examId: examRef.id,
    questionText: "What is a noun?",
    type: "mcq",
    options: ["An action word", "A naming word", "A describing word", "A connecting word"],
    correctOptionIndex: 1,
    marks: 10
  });

  await addDoc(collection(db, "exam_questions"), {
    examId: examRef.id,
    questionText: "Which of the following is a verb?",
    type: "mcq",
    options: ["Apple", "Beautiful", "Run", "Quickly"],
    correctOptionIndex: 2,
    marks: 10
  });

  // 6. Create Homework
  console.log("Creating Homework...");
  await addDoc(collection(db, "homeworks"), {
    title: "Write 10 sentences",
    description: "Write 10 sentences using different verbs we learned today.",
    batchId: batchId,
    courseId: courseId,
    teacherId: teacherId,
    dueDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // Due in 7 days
    status: "active",
    createdAt: Timestamp.now()
  });

  // 7. Fee Plans & Transactions
  console.log("Creating Fees...");
  const feePlanRef = await addDoc(collection(db, "fee_plans"), {
    planName: "Standard 3 Month Plan",
    courseId: courseId,
    totalFee: 4500,
    installmentCount: 3,
    status: "active"
  });

  await addDoc(collection(db, "student_fee_plans"), {
    studentId: studentId,
    feePlanId: feePlanRef.id,
    assignedDate: Timestamp.now()
  });

  await addDoc(collection(db, "fee_transactions"), {
    studentId: studentId,
    studentName: "John Student",
    courseId: courseId,
    amountPaid: 1500,
    paymentDate: Timestamp.now(),
    paymentMethod: "UPI",
    transactionId: "TXN123456789",
    status: "success",
    receiptUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
  });

  // 8. Attendance
  console.log("Creating Attendance...");
  await addDoc(collection(db, "attendance"), {
    studentId: studentId,
    batchId: batchId,
    date: Timestamp.now(),
    status: "present",
    markedBy: teacherId
  });

  console.log("-----------------------------------------");
  console.log("SUCCESS! All dummy data seeded successfully.");
  console.log("Test Accounts:");
  console.log("Student: student@speakhub.com / password123");
  console.log("Teacher: teacher@speakhub.com / password123");
  console.log("-----------------------------------------");
  process.exit(0);
}

seedData().catch(console.error);
