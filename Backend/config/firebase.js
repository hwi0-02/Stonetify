const admin = require('firebase-admin');

// Firebase 서비스 계정 키 (환경변수에서 가져오기)
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  universe_domain: "googleapis.com"
};

// Firebase Admin 초기화
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.database();

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
  FOLLOWS: 'follows',
  RECENT_VIEWS: 'recent_views',
  RECOMMENDATIONS: 'recommendations',
  SHARE_LINKS: 'share_links'
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
    const snapshot = await db.ref(`${collection}/${id}`).once('value');
    return snapshot.exists() ? snapshot.val() : null;
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
    const snapshot = await db.ref(collection).orderByChild(field).equalTo(value).once('value');
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    const documents = [];
    
    for (const [id, document] of Object.entries(data)) {
      if (document !== null) {
        documents.push({ id, ...document });
      }
    }
    
    return documents;
  }

  // 정렬된 문서 조회
  static async getDocumentsSorted(collection, field, order = 'asc', limit = null) {
    let query = db.ref(collection).orderByChild(field);
    
    if (limit) {
      query = order === 'desc' ? query.limitToLast(limit) : query.limitToFirst(limit);
    }
    
    const snapshot = await query.once('value');
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    let results = Object.values(data).filter(item => item !== null);
    
    if (order === 'desc') {
      results.reverse();
    }
    
    return results;
  }

  // 복합 조건 조회 (클라이언트 사이드 필터링)
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
  RealtimeDBHelpers
};
