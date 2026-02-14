# ⚡ 빠른 시작 가이드

## 5분 안에 게임 시작하기

### 1️⃣ 준비

```bash
# 1. Node.js 설치 (아직 안 했다면)
# macOS
brew install node

# Ubuntu/Debian
sudo apt-get install nodejs npm

# Windows
# https://nodejs.org/en/download/
```

### 2️⃣ 설치

```bash
# 이 폴더에서
npm install
```

### 3️⃣ 실행

```bash
npm start
```

### 4️⃣ 플레이

브라우저에서 **http://localhost:3000** 열기

---

## 🎮 게임 방법

### 단일 플레이어 테스트

1. **새 게임 시작** 클릭
2. 닉네임 입력
3. 게임 시작!

### 멀티플레이어 테스트 (2명)

**터미널 1 (서버)**
```bash
npm start
```

**터미널 2 또는 다른 브라우저**
```bash
http://localhost:3000
```

**플레이어 1**: "새 게임 시작" → 게임 코드 메모
**플레이어 2**: "게임 참여" → 게임 코드 입력

---

## 🎯 조작

| 키 | 동작 |
|---|---|
| **W/A/S/D** | 이동 |
| **E** | 아이템 상호작용 |
| **ESC** | 게임 나가기 |

---

## 🔧 개발 모드

코드 변경 시 자동 재시작:

```bash
npm run dev
```

---

## 📦 배포 준비

### GitHub에 푸시

```bash
git add .
git commit -m "Initial commit: Cooking Game"
git push origin main
```

### 백엔드 배포 (Render.com 추천)

1. [Render.com](https://render.com) 가입
2. "New Web Service" 생성
3. GitHub 리포지토리 선택
4. 배포 완료!

상세한 배포 방법: [DEPLOYMENT.md](DEPLOYMENT.md) 참조

---

**행운을 빕니다! 🍳✨**
