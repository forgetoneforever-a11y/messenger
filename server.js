const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Раздаем статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Хранилище подключенных пользователей: @username -> socket.id
const registeredUsers = {};

io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);

    // Регистрация/установка юзернейма при входе
    socket.on('set_user_data', (data) => {
        socket.username = data.username;
        registeredUsers[data.username] = socket.id;
        console.log(`Пользователь авторизован: ${data.username}`);
    });

    // Поиск пользователей по @username
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

    // Обработка сообщения в общем чате
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

    // Обработка личных сообщений (ЛС)
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

        // Отправляем получателю, если он в сети
        if (targetSocketId) {
            io.to(targetSocketId).emit('private_message', payload);
        }
    });

    // Обработка сигнала о прочтении сообщений (синие галочки)
    socket.on('mark_read', (data) => {
        if (!socket.username) return;
        const targetSocketId = registeredUsers[data.sender];
        if (targetSocketId) {
            io.to(targetSocketId).emit('messages_read', { by: socket.username });
        }
    });

    // Отключение пользователя
    socket.on('disconnect', () => {
        if (socket.username) {
            delete registeredUsers[socket.username];
            console.log(`Пользователь отключился: ${socket.username}`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
