const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Хранилище пользователей: имя -> { socketId, avatar }
const registeredUsers = {};

io.on('connection', (socket) => {
    console.log('Подключился:', socket.id);

    socket.on('set_user_data', (data) => {
        socket.username = data.username;
        registeredUsers[data.username] = {
            socketId: socket.id,
            avatar: data.avatar || ''
        };
    });

    socket.on('update_profile', (data) => {
        if (socket.username && registeredUsers[socket.username]) {
            delete registeredUsers[socket.username];
        }
        socket.username = data.username;
        registeredUsers[data.username] = {
            socketId: socket.id,
            avatar: data.avatar || ''
        };
    });

    // Поиск пользователей по подстроке никнейма
    socket.on('search_users', (query, callback) => {
        const results = [];
        for (const [uname, info] of Object.entries(registeredUsers)) {
            if (uname.toLowerCase().includes(query.toLowerCase()) && uname !== socket.username) {
                results.push({ username: uname, avatar: info.avatar });
            }
        }
        callback(results);
    });

    socket.on('chat_message', (data) => {
        if (!socket.username) return;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        io.emit('chat_message', {
            sender: socket.username,
            message: data.message,
            time: time,
            image: data.image || null
        });
    });

    socket.on('private_message', (data) => {
        if (!socket.username) return;
        const targetUser = registeredUsers[data.recipient];
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const payload = {
            sender: socket.username,
            recipient: data.recipient,
            message: data.message,
            time: time,
            image: data.image || null
        };

        if (targetUser && targetUser.socketId) {
            io.to(targetUser.socketId).emit('private_message', payload);
        }
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            delete registeredUsers[socket.username];
        }
        console.log('Отключился:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
