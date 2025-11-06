const admin = require('firebase-admin');

// Firebase 서비스 계정 정보 (환경변수에서 가져오기)
const serviceAccount = {
  type: 'service_account',
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL || process.env.FIREBASE_CLIENT_CERT_URL,
  universe_domain: 'googleapis.com'
};

// Firebase Admin 초기화 가능 여부
let initOk = true;
const missingEnvVars = [];

// 필수 환경 변수 검증
if (!serviceAccount.project_id || typeof serviceAccount.project_id !== 'string') {
  missingEnvVars.push('FIREBASE_PROJECT_ID');
  initOk = false;
}
if (!serviceAccount.private_key) {
  missingEnvVars.push('FIREBASE_PRIVATE_KEY');
  initOk = false;
}
if (!serviceAccount.client_email) {
  missingEnvVars.push('FIREBASE_CLIENT_EMAIL');
  initOk = false;
}
if (!process.env.FIREBASE_DATABASE_URL) {
  missingEnvVars.push('FIREBASE_DATABASE_URL');
  initOk = false;
}

// 환경 변수 누락 시 명확한 오류 메시지
if (!initOk) {
  console.error('╔══════════════════════════════════════════════════════════════╗');
  console.error('║           ⚠️  FIREBASE 연결 실패 - 중요한 알림 ⚠️            ║');
  console.error('╚══════════════════════════════════════════════════════════════╝');
  console.error('');
  console.error('다음 환경 변수가 누락되었거나 잘못되었습니다:');
  missingEnvVars.forEach(varName => {
    console.error(`  ❌ ${varName}`);
  });
  console.error('');
  console.error('⚠️  서버가 IN-MEMORY 모드로 실행됩니다.');
  console.error('⚠️  모든 데이터는 서버 재시작 시 삭제됩니다!');
  console.error('');
  console.error('해결 방법:');
  console.error('  1. .env 파일에 누락된 Firebase 환경 변수를 추가하세요');
  console.error('  2. Firebase 콘솔에서 서비스 계정 키를 다운로드하세요');
  console.error('  3. 서버를 재시작하세요');
  console.error('');
  console.error('╚══════════════════════════════════════════════════════════════╝');
}

if (initOk && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    console.log('✅ [Firebase] Admin successfully initialized:', serviceAccount.project_id);
    console.log('✅ [Firebase] Database URL:', process.env.FIREBASE_DATABASE_URL);
  } catch (e) {
    console.error('╔══════════════════════════════════════════════════════════════╗');
    console.error('║           ⚠️  FIREBASE 초기화 실패 ⚠️                        ║');
    console.error('╚══════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error('오류 메시지:', e.message);
    console.error('오류 스택:', e.stack);
    console.error('');
    console.error('⚠️  서버가 IN-MEMORY 모드로 실행됩니다.');
    console.error('⚠️  모든 데이터는 서버 재시작 시 삭제됩니다!');
    console.error('');
    console.error('╚══════════════════════════════════════════════════════════════╝');
    initOk = false;
  }
}


const db = initOk ? admin.database() : { ref: () => ({ push: () => ({ set: async () => {}, key: 'mock' }), once: async () => ({ exists: () => false }), update: async () => {}, remove: async () => {} }) };

// 컬렉션 이름 상수
const COLLECTIONS = {
  USERS: 'users',
  PLAYLISTS: 'playlists',
  SONGS: 'songs',
  PLAYLIST_SONGS: 'playlist_songs',
  LIKED_PLAYLISTS: 'liked_playlists',
  SONG_LIKES: 'song_likes',
  POSTS: 'posts',
  POST_LIKES: 'post_likes',
  SAVED_POSTS: 'saved_posts',
  FOLLOWS: 'follows',
  RECENT_VIEWS: 'recent_views',
  RECOMMENDATIONS: 'recommendations',
  SHARE_LINKS: 'share_links',
  PASSWORD_RESETS: 'password_resets',
  SPOTIFY_TOKENS: 'spotify_tokens',
  SOCIAL_TOKENS: 'social_tokens',
  PLAYBACK_HISTORY: 'playback_history'
};

// Firebase Realtime Database 헬퍼 클래스
class RealtimeDBHelpers {
  // 문서 생성
  static async createDocument(collection, data) {
    const ref = db.ref(collection).push();
    await ref.set({
      id: ref.key,
      ...data
    });
    return ref.key;
  }

  // ID로 문서 조회
  static async getDocumentById(collection, id) {
    if (!id) {
      return null;
    }

    const snapshot = await db.ref(`${collection}/${id}`).once('value');
    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.val();

    // Firebase RTDB 문서에는 기본적으로 id 필드가 없으므로 호출부에서 일관되게 사용하도록 추가한다
    return { ...data, id };
  }

  // 문서 업데이트
  static async updateDocument(collection, id, data) {
    await db.ref(`${collection}/${id}`).update(data);
  }

  // 문서 삭제
  static async deleteDocument(collection, id) {
    await db.ref(`${collection}/${id}`).remove();
  }

  // 모든 문서 조회
  static async getAllDocuments(collection) {
    const snapshot = await db.ref(collection).once('value');
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    if (!data || typeof data !== 'object') {
      return [];
    }
    const documents = [];
    
    for (const [id, document] of Object.entries(data)) {
      if (document !== null) {
        documents.push({ id, ...document });
      }
    }
    
    return documents;
  }

  // 조건으로 문서 조회
  static async queryDocuments(collection, field, value) {
    if (value === undefined) {
      console.warn(`[Firebase] queryDocuments called with undefined value for ${collection}.${field}`);
      return [];
    }
    const snapshot = await db.ref(collection).orderByChild(field).equalTo(value).once('value');
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    if (!data || typeof data !== 'object') {
      return [];
    }
    const documents = [];
    
    for (const [id, document] of Object.entries(data)) {
      if (document !== null) {
        documents.push({ id, ...document });
      }
    }
    
    return documents;
  }

  // 문서 정렬 조회
  static async getDocumentsSorted(collection, field, order = 'asc', limit = null) {
    let query = db.ref(collection).orderByChild(field);
    
    if (limit) {
      query = order === 'desc' ? query.limitToLast(limit) : query.limitToFirst(limit);
    }
    
    const snapshot = await query.once('value');
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    if (!data || typeof data !== 'object') {
      return [];
    }
    let results = Object.values(data).filter(item => item !== null);
    
    if (order === 'desc') {
      results.reverse();
    }
    
    return results;
  }

  // 복합 조건 조회 (AND 조건)
  static async queryDocumentsMultiple(collection, conditions) {
    const allDocs = await this.getAllDocuments(collection);
    
    return allDocs.filter(doc => {
      return conditions.every(condition => {
        const { field, operator, value } = condition;
        const fieldValue = doc[field];
        
        switch (operator) {
          case '==':
            return fieldValue === value;
          case '!=':
            return fieldValue !== value;
          case '>':
            return fieldValue > value;
          case '>=':
            return fieldValue >= value;
          case '<':
            return fieldValue < value;
          case '<=':
            return fieldValue <= value;
          case 'array-contains':
            return Array.isArray(fieldValue) && fieldValue.includes(value);
          default:
            return false;
        }
      });
    });
  }
}

module.exports = {
  db,
  admin,
  COLLECTIONS,
  RealtimeDBHelpers,
   isFirebaseReady: initOk
};
