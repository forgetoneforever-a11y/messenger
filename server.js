const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 10e6 // Увеличиваем лимит до 10 МБ для аудио и картинок
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const USERS_FILE = path.join(__dirname, 'users.json');

function getUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.post('/api/register', (req, res) => {
    const { username, password, avatarColor, status } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Заполни все поля!' });
    }

    const users = getUsers();
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, message: 'Такой ник уже занят!' });
    }

    const newUser = {
        username,
        password,
        avatarColor: avatarColor || 'linear-gradient(135deg, #a855f7, #6366f1)',
        status: status || 'В сети',
        regDate: new Date().toLocaleString(),
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    };

    users.push(newUser);
    saveUsers(users);

    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(400).json({ success: false, message: 'Неверный ник или пароль!' });
    }

    res.json({ 
        success: true, 
        username: user.username,
        avatarColor: user.avatarColor,
        status: user.status 
    });
});

app.get('/api/admin/users', (req, res) => {
    const users = getUsers();
    res.json(users);
});

let onlineUsers = new Map();

function broadcastOnlineUsers() {
    const usersList = Array.from(onlineUsers.values());
    io.emit('online_users', usersList);
}

io.on('connection', (socket) => {
    console.log(`Пользователь подключился: ${socket.id}`);

    socket.on('join_chat', (userData) => {
        socket.username = userData.username;
        socket.avatarColor = userData.avatarColor;
        
        onlineUsers.set(socket.id, {
            username: userData.username,
            avatarColor: userData.avatarColor,
            status: userData.status || 'В сети'
        });

        broadcastOnlineUsers();

        socket.broadcast.emit('message', {
            user: 'Система',
            text: `${userData.username} вошел в чат.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            system: true
        });
    });

    socket.on('chat_message', (data) => {
        const messageId = 'msg_' + Math.random().toString(36).substr(2, 9);
        io.emit('message', {
            id: messageId,
            user: data.user,
            avatarColor: data.avatarColor,
            text: data.text,
            image: data.image || null,
            audio: data.audio || null,
            replyTo: data.replyTo || null,
            reactions: {},
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            system: false
        });
    });

    socket.on('add_reaction', (data) => {
        io.emit('update_reaction', data);
    });

    socket.on('typing', (username) => {
        socket.broadcast.emit('user_typing', username);
    });

    socket.on('stop_typing', () => {
        socket.broadcast.emit('user_stop_typing');
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            onlineUsers.delete(socket.id);
            broadcastOnlineUsers();

            socket.broadcast.emit('message', {
                user: 'Система',
                text: `${socket.username} покинул чат.`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                system: true
            });
        }
        console.log(`Пользователь отключился: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});