import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics"; // 👈 [수정] isSupported를 import에 추가합니다.
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
// 👇 [수정] auth 관련 import 구문을 아래 두 줄로 변경합니다.
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';


const firebaseConfig = {
  apiKey: "AIzaSyA92HJ64QgxLJkBiNQhZnrRm9harswxQMs",
  authDomain: "stonetity.firebaseapp.com",
  databaseURL: "https://stonetity-default-rtdb.firebaseio.com",
  projectId: "stonetity",
  storageBucket: "stonetity.firebasestorage.app", // 'firebasestorage'가 아니라 'appspot.com'일 수 있습니다. 콘솔에서 다시 확인해보세요.
  messagingSenderId: "933444107691",
  appId: "1:933444107691:web:f748c9e82f7f2437a3e6ee",
  measurementId: "G-PHTVBSVKPT"
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// 👇 [수정] Analytics 초기화 부분을 isSupported()로 감싸서 지원되는 환경에서만 실행되도록 변경합니다.
isSupported().then((supported) => {
  if (supported) {
    const analytics = getAnalytics(app);
    console.log("Firebase Analytics가 성공적으로 초기화되었습니다.");
  } else {
    console.log("Firebase Analytics가 현재 환경에서 지원되지 않습니다.");
  }
});

// 필요한 Firebase 서비스들을 초기화하고 다른 파일에서 사용할 수 있도록 내보냅니다.
const database = getDatabase(app);
const storage = getStorage(app);

// 👇 [수정] Auth 초기화 부분을 로그인 상태가 유지되도록 persistence 옵션을 추가하여 변경합니다.
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export { database, storage, auth };