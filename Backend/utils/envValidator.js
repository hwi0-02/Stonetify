/**
 * 환경 변수 검증 유틸리티
 * 서버 시작 전에 필수 환경 변수가 올바르게 설정되었는지 확인
 */

// 필수 환경 변수 정의
const REQUIRED_ENV_VARS = {
  // 데이터베이스 관련
  FIREBASE_PROJECT_ID: {
    required: true,
    description: 'Firebase 프로젝트 ID',
    example: 'your-project-id',
  },
  FIREBASE_DATABASE_URL: {
    required: true,
    description: 'Firebase Realtime Database URL',
    example: 'https://your-project.firebaseio.com',
  },
  FIREBASE_PRIVATE_KEY: {
    required: true,
    description: 'Firebase 서비스 계정 Private Key',
    example: '-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n',
  },
  FIREBASE_CLIENT_EMAIL: {
    required: true,
    description: 'Firebase 서비스 계정 이메일',
    example: 'firebase-adminsdk@your-project.iam.gserviceaccount.com',
  },

  // Spotify API 관련
  SPOTIFY_CLIENT_ID: {
    required: true,
    description: 'Spotify Client ID',
    example: 'your_spotify_client_id',
  },
  SPOTIFY_CLIENT_SECRET: {
    required: true,
    description: 'Spotify Client Secret',
    example: 'your_spotify_client_secret',
  },

  // 소셜 로그인 관련
  KAKAO_REST_API_KEY: {
    required: false,
    description: 'Kakao REST API 키 (Kakao Developers에서 발급)',
    example: 'your_kakao_rest_api_key',
  },
  NAVER_CLIENT_ID: {
    required: false,
    description: 'Naver Client ID',
    example: 'your_naver_client_id',
  },
  NAVER_CLIENT_SECRET: {
    required: false,
    description: 'Naver Client Secret',
    example: 'your_naver_client_secret',
  },

  // 보안 관련
  JWT_SECRET: {
    required: true,
    description: 'JWT 토큰 서명 비밀 키',
    example: 'your_very_long_and_secure_random_secret_key',
  },
  ENCRYPTION_KEY: {
    required: true,
    description: '데이터 암호화 키 (32바이트)',
    example: 'your_32_character_encryption_key_here',
  },

  // 서버 설정
  PORT: {
    required: false,
    description: 'HTTP 서버 포트',
    example: '5000',
    default: '5000',
  },
  NODE_ENV: {
    required: false,
    description: '실행 환경 (development/production)',
    example: 'development',
    default: 'development',
  },

  // 프론트엔드 URL (CORS)
  FRONTEND_URL: {
    required: false,
    description: '프론트엔드 URL (CORS 허용)',
    example: 'https://your-frontend-url.com',
  },
};

// 환경 변수 유효성 검사
const validateEnvVar = (key, config) => {
  const value = process.env[key];

  // 필수 변수가 누락된 경우
  if (config.required && (!value || value.trim() === '')) {
    return {
      valid: false,
      error: `누락됨 - ${config.description}`,
      suggestion: `예시: ${config.example}`,
    };
  }

  // 선택적 변수이고 값이 없는 경우 (기본값 사용)
  if (!config.required && (!value || value.trim() === '')) {
    return {
      valid: true,
      warning: config.default
        ? `기본값 사용: ${config.default}`
        : '설정되지 않음 (선택 사항)',
    };
  }

  // 특정 변수에 대한 추가 검증
  if (key === 'ENCRYPTION_KEY' && value.length !== 32) {
    return {
      valid: false,
      error: 'ENCRYPTION_KEY는 정확히 32자여야 합니다',
      suggestion: `현재 길이: ${value.length}자`,
    };
  }

  if (key === 'PORT' && isNaN(parseInt(value))) {
    return {
      valid: false,
      error: 'PORT는 숫자여야 합니다',
      suggestion: `현재 값: ${value}`,
    };
  }

  if (key === 'NODE_ENV' && !['development', 'production', 'test'].includes(value)) {
    return {
      valid: true,
      warning: `일반적이지 않은 NODE_ENV 값: ${value}`,
    };
  }

  // URL 형식 검증
  if (key.includes('URL') && value && !value.startsWith('http')) {
    return {
      valid: false,
      error: 'URL은 http:// 또는 https://로 시작해야 합니다',
      suggestion: `현재 값: ${value}`,
    };
  }

  return { valid: true };
};

// 모든 환경 변수 검증
const validateEnvironment = () => {
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    missing: [],
    configured: [],
  };

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║              🔍 환경 변수 검증 중...                         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  for (const [key, config] of Object.entries(REQUIRED_ENV_VARS)) {
    const result = validateEnvVar(key, config);

    if (!result.valid) {
      results.valid = false;
      results.errors.push({
        key,
        error: result.error,
        suggestion: result.suggestion,
        description: config.description,
      });

      if (config.required) {
        results.missing.push(key);
      }
    } else {
      if (result.warning) {
        results.warnings.push({
          key,
          warning: result.warning,
          description: config.description,
        });
      } else {
        results.configured.push(key);
      }
    }
  }

  // 결과 출력
  if (results.configured.length > 0) {
    console.log('✅ 올바르게 설정된 환경 변수:');
    results.configured.forEach((key) => {
      console.log(`   ✓ ${key}`);
    });
    console.log('');
  }

  if (results.warnings.length > 0) {
    console.log('⚠️  경고:');
    results.warnings.forEach(({ key, warning, description }) => {
      console.log(`   ⚠ ${key}: ${warning}`);
      console.log(`      → ${description}`);
    });
    console.log('');
  }

  if (results.errors.length > 0) {
    console.log('❌ 오류:');
    results.errors.forEach(({ key, error, suggestion, description }) => {
      console.log(`   ✗ ${key}: ${error}`);
      console.log(`      → ${description}`);
      console.log(`      💡 ${suggestion}`);
    });
    console.log('');
  }

  if (!results.valid) {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           ⚠️  환경 변수 검증 실패 ⚠️                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`총 ${results.errors.length}개의 오류가 발견되었습니다.`);
    console.log('');
    console.log('해결 방법:');
    console.log('  1. .env 파일을 확인하세요');
    console.log('  2. 위에 나열된 환경 변수를 추가/수정하세요');
    console.log('  3. .env.example 파일을 참고하세요');
    console.log('  4. 서버를 재시작하세요');
    console.log('');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
  } else {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           ✅ 환경 변수 검증 완료                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
  }

  return results;
};

// 환경 변수 검증 결과에 따라 서버 시작 여부 결정
const validateAndExit = () => {
  const results = validateEnvironment();

  if (!results.valid) {
    console.error('❌ 필수 환경 변수가 설정되지 않아 서버를 시작할 수 없습니다.\n');
    process.exit(1);
  }

  return results;
};

module.exports = {
  validateEnvironment,
  validateAndExit,
  REQUIRED_ENV_VARS,
};
