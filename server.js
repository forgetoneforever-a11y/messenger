const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Файл для постоянного хранения сообщений на сервере
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// Загружаем историю сообщений при старте сервера
let messagesDB = [];
if (fs.existsSync(MESSAGES_FILE)) {
    try {
        messagesDB = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
    } catch (e) {
        messagesDB = [];
    }
} else {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2));
}

function saveMessagesToFile() {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messagesDB, null, 2));
}

const registeredUsers = {};

io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);

    socket.on('set_user_data', (data) => {
        socket.username = data.username;
        registeredUsers[data.username] = socket.id;
        console.log(`Авторизован: ${data.username}`);

        // Отправляем пользователю всю его историю сообщений (и общие, и ЛС) при входе
        const userHistory = messagesDB.filter(m => 
            m.recipient === null || m.sender === socket.username || m.recipient === socket.username
        );
        socket.emit('init_history', userHistory);
    });

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
        
        const msg = {
            sender: socket.username,
            recipient: null, // Общий чат
            message: data.message,
            time: time,
            read: true,
            image: data.image || null
        };

        messagesDB.push(msg);
        saveMessagesToFile();

        io.emit('chat_message', msg);
    });

    socket.on('private_message', (data) => {
        if (!socket.username) return;
        const targetSocketId = registeredUsers[data.recipient];
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const payload = {
            sender: socket.username,
            recipient: data.recipient, // Личное сообщение конкретному пользователю
            message: data.message,
            time: time,
            read: false,
            image: data.image || null
        };

        // Сохраняем ЛС в постоянную базу сервера
        messagesDB.push(payload);
        saveMessagesToFile();

        // Отправляем получателю, если он онлайн
        if (targetSocketId) {
            io.to(targetSocketId).emit('private_message', payload);
        }
    });

    socket.on('mark_read', (data) => {
        if (!socket.username) return;
        
        // Отмечаем прочитанными в базе данных сервера
        messagesDB.forEach(m => {
            if (m.sender === data.sender && m.recipient === socket.username) {
                m.read = true;
            }
        });
        saveMessagesToFile();

        const targetSocketId = registeredUsers[data.sender];
        if (targetSocketId) {
            io.to(targetSocketId).emit('messages_read', { by: socket.username });
        }
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            delete registeredUsers[socket.username];
            console.log(`Отключился: ${socket.username}`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
