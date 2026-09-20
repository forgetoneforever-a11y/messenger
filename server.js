const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// Хранилище подключенных пользователей: имя -> socket.id
const activeUsers = {};

function updateOnlineUsers() {
    const usersList = Object.keys(activeUsers).map(username => ({
        username: username,
        status: 'В сети'
    }));
    io.emit('update_users', usersList);
}

io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);

    // Установка никнейма при входе
    socket.on('set_username', (data) => {
        socket.username = data.username;
        activeUsers[data.username] = socket.id;
        updateOnlineUsers();
    });

    // Обработка публичного сообщения в общем чате
    socket.on('chat_message', (data) => {
        if (!socket.username) return;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Рассылаем сообщение ВСЕМ клиентам (включая отправителя)
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
        const targetSocketId = activeUsers[data.recipient];
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const payload = {
            sender: socket.username,
            recipient: data.recipient,
            message: data.message,
            time: time,
            isPrivate: true,
            image: data.image || null
        };

        // Отправляем получателю, если он онлайн
        if (targetSocketId) {
            io.to(targetSocketId).emit('private_message', payload);
        }
    });

    // Отключение пользователя
    socket.on('disconnect', () => {
        if (socket.username) {
            delete activeUsers[socket.username];
            updateOnlineUsers();
        }
        console.log('Пользователь отключился:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
