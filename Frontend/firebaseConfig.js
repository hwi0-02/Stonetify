// Frontend/firebaseConfig.js

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// 중요: 이 객체의 값들을 본인의 Firebase 프로젝트 정보로 교체해야 합니다.
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const firebaseConfig = {
  apiKey: "AIzaSyA92HJ64QgxLJkBiNQhZnrRm9harswxQMs",
  authDomain: "stonetity.firebaseapp.com",
  databaseURL: "https://stonetity-default-rtdb.firebaseio.com",
  projectId: "stonetity",
  storageBucket: "stonetity.firebasestorage.app",
  messagingSenderId: "933444107691",
  appId: "1:933444107691:web:f748c9e82f7f2437a3e6ee",
  measurementId: "G-PHTVBSVKPT"
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// 필요한 Firebase 서비스들을 초기화하고 다른 파일에서 사용할 수 있도록 내보냅니다.
const database = getDatabase(app);
const storage = getStorage(app);
const auth = getAuth(app); 

export { database, storage, auth };