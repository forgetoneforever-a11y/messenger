const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Хранилище: юзернейм -> socketId
const registeredUsers = {};

io.on('connection', (socket) => {
    console.log('Подключился:', socket.id);

    socket.on('set_user_data', (data) => {
        socket.username = data.username;
        registeredUsers[data.username] = socket.id;
    });

    // Поиск по @username
    socket.on('search_users', (query, callback) => {
        const results = [];
        const cleanQuery = query.toLowerCase();
        for (const uname of Object.keys(registeredUsers)) {
            if (uname.toLowerCase().includes(cleanQuery) && uname !== socket.username) {
                results.push(uname);
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
        const targetSocketId = registeredUsers[data.recipient];
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const payload = {
            sender: socket.username,
            recipient: data.recipient,
            message: data.message,
            time: time,
            read: false,
            image: data.image || null
        };

        if (targetSocketId) {
            io.to(targetSocketId).emit('private_message', payload);
        }
    });

    // Обработка сигнала прочтения (двойные синие галочки)
    socket.on('mark_read', (data) => {
        if (!socket.username) return;
        const targetSocketId = registeredUsers[data.sender];
        if (targetSocketId) {
            io.to(targetSocketId).emit('messages_read', { by: socket.username });
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
