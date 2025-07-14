// src/firebase.js

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ✅ Your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBTbh_nJfkwuV4Sfaillnuj31gf4PhFHP0",
  authDomain: "schoolbustrips-4b637.firebaseapp.com",
  projectId: "schoolbustrips-4b637",
  storageBucket: "schoolbustrips-4b637.appspot.com",
  messagingSenderId: "77438270896",
  appId: "1:77438270896:web:b61f5d00fd8f987001aa75",
  measurementId: "G-VSF0ZFQDQ0",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Export Firestore and Auth instances
export const db = getFirestore(app);
export const auth = getAuth(app);
