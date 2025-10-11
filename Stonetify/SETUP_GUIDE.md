# 🎵 Stonetify 프로젝트 설치 및 실행 가이드

## 📋 필수 사전 설치 프로그램

### 1. Node.js 설치
```bash
# Node.js 18.x 이상 버전 설치 (권장: v18.20.0 이상)
# https://nodejs.org/en/ 에서 다운로드
node --version  # 설치 확인
npm --version   # npm 확인
```

### 2. Git 설치
```bash
# https://git-scm.com/ 에서 다운로드
git --version  # 설치 확인
```

### 3. MySQL 설치
```bash
# https://dev.mysql.com/downloads/mysql/ 에서 다운로드
# 또는 XAMPP, WAMP 등 사용 가능
mysql --version  # 설치 확인
```

### 4. Expo CLI 설치
```bash
npm install -g @expo/cli
expo --version  # 설치 확인
```

### 5. 모바일 테스트용 앱 설치
- **iOS**: App Store에서 "Expo Go" 설치
- **Android**: Google Play에서 "Expo Go" 설치

## 🚀 프로젝트 설치 및 설정

### 1. 프로젝트 클론
```bash
git clone https://github.com/hwi0-02/Stonetify.git
cd Stonetify
```

### 2. Backend 설정

#### 2.1 의존성 설치
```bash
cd Backend
npm install
```

#### 2.2 환경변수 설정
**Backend/.env 파일 생성**:
```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=stonetify
DB_PORT=3306

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_here

# Server Configuration
PORT=5000
NODE_ENV=development

# Spotify API (선택사항)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# SSL Configuration (선택사항)
SSL_KEY_PATH=
SSL_CERT_PATH=
HTTPS_PORT=5443
```

#### 2.3 데이터베이스 설정
```sql
-- MySQL에서 데이터베이스 생성
CREATE DATABASE stonetify;
USE stonetify;

-- 또는 MySQL Workbench나 phpMyAdmin 사용
```

### 3. Frontend 설정

#### 3.1 의존성 설치
```bash
cd ../Frontend
npm install
```

#### 3.2 환경변수 설정
**Frontend/.env 파일 생성**:
```env
# ==================== Stonetify Environment Configuration ====================

# Backend Server Configuration (본인의 로컬 IP로 변경)
BACKEND_HOST=192.168.1.XXX  # 본인의 로컬 IP 주소
BACKEND_PORT=5000

# Development API URLs
DEV_API_URL=http://192.168.1.XXX:5000/api/
TUNNEL_API_URL=http://192.168.1.XXX:5000/api/

# Proxy Server Configuration  
PROXY_PORT=3001
PROXY_API_URL=http://localhost:3001/proxy/api/

# Production Configuration
PROD_API_URL=https://your-production-api.com/api/

# Network Configuration
API_TIMEOUT=15000
RETRY_DELAY=1000

# Expo Public Variables
EXPO_PUBLIC_API_URL=http://192.168.1.XXX:5000/api/
EXPO_PUBLIC_API_TIMEOUT=15000
EXPO_PUBLIC_TUNNEL_API_URL=http://192.168.1.XXX:5000/api/
```

#### 3.3 로컬 IP 주소 확인 방법
```bash
# Windows
ipconfig

# macOS/Linux
ifconfig
# 또는
ip addr show

# 일반적으로 192.168.x.x 또는 10.x.x.x 형태
```

### 4. 프록시 서버 의존성 설치
```bash
# Frontend 폴더에서 실행
npm install express http-proxy-middleware cors
```

## 🎯 실행 방법

### 1. Backend 서버 실행
```bash
cd Backend
npm start
# 또는
npm run dev  # nodemon 사용시

# 실행 확인: http://localhost:5000
```

### 2. Frontend 실행 (로컬 모드)
```bash
cd Frontend
npx expo start

# 또는 특정 플랫폼으로 실행
npx expo start --ios     # iOS 시뮬레이터
npx expo start --android # Android 에뮬레이터
npx expo start --web     # 웹 브라우저
```

### 3. 터널 모드 실행 (외부 접근 가능)
```bash
cd Frontend

# 방법 1: 수동 실행
# 터미널 1 - 프록시 서버 실행
node proxy-server.js

# 터미널 2 - Expo 터널 모드
npx expo start --tunnel

# 방법 2: 자동 실행 스크립트 (Windows PowerShell)
.\start-tunnel.ps1
```

## 📱 모바일 테스트

### 1. 로컬 네트워크에서 테스트
1. Backend 서버 실행 확인
2. Frontend에서 `npx expo start` 실행
3. 같은 WiFi 네트워크에 연결된 모바일에서 Expo Go 앱으로 QR 코드 스캔

### 2. 터널 모드에서 테스트
1. 프록시 서버 실행 (`node proxy-server.js`)
2. `npx expo start --tunnel` 실행
3. 어디서든 Expo Go 앱으로 QR 코드 스캔 가능

## 🌐 웹 브라우저에서 테스트

### 1. 로컬 모드
```bash
npx expo start --web
# 자동으로 브라우저에서 http://localhost:8081 열림
```

### 2. 터널 모드
```bash
# 프록시 서버 실행 후
npx expo start --tunnel
# 브라우저에서 표시된 localhost URL 접속
```

## 🔧 문제 해결

### 1. Backend 연결 오류
```bash
# 방화벽 확인
# Windows: 방화벽에서 5000번 포트 허용
# macOS: 시스템 환경설정 > 보안 및 개인정보보호 > 방화벽

# MySQL 연결 확인
mysql -u root -p
USE stonetify;
SHOW TABLES;
```

### 2. Frontend 연결 오류
```bash
# 캐시 정리
npx expo start --clear

# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```

### 3. IP 주소 문제
- `.env` 파일의 IP 주소를 본인의 로컬 IP로 정확히 설정
- `ipconfig` (Windows) 또는 `ifconfig` (macOS/Linux)로 확인
- 일반적으로 `192.168.1.XXX` 또는 `192.168.0.XXX` 형태

### 4. 포트 충돌 문제
```bash
# 포트 사용 확인
netstat -an | findstr :5000  # Windows
netstat -an | grep :5000     # macOS/Linux

# 프로세스 종료
taskkill /PID [PID번호] /F    # Windows
kill -9 [PID번호]            # macOS/Linux
```

## 📚 주요 기능 테스트

### 1. 회원가입/로그인
- 웹 또는 모바일에서 회원가입 테스트
- 로그인 후 토큰 저장 확인

### 2. 플레이리스트 기능
- 플레이리스트 생성, 수정, 삭제
- 곡 추가/제거
- 플레이리스트 공유

### 3. Spotify 연동 (선택사항)
- Spotify API 키 설정 시 음악 검색 기능
- 플레이리스트에 Spotify 곡 추가

## 🎉 설치 완료!

모든 설정이 완료되면:
- ✅ Backend: `http://localhost:5000`
- ✅ Frontend 웹: `http://localhost:8081`
- ✅ 모바일: Expo Go 앱에서 QR 코드 스캔
- ✅ 터널 모드: 어디서든 접근 가능

**Happy Coding! 🎵**
