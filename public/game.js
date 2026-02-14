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

// 요리 레시피
const RECIPES = {
  tomato_soup: {
    name: '토마토 수프',
    emoji: '🍲',
    ingredients: { tomato: 2, onion: 1 },
    cookTime: 5,
    points: 50,
  },
  salad: {
    name: '샐러드',
    emoji: '🥗',
    ingredients: { tomato: 1, onion: 1 },
    cookTime: 3,
    points: 40,
  },
  onion_soup: {
    name: '양파 수프',
    emoji: '🍜',
    ingredients: { onion: 3 },
    cookTime: 7,
    points: 60,
  },
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
  heldItem: null, // 손에 들고 있는 아이템 (tomato, onion, plate)
  ovenState: null, // 현재 요리 중인 음식 정보
  cookedFood: null, // 완료된 요리 (접시에 담기 전)
  cookedFoodTimeout: 0, // 완료된 요리 타임아웃 시간
  ovenFinishTime: 0, // 요리 완료 시간
};

// Canvas 및 Context
let canvas, ctx;

// 요리 시스템 위치 (게임 맵에 고정)
const COOKING_STATIONS = {
  oven: {
    x: 200,
    y: 100,
    width: 80,
    height: 80,
    emoji: '🔥',
    name: 'Oven',
  },
  pantry_tomato: {
    x: 120,
    y: 350,
    width: 60,
    height: 60,
    emoji: '🍅',
    name: 'Tomato Pantry',
    itemType: 'tomato',
  },
  pantry_onion: {
    x: 260,
    y: 350,
    width: 60,
    height: 60,
    emoji: '🧅',
    name: 'Onion Pantry',
    itemType: 'onion',
  },
  garbage: {
    x: 950,
    y: 250,
    width: 60,
    height: 60,
    emoji: '🗑️',
    name: 'Garbage',
  },
  submission: {
    x: 950,
    y: 100,
    width: 80,
    height: 80,
    emoji: '📬',
    name: 'Submission',
  },
};

// 초기화
function init() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  
  setupEventListeners();
  showScreen('lobby');
}

// 캔버스 크기 조정 함수
function resizeCanvas() {
  if (!canvas || !canvas.parentElement) return;
  
  const container = canvas.parentElement;
  const width = Math.max(container.clientWidth || GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_WIDTH);
  const height = Math.min(600, window.innerHeight - 250);
  
  canvas.width = width;
  canvas.height = height;
}

// 화면 전환
function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenName);
  screen.classList.add('active');
  
  // 브라우저 리플로우 강제 트리거
  void screen.offsetHeight;
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
  const defaultUrl = window.location.origin;
  const serverUrl = document.getElementById('serverUrl').value || defaultUrl;
  const nickname = document.getElementById('nickname').value || 'Player' + Math.random().toString(36).substr(2, 9);
  
  gameState.nickname = nickname;
  gameState.isHost = true;
  gameState.gameCode = 'GAME' + Math.random().toString(36).substr(2, 6).toUpperCase();
  
  await connectToServer(serverUrl);
}

// 게임 참여
async function joinGame() {
  const defaultUrl = window.location.origin;
  const serverUrl = document.getElementById('serverUrl').value || defaultUrl;
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
      transports: ['websocket', 'polling'],
      remoteSync: false,
    });

    gameState.socket.on('connect', () => {
        statusEl.style.display = '';
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

      // 서버에서 받은 플레이어 데이터로 로컬 인벤토리 동기화 (특히 로컬 플레이어)
      if (gameState.playerId && gameState.players && gameState.players[gameState.playerId]) {
        const srvPlayer = gameState.players[gameState.playerId];
        gameState.inventory = srvPlayer.inventory || gameState.inventory;
        // readyDish 등 서버 상태를 로컬 ovenState로 매핑
        if (srvPlayer.cooking && !gameState.ovenState) {
          gameState.ovenState = {
            recipeId: srvPlayer.cooking.recipeId,
            name: srvPlayer.cooking.name,
            emoji: srvPlayer.cooking.emoji,
            cookTime: srvPlayer.cooking.finishTime ? Math.max(0, (srvPlayer.cooking.finishTime - Date.now())/1000) : srvPlayer.cooking.cookTime,
          };
          gameState.ovenFinishTime = srvPlayer.cooking.finishTime || 0;
        }
        if (srvPlayer.readyDish) {
          gameState.ovenState = {
            recipeId: srvPlayer.readyDish,
            name: gameState.ovenState?.name || (RECIPES[srvPlayer.readyDish]?.name || ''),
            emoji: RECIPES[srvPlayer.readyDish]?.emoji || '🍽️',
          };
        }
      }
    });

    gameState.socket.on('score_update', (data) => {
      if (data.playerId === gameState.playerId) {
        gameState.score = data.score;
        document.getElementById('playerScore').textContent = `점수: ${gameState.score}`;
      }
    });

    // 요리 시스템 이벤트
    gameState.socket.on('ingredient_received', (data) => {
        gameState.inventory[data.itemType] = (gameState.inventory[data.itemType] || 0) + 1;
        // 들고있는 아이템으로 표시
        gameState.heldItem = data.itemType;
    });

    gameState.socket.on('cooking_finished', (data) => {
      if (gameState.ovenState && gameState.ovenState.recipeId === data.recipeId) {
        alert(`✅ ${gameState.ovenState.name} 요리가 완성되었습니다!`);
        // 요리 완료 시간 업데이트
        gameState.ovenFinishTime = Date.now();
      }
    });

    gameState.socket.on('cooking_failed', (data) => {
      alert(`❌ 조리에 실패했습니다: ${data.reason || '알 수 없음'}`);
      // 서버에서 실패 알림을 받으면 로컬 오븐 상태 초기화
      gameState.ovenState = null;
    });

    gameState.socket.on('food_submitted', (data) => {
      if (data.success) {
        alert(`✅ 음식 제출 완료! +${data.points} 점수`);
      } else {
        alert(`❌ 주문과 맞지 않습니다.`);
      }
      gameState.ovenState = null;
    });

    gameState.socket.on('disconnect', () => {
      statusEl.style.display = '';
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
  
  // 게임 화면이 활성화된 후 캔버스 크기 조정
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // 브라우저 리페인트 강제 트리거
  if (canvas) {
    canvas.style.display = 'block';
  }
  
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

  // 서버에서 아이템이 없는 경우 로컬 더미 아이템 생성
  if (!gameState.items || Object.keys(gameState.items).length === 0) {
    gameState.items = generateLocalItems();
  }

  gameState.gameStarted = true;
  gameState.gameEnded = false;
  gameState.timeRemaining = GAME_CONFIG.GAME_DURATION;
  gameState.heldItem = null; // 손에 든 아이템 초기화
  gameState.ovenState = null;
  gameState.cookedFood = null;
  gameState.cookedFoodTimeout = 0;
  
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

  // 요리 스테이션과의 충돌 감지 (오븐, 펜트리, 쓰레기통)
  const collisionStations = ['oven', 'pantry_tomato', 'pantry_onion', 'garbage'];
  for (const stationType of collisionStations) {
    const station = COOKING_STATIONS[stationType];
    if (station) {
      const dx = gameState.localPlayer.x - (station.x + station.width / 2);
      const dy = gameState.localPlayer.y - (station.y + station.height / 2);
      const playerRadius = GAME_CONFIG.PLAYER_SIZE;
      const stationRadius = Math.max(station.width, station.height) / 2;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < playerRadius + stationRadius) {
        // 충돌 발생 - 이전 위치로 되돌리기
        gameState.localPlayer.x -= vx;
        gameState.localPlayer.y -= vy;
        break;
      }
    }
  }

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

  // 요리 시스템 그리기
  drawCookingStations();

  // 아이템 그리기
  drawItems();

  // 플레이어 그리기
  drawPlayers();

  // UI 그리기
  drawUI();
  drawHeldItemUI();
  drawOrderIngredientsBottom();
}

// 그리드 그리기 (중앙 파란선 제거)
function drawGrid() {
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;

  for (let x = GAME_CONFIG.TILE_SIZE; x < canvas.width; x += GAME_CONFIG.TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = GAME_CONFIG.TILE_SIZE; y < canvas.height; y += GAME_CONFIG.TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

// 요리 시스템 그리기
function drawCookingStations() {
  for (const stationType in COOKING_STATIONS) {
    const station = COOKING_STATIONS[stationType];
    
    // 배경 그리기
    ctx.fillStyle = '#fff5e1';
    ctx.fillRect(station.x, station.y, station.width, station.height);
    
    // 테두리 그리기
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 3;
    ctx.strokeRect(station.x, station.y, station.width, station.height);
    
    // 이모지 그리기 (캔버스에 정상 렌더링)
    ctx.save();
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#333';
    ctx.fillText(station.emoji, station.x + station.width / 2, station.y + station.height / 2);
    ctx.restore();
    
    // 이름 그리기
    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.fillText(station.name, station.x + station.width / 2, station.y + station.height + 12);
  }

  // 오븐 상태 표시
  if (gameState.ovenState) {
    const oven = COOKING_STATIONS.oven;
    const timeLeft = Math.max(0, gameState.ovenFinishTime - Date.now()) / 1000;
    
    if (timeLeft > 0) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(oven.x - 5, oven.y - 5, oven.width + 10, oven.height + 10);
      
      ctx.fillStyle = '#ff6b6b';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`⏱️ ${timeLeft.toFixed(1)}s`, oven.x + oven.width / 2, oven.y + oven.height + 35);
    }
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

// 로컬(서버 미연결)일 때 보여줄 임시 아이템 생성
function generateLocalItems() {
  const items = {};
  const itemTypes = ['tomato', 'onion', 'plate'];
  for (let i = 0; i < 8; i++) {
    const id = `local_item_${i}_${Math.floor(Math.random() * 100000)}`;
    items[id] = {
      id,
      type: itemTypes[Math.floor(Math.random() * itemTypes.length)],
      x: Math.random() * (canvas.width - 60) + 30,
      y: Math.random() * (canvas.height - 120) + 60,
      pickedBy: null,
    };
  }
  return items;
}

// 플레이어 그리기
function drawPlayers() {
  // 로컬 플레이어
  if (gameState.localPlayer) {
    drawPlayer(gameState.localPlayer, true);
  }

  // 다른 플레이어
  for (const playerId in gameState.players) {
    if (playerId === gameState.playerId) continue; // 로컬 플레이어는 이미 그렸음
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
  // 제거됨 - 십자선 및 범위 표시 제거
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
  const orderText = gameState.orders.length > 0 ? `📋 주문: ${gameState.orders[0]?.name || 'N/A'}` : '📋 주문 대기 중...';
  ctx.fillText(orderText, 10, 35);
  // (하단에 주문 재료가 표시되므로 상단에는 간단히 주문명만 노출)

  // 인벤토리 표시
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px Arial';
  ctx.fillText('📦 인벤토리:', 10, 60);
  
  let invY = 80;
  const itemEmojis = {
    tomato: '🍅',
    onion: '🧅',
    plate: '🍽️',
  };
  
  for (const itemType in gameState.inventory) {
    const count = gameState.inventory[itemType];
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.fillText(`${itemEmojis[itemType] || '📦'} ${itemType}: ${count}`, 10, invY);
    invY += 18;
  }

  // 현재 요리 상태
  if (gameState.ovenState) {
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(`🍳 요리 중: ${gameState.ovenState.name}`, 10, invY + 10);
  }
}

// 하단에 주문 재료 표시
function drawOrderIngredientsBottom() {
  if (!gameState.orders || gameState.orders.length === 0) return;
  const currentOrder = gameState.orders[0];
  const recipe = RECIPES[currentOrder.recipeId];
  if (!recipe) return;

  const padding = 10;
  const boxHeight = 20 + Object.keys(recipe.ingredients).length * 18 + padding * 2;
  const boxWidth = 260;
  const x = 15; // 캔버스 왼쪽에서 고정
  const y = canvas.height - boxHeight - 15; // 캔버스 아래에서 고정

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(x, y, boxWidth, boxHeight);
  ctx.strokeStyle = '#667eea';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, boxWidth, boxHeight);

  ctx.fillStyle = '#333';
  ctx.font = 'bold 14px Arial';
  ctx.fillText(`📋 주문: ${currentOrder.name}`, x + padding, y + 18);

  ctx.font = '12px Arial';
  let ingY = y + 36;
  for (const [item, count] of Object.entries(recipe.ingredients)) {
    const em = item === 'tomato' ? '🍅' : item === 'onion' ? '🧅' : '📦';
    ctx.fillText(`${em} ${item} x${count}`, x + padding, ingY);
    ingY += 18;
  }
  
  // 완료된 요리 상태 표시
  drawCookedFoodStatus();
}

// 완료된 요리 상태 표시 (게이지 바)
function drawCookedFoodStatus() {
  if (!gameState.cookedFood) return;
  
  const timeoutTime = gameState.cookedFoodTimeout;
  const now = Date.now();
  const timeLeft = Math.max(0, timeoutTime - now);
  const totalTime = 30000; // 30초
  const percentage = Math.max(0, timeLeft / totalTime);
  
  // UI 위치 (오른쪽 아래)
  const boxWidth = 200;
  const barHeight = 30;
  const x = canvas.width - boxWidth - 15;
  const y = canvas.height - barHeight - 15;
  
  // 배경 박스
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(x, y, boxWidth, barHeight);
  ctx.strokeStyle = '#ff6b6b';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, boxWidth, barHeight);
  
  // 게이지 바
  const barX = x + 5;
  const barY = y + 5;
  const barWidth = boxWidth - 10;
  const barHeight2 = barHeight - 10;
  
  // 배경 게이지
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(barX, barY, barWidth, barHeight2);
  
  // 진행 게이지
  ctx.fillStyle = percentage > 0.3 ? '#27ae60' : percentage > 0.1 ? '#f39c12' : '#e74c3c';
  ctx.fillRect(barX, barY, barWidth * percentage, barHeight2);
  
  // 텍스트
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${gameState.cookedFood.emoji} ${Math.ceil(timeLeft / 1000)}s`, x + boxWidth / 2, y + 20);
  
  // 시간 만료 체크
  if (timeLeft <= 0) {
    gameState.cookedFood = null;
    gameState.cookedFoodTimeout = 0;
  }
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

  const px = gameState.localPlayer.x;
  const py = gameState.localPlayer.y;

  // 근처의 요리 시스템 찾기
  for (const stationType in COOKING_STATIONS) {
    const station = COOKING_STATIONS[stationType];
    const dx = px - (station.x + station.width / 2);
    const dy = py - (station.y + station.height / 2);
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < GAME_CONFIG.INTERACT_RANGE + 50) {
      handleStationInteract(stationType);
      return;
    }
  }

  // 근처의 아이템 찾기
  for (const itemId in gameState.items) {
    const item = gameState.items[itemId];
    const dx = item.x - px;
    const dy = item.y - py;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < GAME_CONFIG.INTERACT_RANGE) {
      // 아이템을 집고 들고있는 상태로 유지
      gameState.socket.emit('interact_item', { itemId });
      gameState.heldItem = item.type;
      break;
    }
  }
}

// 요리 시스템 상호작용
function handleStationInteract(stationType) {
  if (!gameState.socket) return;

  switch (stationType) {
    case 'pantry_tomato':
      // 이미 손에 아이템이 있으면 첫 번째로 아이템 집지 않기
      if (gameState.heldItem) {
        alert('손이 비어있어야 합니다.');
      } else {
        gameState.socket.emit('get_ingredient', { type: 'tomato' });
        gameState.heldItem = 'tomato';
      }
      break;
    case 'pantry_onion':
      if (gameState.heldItem) {
        alert('손이 비어있어야 합니다.');
      } else {
        gameState.socket.emit('get_ingredient', { type: 'onion' });
        gameState.heldItem = 'onion';
      }
      break;
    case 'garbage':
      // 완료된 요리 버리기
      if (gameState.cookedFood) {
        gameState.cookedFood = null;
        gameState.cookedFoodTimeout = 0;
      } else if (gameState.heldItem) {
        gameState.heldItem = null;
      } else {
        alert('버릴 것이 없습니다.');
      }
      break;
    case 'oven':
      // 오븐이 비어있고, 손에 재료가 있으면 요리 시작
      if (gameState.ovenState === null && gameState.heldItem === null) {
        showCookingMenu();
      } else if (gameState.ovenState !== null) {
        // 요리가 완료되었으면 꺼내기
        const timeLeft = Math.max(0, gameState.ovenFinishTime - Date.now());
        if (timeLeft <= 0 && gameState.ovenState) {
          gameState.cookedFood = gameState.ovenState;
          gameState.ovenState = null;
          gameState.cookedFoodTimeout = Date.now() + 30000; // 30초 타임아웃
        }
      } else {
        alert('손이 비어있고 오븐이 비어있어야 합니다.');
      }
      break;
    case 'submission':
      // 음식 제출
      showSubmissionMenu();
      break;
  }
}

// 요리 메뉴 표시
function showCookingMenu() {
  const recipes = Object.entries(RECIPES)
    .map(([id, recipe]) => `${recipe.emoji} ${recipe.name}`)
    .join('\n');

  const choice = prompt(`🔥 요리할 음식을 선택하세요:\n${recipes}\n(또는 Cancel로 취소)`);
  if (choice) {
    const selectedRecipe = Object.entries(RECIPES).find(([_, recipe]) => 
      choice.includes(recipe.emoji) || choice.includes(recipe.name)
    );
    if (selectedRecipe) {
      startCooking(selectedRecipe[0], selectedRecipe[1]);
    }
  }
}

// 레시피 메뉴 표시
function showRecipeMenu() {
  let recipeText = '📖 레시피:\n\n';
  for (const [id, recipe] of Object.entries(RECIPES)) {
    const ingredients = Object.entries(recipe.ingredients)
      .map(([item, count]) => `${item} x${count}`)
      .join(', ');
    recipeText += `${recipe.emoji} ${recipe.name}\n재료: ${ingredients}\n조리시간: ${recipe.cookTime}초\n점수: ${recipe.points}\n\n`;
  }
  alert(recipeText);
}

// 주문 제출 메뉴 표시
function showSubmissionMenu() {
  if (gameState.orders.length === 0) {
    alert('현재 주문이 없습니다.');
    return;
  }

  const currentOrder = gameState.orders[0];
  
  // 접시에 담긴 요리만 제출 가능
  if (gameState.heldItem !== 'plate' || gameState.cookedFood === null) {
    alert('접시에 요리를 담아서 제출해주세요.');
    return;
  }

  const matches = currentOrder?.name === gameState.cookedFood?.name;

  if (matches) {
    if (confirm(`📬 주문: ${currentOrder?.emoji} ${currentOrder?.name}\n요리: ${gameState.cookedFood?.emoji} ${gameState.cookedFood?.name}\n\n제출하시겠습니까?`)) {
      gameState.socket.emit('submit_food', { recipeId: gameState.cookedFood.recipeId });
      gameState.cookedFood = null;
      gameState.heldItem = null;
    }
  } else {
    alert(`❌ 주문과 맞지 않습니다.\n주문: ${currentOrder?.emoji} ${currentOrder?.name}\n요리: ${gameState.cookedFood?.emoji} ${gameState.cookedFood?.name}`);
  }
}

// 표시: 들고있는 아이템 UI
function drawHeldItemUI() {
  if (!gameState.heldItem) return;
  const itemEmojis = { tomato: '🍅', onion: '🧅', plate: '🍽️' };
  ctx.fillStyle = '#333';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(`들고 있음: ${itemEmojis[gameState.heldItem] || '📦'}`, canvas.width - 10, 10 + 16);
  
  // 접시에 요리가 담겨있으면 표시
  if (gameState.heldItem === 'plate' && gameState.cookedFood) {
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`${gameState.cookedFood.emoji} ${gameState.cookedFood.name}`, canvas.width - 10, 10 + 32);
  }
}

// 요리 가능 여부 확인
function canCook(recipe) {
  for (const [item, count] of Object.entries(recipe.ingredients)) {
    if ((gameState.inventory[item] || 0) < count) {
      return false;
    }
  }
  return true;
}

// 요리 시작
function startCooking(recipeId, recipe) {
  if (!gameState.socket) return;

  gameState.ovenState = {
    recipeId,
    name: recipe.name,
    emoji: recipe.emoji,
    cookTime: recipe.cookTime,
    points: recipe.points,
  };
  gameState.ovenFinishTime = Date.now() + recipe.cookTime * 1000;

  gameState.socket.emit('start_cooking', {
    recipeId,
    ingredients: recipe.ingredients,
  });

  // 서버가 인벤토리를 관리하므로 로컬에서 재료를 직접 차감하지 않습니다.
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
  gameState.inventory = {};
  gameState.ovenState = null;

  backToLobby();
}

// 로비로 돌아가기
function backToLobby() {
  document.getElementById('nickname').value = '';
  document.getElementById('gameCode').value = '';
  const statusEl = document.getElementById('serverStatus');
  statusEl.textContent = '';
  statusEl.style.display = 'none';
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
