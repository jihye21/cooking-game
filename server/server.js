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
  },
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
        inventory: [],
      },
    };
    this.items = this.generateItems();
    this.orders = this.generateOrders();
    this.startTime = Date.now();
    this.duration = 180; // 3분
    this.gameStarted = true;
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
    const orderTypes = [
      { name: '스프', type: 'soup' },
      { name: '샐러드', type: 'salad' },
      { name: '버거', type: 'burger' },
    ];

    const orders = [];
    for (let i = 0; i < 5; i++) {
      orders.push({
        id: `order_${Date.now()}_${i}`,
        ...orderTypes[Math.floor(Math.random() * orderTypes.length)],
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
      inventory: [],
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
      player.inventory.push(data.itemId);

      // 음식 완성 시 점수 추가
      if (item.type === 'cooked') {
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
server.listen(PORT, () => {
  console.log(`🍳 요리 게임 서버 실행: http://localhost:${PORT}`);
  console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
});
