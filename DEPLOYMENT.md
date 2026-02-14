# 🚀 배포 가이드

이 문서는 GitHub Pages와 무료 백엔드 호스팅을 사용하여 요리 게임을 배포하는 방법을 설명합니다.

## 📋 전체 배포 구조

```
┌─────────────────────┐
│   클라이언트        │
│  (GitHub Pages)     │
│   - index.html      │
│   - game.js         │
│   - style.css       │
└──────────┬──────────┘
           │ Socket.io
           ↓
┌─────────────────────┐
│   서버              │
│ (Render/Railway)    │
│   - server.js       │
│   - Node.js/Express │
└─────────────────────┘
```

## 옵션 1: Render.com (권장 - 가장 쉬움)

### 준비 단계

1. GitHub에 `cooking-game` 리포지토리 생성 및 코드 푸시
2. [Render.com](https://render.com)에 가입

### 배포 단계

1. **Render 대시보드** 접속
2. **New +** → **Web Service** 클릭
3. **Connect a repository** → `cooking-game` 선택
4. 배포 설정:
   - **Name**: `cooking-game-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
5. ✅ **Create Web Service** 클릭

### 배포 후

1. Render 대시보드에서 **서버 URL** 확인 (예: `https://cooking-game-api.onrender.com`)
2. 클라이언트에서 이 URL을 사용하도록 설정

```javascript
// public/game.js에서
const serverUrl = 'https://cooking-game-api.onrender.com'; // 실제 URL로 변경
```

### 주의사항

- Render 무료 플랜은 15분 이상 활동이 없으면 서버가 슬립 상태로 전환됨
- 첫 접속 시 약간의 지연이 있을 수 있음
- 데이터가 항시 초기화됨

---

## 옵션 2: Railway.app

### 준비 단계

1. GitHub 리포지토리 준비
2. [Railway.app](https://railway.app)에 가입

### 배포 단계

1. **Railway Dashboard** 접속
2. **New Project** → **Deploy from GitHub repo**
3. `cooking-game` 리포지토리 선택
4. Railway가 자동으로 `package.json`을 감지하고 배포 설정
5. 배포 완료 후 **Domain** 확인

### 환경 변수 설정

1. 프로젝트 설정으로 이동
2. **Variables** 탭에서 다음 설정:
   - `PORT`: `3000`
   - `NODE_ENV`: `production`

---

## 옵션 3: GitHub Pages (프론트엔드 배포)

GitHub Pages를 사용하여 프론트엔드만 배포할 수 있습니다.

### 단계

1. **Settings** → **Pages**
2. **Source**: `Deploy from a branch` 선택
3. **Branch**: `main`, `/ (root)` 선택
4. ✅ **Save** 클릭
5. 배포 완료! URL: `https://jihye21.github.io/cooking-game/`

### 클라이언트에서 서버 URL 설정

```javascript
// 로비 화면에서 수동으로 서버 URL 입력
// 또는 코드에 하드코딩
const serverUrl = 'https://your-render-server.onrender.com';
```

---

## 옵션 4: Vercel (고급)

프론트엔드를 Vercel에 배포하고 백엔드는 따로 호스팅할 수 있습니다.

1. [Vercel](https://vercel.com)에 가입
2. GitHub 리포지토리 연결
3. 빌드 설정에서 `public` 폴더를 root로 설정
4. 배포

---

## 🔧 로컬 테스트

배포 전에 로컬에서 테스트하세요:

```bash
# 1. 의존성 설치
npm install

# 2. 서버 실행
npm start

# 3. 브라우저에서 접속
# http://localhost:3000
```

---

## 🐛 트러블슈팅

### "서버 연결 실패"

- 서버 URL이 올바른지 확인
- 서버가 실행 중인지 확인
- 방화벽/CORS 설정 확인

### "게임이 느림"

- Render 무료 플랜은 자동 슬립 상태로 전환 가능
- 유료 플랜으로 업그레이드하면 해결

### "Socket.io 연결 안 됨"

- CORS 설정 확인
- 브라우저 개발자 도구의 Network 탭 확인
- 콘솔에서 에러 메시지 확인

---

## 📈 프로덕션 팁

1. **HTTPS 사용**: 배포 플랫폼이 자동으로 제공
2. **데이터베이스**: 현재는 메모리 저장소 사용 (재시작 시 초기화)
3. **확장성**: 많은 플레이어가 필요하면 MongoDB 등 추가

---

**배포 완료! 게임을 즐겨보세요! 🎮**
