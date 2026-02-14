# 🍳 요리 게임 멀티플레이

Overcooked 스타일의 온라인 멀티플레이 요리 게임입니다. GitHub Pages와 무료 백엔드 호스팅으로 구축되었습니다.

## 🎮 게임 기능

- **실시간 멀티플레이**: 최대 4명까지 동시 플레이
- **협력 게임플레이**: WASD로 이동하고 E로 아이템 상호작용
- **요리 시스템**: 다양한 음식 조리 및 주문 완성
- **점수 시스템**: 요리 완성으로 점수 획득
- **3분 단판**: 빠르고 재미있는 게임 플레이

## ⌨️ 조작법

| 키 | 동작 |
|---|---|
| **W** | 위로 이동 |
| **A** | 왼쪽 이동 |
| **S** | 아래로 이동 |
| **D** | 오른쪽 이동 |
| **E** | 아이템 상호작용 (들기/내려놓기) |
| **ESC** | 게임 나가기 |

## 🚀 시작하기

### 로컬 개발

```bash
# 1. Node.js 설치 (v14 이상)
# https://nodejs.org

# 2. 의존성 설치
npm install

# 3. 서버 시작
npm start

# 4. 브라우저에서 열기
# http://localhost:3000
```

### 개발 모드 (자동 재시작)

```bash
npm run dev
```

## 🌐 배포

### 배포 옵션

프론트엔드 (GitHub Pages) + 백엔드 (무료 호스팅)

#### 옵션 1: Render.com 배포 (권장)

1. [Render.com](https://render.com)에 가입
2. 새 Web Service 생성
3. GitHub 리포지토리 연결
4. 빌드 커맨드: `npm install`
5. 시작 커맨드: `npm start`
6. 환경 변수: `PORT=3000`  
7. 배포 후 서버 URL을 클라이언트에서 사용

#### 옵션 2: Railway 배포

1. [Railway.app](https://railway.app)에 가입
2. 새 프로젝트 생성
3. GitHub 리포지토리 연결
4. 자동 배포 구성
5. 서버 URL을 클라이언트에서 사용

#### 옵션 3: Vercel + API (고급)

1. Vercel에 프론트엔드 배포
2. 별도 Node.js 호스팅에서 백엔드 실행

## 📁 프로젝트 구조

```
cooking-game/
├── public/                 # 프론트엔드 (정적 파일)
│   ├── index.html         # 메인 HTML
│   ├── style.css          # 스타일시트
│   └── game.js            # 게임 로직
├── server/                # 백엔드 (Node.js)
│   ├── server.js          # Socket.io 서버
│   └── package.json
├── README.md              # 이 파일
└── package.json           # 프로젝트 설정
```

## 🔧 기술 스택

- **프론트엔드**: HTML5 Canvas, JavaScript
- **백엔드**: Node.js, Express.js
- **실시간 통신**: Socket.io
- **호스팅**: GitHub Pages (프론트엔드), Render/Railway (백엔드)

## 🎯 게임 플레이 팁

1. **팀 작업**: 다른 플레이어와 협력하여 요리 완성
2. **효율성**: 제한된 시간 내에 더 많은 요리 완성
3. **위치 최적화**: 자주 쓰는 도구 근처에 자리 잡기
4. **높은 점수**: 빨리 요리를 완성할수록 더 많은 점수

## 🐛 알려진 문제

- 네트워크 지연 시 플레이어 동기화 지연 가능
- 모바일 기기에서 터치 지원 미구현

## 📝 라이선스

MIT License

## 🤝 기여

버그 리포트 및 기능 제안은 GitHub Issues에서 받습니다.

---

**즐거운 게임 되세요! 🎮✨**