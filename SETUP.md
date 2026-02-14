# 프로젝트 설정 가이드

이 문서는 로컬 환경에서 게임을 실행하고 배포하기 위한 추가 설정을 설명합니다.

## 🛠️ 로컬 환경 설정

### MacOS

```bash
# Node.js 설치
brew install node

# 프로젝트 폴더 이동
cd cooking-game

# 의존성 설치
npm install

# 서버 실행
npm start
```

### Ubuntu/Linux

```bash
# Node.js 설치
sudo apt-get update
sudo apt-get install nodejs npm

cd cooking-game
npm install
npm start
```

### Windows

1. [Node.js](https://nodejs.org) 설치
2. Command Prompt 또는 PowerShell에서:
```bash
cd cooking-game
npm install
npm start
```

---

## 📱 브라우저에서 접속

서버 실행 후 다음 주소로 접속:
- **http://localhost:3000**

---

## 🎮 테스트 플레이

### 싱글 플레이어
1. "새 게임 시작" 버튼 클릭
2. 닉네임 입력 후 게임 시작

### 멀티플레이어 (로컬)
1. **터미널 1**: `npm start` (서버 실행)
2. **브라우저 1**: http://localhost:3000 (플레이어 1)
3. **브라우저 2**: http://localhost:3000 (플레이어 2)
4. 플레이어 1이 "새 게임 시작", 플레이어 2가 "게임 참여" (같은 코드 입력)

---

## 💾 Git 설정

### 초기 커밋

```bash
cd cooking-game

# 현재 상태 확인
git status

# 모든 파일 추가
git add .

# 커밋 메시지
git commit -m "Initial commit: Cooking Game - Multiplayer Overcooked-style game"

# GitHub에 푸시
git push origin main
```

### 주의사항

- `.env` 파일은 `.gitignore`에 있어 자동으로 제외됨
- `node_modules` 폴더는 제외됨 (배포 시 다시 설치됨)

---

## 🚀 배포 체크리스트

배포 전에 확인하세요:

- [ ] 로컬에서 정상 작동 확인
- [ ] GitHub 리포지토리 준비
- [ ] 코드 커밋 및 푸시
- [ ] Render.com 또는 Railway.app 계정 준비
- [ ] 배포 플랫폼과 GitHub 연결
- [ ] 배포 후 서버 URL 확인

---

## 📚 상세 가이드

- [빠른 시작](QUICKSTART.md) - 5분 안에 시작
- [배포 가이드](DEPLOYMENT.md) - 상세 배포 방법

---

## 🆘 문제 해결

### "Port 3000이 이미 사용 중"

```bash
# 포트 변경
PORT=3001 npm start

# 또는 기존 프로세스 확인
lsof -i :3000
```

### "Cannot find module"

```bash
# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
```

### "Socket.io 연결 실패"

1. 서버가 실행 중인지 확인
2. 방화벽 설정 확인
3. 브라우저 개발자 도구에서 에러 확인

---

## 📝 코드 수정

게임을 커스터마이징하려면:

| 파일 | 목적 |
|---|---|
| `public/game.js` | 게임 로직 |
| `public/style.css` | UI 스타일 |
| `public/index.html` | HTML 구조 |
| `server/server.js` | 서버 로직 |

---

**프로젝트가 준비되었습니다! 🎉**
