const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let users = {}; 
let messagesHistory = {}; 

io.on('connection', (socket) => {
  socket.on('login', (data) => {
    const { phone, password } = data;
    if (users[phone]) {
      if (users[phone].password === password) {
        socket.emit('login success', { 
          username: users[phone].username, 
          phone: phone, 
          usernameTag: users[phone].usernameTag,
          nftCollection: users[phone].nftCollection || [] 
        });
      } else {
        socket.emit('login error', 'Неверный пароль!');
      }
    } else {
      let defaultName = "User_" + phone.slice(-4);
      users[phone] = { 
        username: defaultName, 
        password: password, 
        usernameTag: defaultName.toLowerCase(), 
        nftCollection: [] 
      };
      socket.emit('login success', { 
        username: defaultName, 
        phone: phone, 
        usernameTag: users[phone].usernameTag, 
        nftCollection: [] 
      });
    }
  });

  socket.on('change user data', (data) => {
    const { phone, newName, newTag } = data;
    if (users[phone]) {
      if (newName) users[phone].username = newName;
      if (newTag) users[phone].usernameTag = newTag;
      socket.emit('change user data success', { username: users[phone].username, tag: users[phone].usernameTag });
    }
  });

  // --- НОВОЕ: Поиск пользователя по юзернейму ---
  socket.on('search user', (tag) => {
    // Ищем пользователя, у которого совпадает тег (без учета регистра)
    const foundPhone = Object.keys(users).find(p => users[p].usernameTag.toLowerCase() === tag.toLowerCase());
    if (foundPhone) {
      socket.emit('search user result', { 
        found: true, 
        username: users[foundPhone].username, 
        tag: users[foundPhone].usernameTag 
      });
    } else {
      socket.emit('search user result', { found: false });
    }
  });

  // --- НОВОЕ: Создание личной комнаты (ЛС) ---
  socket.on('create private chat', (data) => {
    // Создаем уникальный ID комнаты на основе двух юзернеймов (отсортированных)
    const tags = [data.myTag, data.targetTag].sort();
    const roomId = 'private_' + tags[0] + '_' + tags[1];
    socket.emit('private chat created', { roomId: roomId, targetName: data.targetName });
  });

  socket.on('send gift', (data) => {
    const fromPhone = Object.keys(users).find(p => users[p].username === data.from);
    if (fromPhone) {
      if (!users[fromPhone].nftCollection) users[fromPhone].nftCollection = [];
      users[fromPhone].nftCollection.push({ icon: data.giftIcon, name: data.giftName });
    }
    io.to(data.room).emit('gift message', data);
    if (fromPhone) socket.emit('update nft collection', users[fromPhone].nftCollection);
  });

  socket.on('join room', (room) => { 
    socket.join(room); 
    if (messagesHistory[room]) {
      socket.emit('chat history', messagesHistory[room]);
    }
  });

  socket.on('chat message', (data) => { 
    if (!messagesHistory[data.room]) messagesHistory[data.room] = [];
    messagesHistory[data.room].push({ user: data.user, text: data.text });
    io.to(data.room).emit('chat message', data); 
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log('СЕРВЕР РАБОТАЕТ! Порт: ' + PORT); });