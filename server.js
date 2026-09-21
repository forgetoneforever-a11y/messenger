const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Создаем папку для загрузок и файл данных, если их нет
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
const USERS_FILE = 'users.json';
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));

const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Получение списка пользователей / проверка
app.get('/api/users', (req, res) => {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    res.json(users);
});

// Регистрация / Авторизация по юзернейму
app.post('/api/auth', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Юзернейм обязателен' });

    let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    let user = users.find(u => u.username === username);

    if (!user) {
        user = {
            id: 'user_' + Date.now(),
            username: username,
            displayName: username,
            avatar: ''
        };
        users.push(user);
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    }

    res.json(user);
});

// Сохранение профиля (ник, аватарка)
app.post('/api/profile', upload.single('avatar'), (req, res) => {
    const { userId, username, displayName } = req.body;
    let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    let userIndex = users.findIndex(u => u.id === userId);

    if (userIndex === -1) {
        return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    users[userIndex].username = username || users[userIndex].username;
    users[userIndex].displayName = displayName || users[userIndex].displayName;
    
    if (req.file) {
        users[userIndex].avatar = `/uploads/${req.file.filename}`;
    }

    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true, user: users[userIndex] });
});

io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);

    socket.on('chat message', (data) => {
        io.emit('chat message', data);
    });

    socket.on('disconnect', () => {
        console.log('Пользователь отключился:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
