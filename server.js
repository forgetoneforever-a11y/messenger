const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const path = require('path');

// Раздаем статические файлы из текущей папки
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Список активных пользователей: id -> { username }
const users = {};

io.on('connection', (socket) => {
    console.log(`Пользователь подключился: ${socket.id}`);

    // Пользователь установил/передал свое имя при входе
    socket.on('set_username', (username) => {
        users[socket.id] = { id: socket.id, username: username || 'User' };
        // Рассылаем обновленный список онлайн-пользователей всем
        io.emit('update_users', Object.values(users));
    });

    // Обработка общего сообщения
    socket.on('chat_message', (data) => {
        io.emit('chat_message', {
            sender: users[socket.id]?.username || 'User',
            message: data.message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    // НОВОЕ: Обработка личного (приватного) сообщения
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
        // Отправляем обратно отправителю (чтобы у него тоже отобразилось в окне ЛС)
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
