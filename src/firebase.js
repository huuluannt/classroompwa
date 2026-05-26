import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
const provider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  if (!auth) {
    return {
      displayName: "Nguyen Van Demo",
      email: "learner.demo@student.edu.vn",
      photoURL: "",
      isDemo: true
    };
  }

  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export function getGoogleDriveUserKey() {
  return auth?.currentUser?.email || "local";
}

export async function getCurrentIdToken(forceRefresh = false) {
  return auth?.currentUser ? auth.currentUser.getIdToken(forceRefresh) : "";
}

export async function signOutGoogle() {
  if (auth) await signOut(auth);
}

export function observeAuth(callback) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}
