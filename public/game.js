// 게임 설정
const GAME_CONFIG = {
  CANVAS_WIDTH: 1200,
  CANVAS_HEIGHT: 600,
  PLAYER_SIZE: 30,
  PLAYER_SPEED: 3,
  INTERACT_RANGE: 50,
  TILE_SIZE: 40,
  GAME_DURATION: 180, // 3분
};

// 게임 상태
const gameState = {
  socket: null,
  playerId: null,
  nickname: null,
  gameCode: null,
  isHost: false,
  players: {},
  items: {},
  orders: [],
  score: 0,
  gameStarted: false,
  gameEnded: false,
  timeRemaining: GAME_CONFIG.GAME_DURATION,
  localPlayer: null,
  keys: {
    w: false, a: false, s: false, d: false,
  },
};

// Canvas 및 Context
let canvas, ctx;

// 초기화
function init() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  
  // 반응형 캔버스 크기 조정
  function resizeCanvas() {
    const container = canvas.parentElement;
    const width = container.clientWidth;
    const height = Math.min(600, window.innerHeight - 250);
    
    canvas.width = width;
    canvas.height = height;
  }
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  setupEventListeners();
  showScreen('lobby');
}

// 화면 전환
function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenName).classList.add('active');
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 로비
  document.getElementById('createBtn').addEventListener('click', createGame);
  document.getElementById('joinBtn').addEventListener('click', joinGame);
  
  // 게임
  document.getElementById('leaveBtn').addEventListener('click', leaveGame);
  
  // 게임 오버
  document.getElementById('backToLobbyBtn').addEventListener('click', backToLobby);

  // 키보드 입력
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
}

// 게임 생성
async function createGame() {
  const serverUrl = document.getElementById('serverUrl').value || 'http://localhost:3000';
  const nickname = document.getElementById('nickname').value || 'Player' + Math.random().toString(36).substr(2, 9);
  
  gameState.nickname = nickname;
  gameState.isHost = true;
  gameState.gameCode = 'GAME' + Math.random().toString(36).substr(2, 6).toUpperCase();
  
  await connectToServer(serverUrl);
}

// 게임 참여
async function joinGame() {
  const serverUrl = document.getElementById('serverUrl').value || 'http://localhost:3000';
  const nickname = document.getElementById('nickname').value || 'Player' + Math.random().toString(36).substr(2, 9);
  const gameCode = document.getElementById('gameCode').value;
  
  if (!gameCode) {
    alert('게임 코드를 입력하세요.');
    return;
  }
  
  gameState.nickname = nickname;
  gameState.gameCode = gameCode;
  gameState.isHost = false;
  
  await connectToServer(serverUrl);
}

// 서버 연결
async function connectToServer(serverUrl) {
  try {
    const statusEl = document.getElementById('serverStatus');
    statusEl.textContent = '서버 연결 중...';
    statusEl.className = 'server-status';

    gameState.socket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    gameState.socket.on('connect', () => {
      statusEl.textContent = '✅ 서버 연결됨';
      statusEl.className = 'server-status connected';
      
      if (gameState.isHost) {
        gameState.socket.emit('create_game', {
          gameCode: gameState.gameCode,
          nickname: gameState.nickname,
        });
      } else {
        gameState.socket.emit('join_game', {
          gameCode: gameState.gameCode,
          nickname: gameState.nickname,
        });
      }
    });

    gameState.socket.on('game_joined', (data) => {
      gameState.playerId = data.playerId;
      gameState.players = data.players || {};
      gameState.orders = data.orders || [];
      gameState.score = 0;
      
      document.getElementById('displayGameCode').textContent = gameState.gameCode;
      startGameScreen();
    });

    gameState.socket.on('player_joined', (data) => {
      gameState.players[data.playerId] = data.player;
      updatePlayerCount();
    });

    gameState.socket.on('player_left', (data) => {
      delete gameState.players[data.playerId];
      updatePlayerCount();
    });

    gameState.socket.on('game_state_update', (data) => {
      gameState.players = data.players || gameState.players;
      gameState.items = data.items || gameState.items;
      gameState.orders = data.orders || gameState.orders;
      gameState.scores = data.scores || gameState.scores;
    });

    gameState.socket.on('score_update', (data) => {
      if (data.playerId === gameState.playerId) {
        gameState.score = data.score;
        document.getElementById('playerScore').textContent = `점수: ${gameState.score}`;
      }
    });

    gameState.socket.on('disconnect', () => {
      statusEl.textContent = '❌ 서버 연결 끊김';
      statusEl.className = 'server-status disconnected';
    });

  } catch (error) {
    console.error('서버 연결 실패:', error);
    document.getElementById('serverStatus').textContent = '❌ 서버 연결 실패';
    document.getElementById('serverStatus').className = 'server-status disconnected';
  }
}

// 게임 화면 시작
function startGameScreen() {
  showScreen('game');
  document.getElementById('playerName').textContent = gameState.nickname;
  document.getElementById('playerScore').textContent = `점수: 0`;
  updatePlayerCount();
  
  gameState.localPlayer = {
    id: gameState.playerId,
    x: Math.random() * (canvas.width - 60) + 30,
    y: Math.random() * (canvas.height - 60) + 30,
    vx: 0,
    vy: 0,
    angle: 0,
  };

  gameState.gameStarted = true;
  gameState.gameEnded = false;
  gameState.timeRemaining = GAME_CONFIG.GAME_DURATION;
  
  startGameLoop();
}

// 플레이어 수 업데이트
function updatePlayerCount() {
  const count = Object.keys(gameState.players).length;
  document.getElementById('playersCount').textContent = `플레이어: ${count}/4`;
}

// 게임 루프
function startGameLoop() {
  function gameLoop() {
    if (!gameState.gameStarted) return;

    // 로컬 플레이어 업데이트
    updateLocalPlayer();
    
    // 서버에 상태 전송
    if (gameState.socket && gameState.localPlayer) {
      gameState.socket.emit('player_move', {
        x: gameState.localPlayer.x,
        y: gameState.localPlayer.y,
        angle: gameState.localPlayer.angle,
      });
    }

    // 렌더링
    render();

    if (!gameState.gameEnded) {
      requestAnimationFrame(gameLoop);
    }
  }

  gameLoop();

  // 게임 타이머
  startGameTimer();
}

// 로컬 플레이어 업데이트
function updateLocalPlayer() {
  if (!gameState.localPlayer) return;

  let vx = 0, vy = 0;

  if (gameState.keys.w) vy -= GAME_CONFIG.PLAYER_SPEED;
  if (gameState.keys.s) vy += GAME_CONFIG.PLAYER_SPEED;
  if (gameState.keys.a) vx -= GAME_CONFIG.PLAYER_SPEED;
  if (gameState.keys.d) vx += GAME_CONFIG.PLAYER_SPEED;

  // 정규화 (대각선 이동 시 속도 유지)
  const magnitude = Math.sqrt(vx * vx + vy * vy);
  if (magnitude > 1) {
    vx /= magnitude;
    vy /= magnitude;
    vx *= GAME_CONFIG.PLAYER_SPEED;
    vy *= GAME_CONFIG.PLAYER_SPEED;
  }

  gameState.localPlayer.vx = vx;
  gameState.localPlayer.vy = vy;

  // 위치 업데이트
  gameState.localPlayer.x += vx;
  gameState.localPlayer.y += vy;

  // 경계 처리
  gameState.localPlayer.x = Math.max(GAME_CONFIG.PLAYER_SIZE, 
    Math.min(canvas.width - GAME_CONFIG.PLAYER_SIZE, gameState.localPlayer.x));
  gameState.localPlayer.y = Math.max(GAME_CONFIG.PLAYER_SIZE, 
    Math.min(canvas.height - GAME_CONFIG.PLAYER_SIZE, gameState.localPlayer.y));

  // 각도 계산
  if (magnitude > 0) {
    gameState.localPlayer.angle = Math.atan2(vy, vx);
  }
}

// 렌더링
function render() {
  ctx.fillStyle = '#e8f4f8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 그리드 그리기
  drawGrid();

  // 아이템 그리기
  drawItems();

  // 플레이어 그리기
  drawPlayers();

  // 상호작용 범위 표시
  if (gameState.localPlayer) {
    drawInteractRange();
  }

  // UI 그리기
  drawUI();
}

// 그리드 그리기
function drawGrid() {
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;

  for (let x = 0; x < canvas.width; x += GAME_CONFIG.TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y < canvas.height; y += GAME_CONFIG.TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

// 아이템 그리기
function drawItems() {
  const itemEmojis = {
    tomato: '🍅',
    onion: '🧅',
    plate: '🍽️',
    cooked: '🍳',
  };

  for (const itemId in gameState.items) {
    const item = gameState.items[itemId];
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(itemEmojis[item.type] || '📦', item.x, item.y);
  }
}

// 플레이어 그리기
function drawPlayers() {
  // 로컬 플레이어
  if (gameState.localPlayer) {
    drawPlayer(gameState.localPlayer, true);
  }

  // 다른 플레이어
  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    drawPlayer(player, false);
  }
}

// 개별 플레이어 그리기
function drawPlayer(player, isLocal) {
  const x = player.x;
  const y = player.y;

  // 플레이어 원
  ctx.fillStyle = isLocal ? '#667eea' : '#764ba2';
  ctx.beginPath();
  ctx.arc(x, y, GAME_CONFIG.PLAYER_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();

  // 플레이어 윤곽
  ctx.strokeStyle = isLocal ? '#5568d3' : '#653a87';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 방향 표시
  const angle = player.angle || 0;
  const dirX = Math.cos(angle) * (GAME_CONFIG.PLAYER_SIZE / 2 + 5);
  const dirY = Math.sin(angle) * (GAME_CONFIG.PLAYER_SIZE / 2 + 5);

  ctx.strokeStyle = isLocal ? '#5568d3' : '#653a87';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dirX, y + dirY);
  ctx.stroke();

  // 플레이어 이름
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const playerName = isLocal ? gameState.nickname : (gameState.players[player.id]?.nickname || 'Player');
  ctx.fillText(playerName, x, y - GAME_CONFIG.PLAYER_SIZE / 2 - 5);
}

// 상호작용 범위 표시
function drawInteractRange() {
  ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(gameState.localPlayer.x, gameState.localPlayer.y, GAME_CONFIG.INTERACT_RANGE, 0, Math.PI * 2);
  ctx.stroke();
}

// UI 그리기
function drawUI() {
  // 시간 표시
  ctx.fillStyle = '#333';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`⏱️ ${Math.floor(gameState.timeRemaining)}초`, 10, 10);

  // 현재 주문 표시
  ctx.fillStyle = '#667eea';
  ctx.font = 'bold 14px Arial';
  const orderText = gameState.orders.length > 0 ? `📋 주문: ${gameState.orders[0]}` : '📋 주문 대기 중...';
  ctx.fillText(orderText, 10, 35);
}

// 게임 타이머
function startGameTimer() {
  const timerInterval = setInterval(() => {
    gameState.timeRemaining -= 0.016; // 대략 60fps

    if (gameState.timeRemaining <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 16);
}

// 키보드 입력
function handleKeyDown(e) {
  const key = e.key.toLowerCase();
  if (key === 'w') gameState.keys.w = true;
  if (key === 'a') gameState.keys.a = true;
  if (key === 's') gameState.keys.s = true;
  if (key === 'd') gameState.keys.d = true;
  if (key === 'e') handleInteract();
  if (key === 'escape') leaveGame();
}

function handleKeyUp(e) {
  const key = e.key.toLowerCase();
  if (key === 'w') gameState.keys.w = false;
  if (key === 'a') gameState.keys.a = false;
  if (key === 's') gameState.keys.s = false;
  if (key === 'd') gameState.keys.d = false;
}

// 상호작용 처리
function handleInteract() {
  if (!gameState.localPlayer || !gameState.socket) return;

  // 근처의 아이템 찾기
  for (const itemId in gameState.items) {
    const item = gameState.items[itemId];
    const dx = item.x - gameState.localPlayer.x;
    const dy = item.y - gameState.localPlayer.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < GAME_CONFIG.INTERACT_RANGE) {
      gameState.socket.emit('interact_item', { itemId });
      break;
    }
  }
}

// 게임 종료
function endGame() {
  gameState.gameStarted = false;
  gameState.gameEnded = true;

  document.getElementById('finalScore').textContent = `최종 점수: ${gameState.score}`;
  document.getElementById('gameOverMessage').textContent = '게임 완료! 다시 게임을 시작할 수 있습니다.';

  showScreen('gameOver');

  if (gameState.socket) {
    gameState.socket.disconnect();
  }
}

// 게임 나가기
function leaveGame() {
  if (gameState.socket) {
    gameState.socket.emit('leave_game');
    gameState.socket.disconnect();
  }

  gameState.gameStarted = false;
  gameState.gameEnded = false;
  gameState.players = {};
  gameState.items = {};
  gameState.orders = [];

  backToLobby();
}

// 로비로 돌아가기
function backToLobby() {
  document.getElementById('nickname').value = '';
  document.getElementById('gameCode').value = '';
  document.getElementById('serverStatus').textContent = '';
  showScreen('lobby');
}

// 주문 목록 업데이트
function updateOrderList() {
  const orderListEl = document.getElementById('orderList');
  orderListEl.innerHTML = '';

  const orderEmojis = {
    soup: '🍲',
    salad: '🥗',
    burger: '🍔',
  };

  gameState.orders.forEach((order, index) => {
    const orderEl = document.createElement('div');
    orderEl.className = 'order-item';
    if (index === 0) orderEl.classList.add('active');
    orderEl.textContent = `${orderEmojis[order.type] || '🍽️'} ${order.name}`;
    orderListEl.appendChild(orderEl);
  });
}

// 게임 시작
window.addEventListener('DOMContentLoaded', init);
