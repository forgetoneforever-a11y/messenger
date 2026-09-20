const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const path = require('path');

// Раздаем статические файлы из корневой папки
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Список активных пользователей: socket.id -> { id, username }
const users = {};

io.on('connection', (socket) => {
    console.log(`Пользователь подключился: ${socket.id}`);

    // Установка имени пользователя при входе
    socket.on('set_username', (username) => {
        const cleanName = username ? username.trim() : 'User';
        users[socket.id] = { id: socket.id, username: cleanName };
        // Рассылаем обновленный список онлайн-пользователей всем
        io.emit('update_users', Object.values(users));
    });

    // Обработка общего сообщения
    socket.on('chat_message', (data) => {
        const senderName = users[socket.id]?.username || 'User';
        io.emit('chat_message', {
            sender: senderName,
            message: data.message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    // Обработка личного (приватного) сообщения
    socket.on('private_message', ({ to, message }) => {
        const senderName = users[socket.id]?.username || 'User';
        const messageData = {
            senderId: socket.id,
            senderName: senderName,
            message: message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Отправляем получателю
        io.to(to).emit('private_message', messageData);
        // Отправляем обратно отправителю для отображения в его окне ЛС
        socket.emit('private_message_sent', { to, ...messageData });
    });

    // Отключение пользователя
    socket.on('disconnect', () => {
        delete users[socket.id];
        io.emit('update_users', Object.values(users));
        console.log(`Пользователь отключился: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
