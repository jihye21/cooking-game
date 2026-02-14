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
  inventory: {}, // 플레이어 인벤토리
  ovenState: null, // 현재 요리 중인 음식 정보
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
  ingredients: {
    x: 200,
    y: 350,
    width: 80,
    height: 80,
    emoji: '📦',
    name: 'Pantry',
  },
  submission: {
    x: 950,
    y: 100,
    width: 80,
    height: 80,
    emoji: '📬',
    name: 'Submission',
  },
  recipes: {
    x: 950,
    y: 350,
    width: 80,
    height: 80,
    emoji: '📖',
    name: 'Recipes',
  },
};

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

    // 요리 시스템 이벤트
    gameState.socket.on('ingredient_received', (data) => {
      gameState.inventory[data.itemType] = (gameState.inventory[data.itemType] || 0) + 1;
    });

    gameState.socket.on('cooking_finished', (data) => {
      if (gameState.ovenState && gameState.ovenState.recipeId === data.recipeId) {
        alert(`✅ ${gameState.ovenState.name} 요리가 완성되었습니다!`);
        // 요리 완료 시간 업데이트
        gameState.ovenFinishTime = Date.now();
      }
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
  gameState.inventory = { tomato: 0, onion: 0 }; // 인벤토리 초기화
  gameState.ovenState = null;
  
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

  // 요리 시스템 그리기
  drawCookingStations();

  // 아이템 그리기
  drawItems();

  // 플레이어 그리기
  drawPlayers();

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
    
    // 이모지 그리기
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(station.emoji, station.x + station.width / 2, station.y + station.height / 2);
    
    // 이름 그리기
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#333';
    ctx.fillText(station.name, station.x + station.width / 2, station.y + station.height + 15);
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
      gameState.socket.emit('interact_item', { itemId });
      break;
    }
  }
}

// 요리 시스템 상호작용
function handleStationInteract(stationType) {
  if (!gameState.socket) return;

  switch (stationType) {
    case 'ingredients':
      // 재료 획득
      gameState.socket.emit('get_ingredient');
      break;
    case 'oven':
      // 요리 시작
      showCookingMenu();
      break;
    case 'recipes':
      // 레시피 확인
      showRecipeMenu();
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
    .filter(([_, recipe]) => canCook(recipe))
    .map(([id, recipe]) => `${recipe.emoji} ${recipe.name}`)
    .join('\n');

  if (recipes.length === 0) {
    alert('요리할 수 있는 레시피가 없습니다.\n필요한 재료를 모아주세요.');
    return;
  }

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

  const cooked = gameState.ovenState ? `${gameState.ovenState.emoji} ${gameState.ovenState.name}` : '없음';
  const currentOrder = gameState.orders[0];
  const matches = currentOrder?.name === gameState.ovenState?.name;

  let message = `📬 음식 제출\n\n현재 주문: ${currentOrder?.emoji} ${currentOrder?.name}\n요리한 음식: ${cooked}`;
  
  if (matches && gameState.ovenState) {
    message += '\n\n✅ 현재 요리가 주문과 일치합니다!';
    if (confirm(message + '\n\n제출하시겠습니까?')) {
      gameState.socket.emit('submit_food', { recipeId: gameState.ovenState.recipeId });
      gameState.ovenState = null;
    }
  } else {
    alert(message + '\n\n❌ 주문과 맞지 않습니다.');
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

  // 인벤토리에서 재료 제거 (로컬)
  for (const [item, count] of Object.entries(recipe.ingredients)) {
    gameState.inventory[item] = (gameState.inventory[item] || 0) - count;
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
  gameState.inventory = {};
  gameState.ovenState = null;

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
