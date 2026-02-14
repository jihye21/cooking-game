const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false,
    transports: ['websocket', 'polling'],
  },
  pingInterval: 25000,
  pingTimeout: 20000,
});

app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// 게임 데이터
const games = new Map();
const players = new Map();

// 게임 클래스
class Game {
  constructor(gameCode, hostPlayerId, hostNickname) {
    this.gameCode = gameCode;
    this.hostPlayerId = hostPlayerId;
    this.players = {
      [hostPlayerId]: {
        id: hostPlayerId,
        nickname: hostNickname,
        x: Math.random() * 1200,
        y: Math.random() * 600,
        angle: 0,
        score: 0,
        inventory: { tomato: 0, onion: 0 },
      },
    };
    // 요리 시스템 정의 (orders 생성 전에 설정)
    this.recipes = {
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

    this.items = this.generateItems();
    this.orders = this.generateOrders();
    this.startTime = Date.now();
    this.duration = 180; // 3분
    this.gameStarted = true;
    this.ovenState = null;
    this.ovenFinishTime = 0;
  }

  generateItems() {
    const items = {};
    const itemTypes = ['tomato', 'onion', 'plate'];
    
    for (let i = 0; i < 8; i++) {
      const id = `item_${Date.now()}_${i}`;
      items[id] = {
        id,
        type: itemTypes[Math.floor(Math.random() * itemTypes.length)],
        x: Math.random() * 1200,
        y: Math.random() * 600,
        pickedBy: null,
      };
    }
    
    return items;
  }

  generateOrders() {
    const recipes = this.recipes || {
      tomato_soup: { name: '토마토 수프', emoji: '🍲', ingredients: { tomato: 2, onion: 1 }, cookTime: 5, points: 50 },
      salad: { name: '샐러드', emoji: '🥗', ingredients: { tomato: 1, onion: 1 }, cookTime: 3, points: 40 },
      onion_soup: { name: '양파 수프', emoji: '🍜', ingredients: { onion: 3 }, cookTime: 7, points: 60 },
    };

    const recipeKeys = Object.keys(recipes);
    if (recipeKeys.length === 0) return [];

    const orders = [];
    for (let i = 0; i < 5; i++) {
      const recipeKey = recipeKeys[Math.floor(Math.random() * recipeKeys.length)];
      const recipe = recipes[recipeKey];

      orders.push({
        id: `order_${Date.now()}_${i}`,
        name: recipe.name,
        emoji: recipe.emoji,
        recipeId: recipeKey,
        completed: false,
      });
    }

    return orders;
  }

  addPlayer(playerId, nickname) {
    this.players[playerId] = {
      id: playerId,
      nickname,
      x: Math.random() * 1200,
      y: Math.random() * 600,
      angle: 0,
      score: 0,
      inventory: { tomato: 0, onion: 0 },
    };
  }

  removePlayer(playerId) {
    delete this.players[playerId];
  }

  updatePlayerPosition(playerId, x, y, angle) {
    if (this.players[playerId]) {
      this.players[playerId].x = x;
      this.players[playerId].y = y;
      this.players[playerId].angle = angle;
    }
  }

  addScore(playerId, points) {
    if (this.players[playerId]) {
      this.players[playerId].score += points;
    }
  }

  getState() {
    return {
      gameCode: this.gameCode,
      players: this.players,
      items: this.items,
      orders: this.orders.filter(o => !o.completed).slice(0, 5),
      isGameActive: Date.now() - this.startTime < this.duration * 1000,
    };
  }

  isGameActive() {
    return Date.now() - this.startTime < this.duration * 1000;
  }
}

// Socket.io 이벤트
io.on('connection', (socket) => {
  console.log(`플레이어 연결: ${socket.id}`);

  socket.on('create_game', (data) => {
    const { gameCode, nickname } = data;

    if (games.has(gameCode)) {
      socket.emit('error', '이미 존재하는 게임 코드입니다.');
      return;
    }

    const game = new Game(gameCode, socket.id, nickname);
    games.set(gameCode, game);
    players.set(socket.id, { gameCode, playerId: socket.id });

    socket.join(gameCode);
    socket.emit('game_joined', {
      playerId: socket.id,
      players: game.players,
      items: game.items,
      orders: game.orders,
    });

    console.log(`새 게임 생성: ${gameCode}`);
  });

  socket.on('join_game', (data) => {
    const { gameCode, nickname } = data;
    const game = games.get(gameCode);

    if (!game) {
      socket.emit('error', '게임을 찾을 수 없습니다.');
      return;
    }

    if (Object.keys(game.players).length >= 4) {
      socket.emit('error', '게임이 가득 찼습니다.');
      return;
    }

    game.addPlayer(socket.id, nickname);
    players.set(socket.id, { gameCode, playerId: socket.id });

    socket.join(gameCode);
    socket.emit('game_joined', {
      playerId: socket.id,
      players: game.players,
      items: game.items,
      orders: game.orders,
    });

    io.to(gameCode).emit('player_joined', {
      playerId: socket.id,
      player: game.players[socket.id],
    });

    console.log(`플레이어 참여: ${gameCode}`);
  });

  socket.on('player_move', (data) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) return;

    const game = games.get(playerInfo.gameCode);
    if (!game || !game.isGameActive()) return;

    game.updatePlayerPosition(socket.id, data.x, data.y, data.angle);

    io.to(playerInfo.gameCode).emit('game_state_update', {
      players: game.players,
    });
  });

  socket.on('interact_item', (data) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) return;

    const game = games.get(playerInfo.gameCode);
    if (!game) return;

    const item = game.items[data.itemId];
    if (!item) return;

    // 아이템 픽업
    const player = game.players[socket.id];
    if (item.pickedBy === null) {
      item.pickedBy = socket.id;
      // 플레이어 인벤토리 객체로 처리
      if (!player.inventory) player.inventory = { tomato: 0, onion: 0 };
      if (item.type === 'tomato' || item.type === 'onion') {
        player.inventory[item.type] = (player.inventory[item.type] || 0) + 1;
        // 클라이언트에 재료 수신 알림
        socket.emit('ingredient_received', { itemType: item.type });
      } else if (item.type === 'cooked') {
        // 익힌 음식은 즉시 점수로 변환
        game.addScore(socket.id, 10);
        socket.emit('score_update', {
          playerId: socket.id,
          score: player.score,
        });
      }

      // 다음 아이템 생성
      if (item.type === 'tomato' || item.type === 'onion') {
        item.x = Math.random() * 1200;
        item.y = Math.random() * 600;
        item.pickedBy = null;
      }
    }

    io.to(playerInfo.gameCode).emit('game_state_update', {
      players: game.players,
      items: game.items,
    });
  });

  // 재료 획득 (판넬에서 E로 재료 얻기)
  socket.on('get_ingredient', (data) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) return;

    const game = games.get(playerInfo.gameCode);
    if (!game) return;

    const player = game.players[socket.id];
    if (!player.inventory) player.inventory = { tomato: 0, onion: 0 };

    // 클라이언트가 특정 타입을 요청하면 그 타입을 주고, 아니면 랜덤
    const types = ['tomato', 'onion'];
    let pick = types[Math.floor(Math.random() * types.length)];
    if (data && data.type && types.includes(data.type)) pick = data.type;
    player.inventory[pick] = (player.inventory[pick] || 0) + 1;

    socket.emit('ingredient_received', { itemType: pick });

    io.to(playerInfo.gameCode).emit('game_state_update', {
      players: game.players,
      items: game.items,
    });
  });

  // 조리 시작
  socket.on('start_cooking', (data) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) return;

    const game = games.get(playerInfo.gameCode);
    if (!game) return;

    const { recipeId } = data;
    const recipe = game.recipes[recipeId];
    if (!recipe) return;

    const player = game.players[socket.id];
    if (!player.inventory) player.inventory = { tomato: 0, onion: 0 };

    // 재료 부족 검사
    for (const [item, count] of Object.entries(recipe.ingredients)) {
      if ((player.inventory[item] || 0) < count) {
        socket.emit('cooking_failed', { reason: '재료 부족' });
        return;
      }
    }

    // 재료 차감
    for (const [item, count] of Object.entries(recipe.ingredients)) {
      player.inventory[item] = (player.inventory[item] || 0) - count;
    }

    // 조리 상태 설정 (플레이어별)
    player.cooking = {
      recipeId,
      name: recipe.name,
      emoji: recipe.emoji,
      finishTime: Date.now() + recipe.cookTime * 1000,
      points: recipe.points,
    };

    io.to(playerInfo.gameCode).emit('game_state_update', {
      players: game.players,
      items: game.items,
    });

    // 조리 완료 처리
    setTimeout(() => {
      // 조리 완료 시 플레이어의 readyDish 설정
      if (game.players[socket.id] && game.players[socket.id].cooking && game.players[socket.id].cooking.recipeId === recipeId) {
        game.players[socket.id].readyDish = recipeId;
        game.players[socket.id].cooking = null;
        socket.emit('cooking_finished', { recipeId });

        io.to(playerInfo.gameCode).emit('game_state_update', {
          players: game.players,
          items: game.items,
        });
      }
    }, recipe.cookTime * 1000);
  });

  // 음식 제출
  socket.on('submit_food', (data) => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) return;

    const game = games.get(playerInfo.gameCode);
    if (!game) return;

    const player = game.players[socket.id];
    const recipeId = data.recipeId;

    // 준비된 음식 확인
    if (!player.readyDish || player.readyDish !== recipeId) {
      socket.emit('food_submitted', { success: false });
      return;
    }

    const currentOrder = game.orders.find(o => !o.completed);
    if (!currentOrder) {
      socket.emit('food_submitted', { success: false });
      return;
    }

    if (currentOrder.recipeId === recipeId) {
      // 주문 완료
      currentOrder.completed = true;
      player.readyDish = null;
      game.addScore(socket.id, game.recipes[recipeId].points);

      socket.emit('food_submitted', { success: true, points: game.recipes[recipeId].points });
      socket.emit('score_update', { playerId: socket.id, score: player.score });

      io.to(playerInfo.gameCode).emit('game_state_update', {
        players: game.players,
        items: game.items,
        orders: game.orders.filter(o => !o.completed),
      });
    } else {
      socket.emit('food_submitted', { success: false });
    }
  });

  socket.on('leave_game', () => {
    const playerInfo = players.get(socket.id);
    if (!playerInfo) return;

    const game = games.get(playerInfo.gameCode);
    if (game) {
      game.removePlayer(socket.id);

      io.to(playerInfo.gameCode).emit('player_left', {
        playerId: socket.id,
      });

      // 게임에 플레이어가 없으면 삭제
      if (Object.keys(game.players).length === 0) {
        games.delete(playerInfo.gameCode);
        console.log(`게임 삭제: ${playerInfo.gameCode}`);
      }
    }

    players.delete(socket.id);
    socket.leave(playerInfo.gameCode);
  });

  socket.on('disconnect', () => {
    const playerInfo = players.get(socket.id);
    if (playerInfo) {
      const game = games.get(playerInfo.gameCode);
      if (game) {
        game.removePlayer(socket.id);
        io.to(playerInfo.gameCode).emit('player_left', {
          playerId: socket.id,
        });

        if (Object.keys(game.players).length === 0) {
          games.delete(playerInfo.gameCode);
        }
      }
      players.delete(socket.id);
    }

    console.log(`플레이어 연결 해제: ${socket.id}`);
  });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, '::', { ipv6Only: false }, () => {
  console.log(`🍳 요리 게임 서버 실행: http://localhost:${PORT}`);
  console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
});
