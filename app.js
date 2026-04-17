// 🔑 Твой Firebase конфиг
const firebaseConfig = {
  apiKey: "AIzaSyAgJkDzwzxrjwtBpKqSnoWD_jpfd92w0JE",
  authDomain: "eternal-memory-88f34.firebaseapp.com",
  projectId: "eternal-memory-88f34",
  storageBucket: "eternal-memory-88f34.firebasestorage.app",
  messagingSenderId: "954861065351",
  appId: "1:954861065351:web:7447617950e5714d381422"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Глобальные переменные
let currentUser = null;
let userRole = 'guest';
let currentMemorialId = null;
let html5QrcodeScanner = null;

// 🔐 Отслеживание состояния авторизации
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
        // Проверяем роль пользователя в базе
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            userRole = userDoc.exists ? userDoc.data().role : 'user';
        } catch (e) {
            userRole = 'user';
        }
    } else {
        userRole = 'guest';
    }
    updateUI();
});

// 🧭 Переключение между секциями
function showSection(id) {
    document.querySelectorAll('main > section').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
    document.getElementById(id).classList.add('active');
}

// 🎨 Обновление интерфейса в зависимости от роли
function updateUI() {
    // Кнопки в шапке
    document.getElementById('btn-login').classList.toggle('hidden', !!currentUser);
    document.getElementById('btn-register').classList.toggle('hidden', !!currentUser);
    document.getElementById('btn-logout').classList.toggle('hidden', !currentUser);
    document.getElementById('btn-admin').classList.toggle('hidden', userRole !== 'admin');
    
    // Доп. информация на странице памятника
    const authExtra = document.getElementById('auth-extra');
    if (authExtra) {
        authExtra.classList.toggle('hidden', !currentUser);
    }
    
    // Админ-панель на странице памятника
    const adminExtra = document.getElementById('admin-extra');
    if (adminExtra) {
        adminExtra.classList.toggle('hidden', userRole !== 'admin');
    }
}

// 🔐 Авторизация / Регистрация
let isRegister = false;
function showAuth(mode) {
    isRegister = mode === 'register';
    document.getElementById('auth-title').textContent = isRegister ? 'Регистрация' : 'Вход';
    document.getElementById('auth-submit').textContent = isRegister ? 'Создать аккаунт' : 'Войти';
    document.getElementById('switch-auth').textContent = isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться';
    showSection('auth');
}
function toggleAuthMode() { showAuth(isRegister ? 'login' : 'register'); }

document.getElementById('auth-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    
    const promise = isRegister 
        ? auth.createUserWithEmailAndPassword(email, pass) 
        : auth.signInWithEmailAndPassword(email, pass);
    
    promise.then((userCredential) => {
        if (isRegister) {
            // Создаём запись пользователя в базе
            db.collection('users').doc(userCredential.user.uid).set({
                email: email,
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        showSection('home');
    }).catch((error) => {
        alert('Ошибка: ' + error.message);
    });
});

function logout() {
    auth.signOut();
    showSection('home');
}

// 📷 QR Сканер
function startScanner() {
    showSection('scanner');
    
    // Очищаем предыдущий сканер если есть
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(() => {});
    }
    
    html5QrcodeScanner = new Html5Qrcode("qr-reader");
    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 250 } }, 
        onScanSuccess, 
        (errorMessage) => { /* игнорируем ошибки сканирования */ }
    ).catch(err => {
        alert('Не удалось запустить камеру: ' + err);
        showSection('home');
    });
}

function stopScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner.clear();
            showSection('home');
        }).catch(() => showSection('home'));
    } else {
        showSection('home');
    }
}

function onScanSuccess(decodedText) {
    stopScanner();
    // Извлекаем ID из QR: может быть просто "ivanov" или полная ссылка "?id=ivanov"
    let id = decodedText;
    if (decodedText.includes('id=')) {
        id = decodedText.split('id=')[1].split('&')[0];
    }
    loadMemorial(id.trim());
}

// 📥 Загрузка данных памятника из Firestore
async function loadMemorial(id) {
    currentMemorialId = id;
    showSection('memorial');
    
    try {
        const doc = await db.collection('memorials').doc(id).get();
        if (!doc.exists) { 
            document.getElementById('m-name').textContent = '❌ Запись не найдена'; 
            document.getElementById('m-years').textContent = '';
            return; 
        }
        const data = doc.data();
        
        // Заполняем поля
        document.getElementById('m-name').textContent = data.name || 'Без имени';
        document.getElementById('m-years').textContent = data.years || '';
        
        if (document.getElementById('m-relation')) {
            document.getElementById('m-relation').textContent = `Кем приходится: ${data.relation || '—'}`;
        }
        if (document.getElementById('m-details')) {
            document.getElementById('m-details').textContent = data.details || 'Нет подробной информации.';
        }
        
        // Заполняем поля редактирования (для админа)
        if (document.getElementById('edit-name')) document.getElementById('edit-name').value = data.name || '';
        if (document.getElementById('edit-years')) document.getElementById('edit-years').value = data.years || '';
        if (document.getElementById('edit-relation')) document.getElementById('edit-relation').value = data.relation || '';
        if (document.getElementById('edit-details')) document.getElementById('edit-details').value = data.details || '';
        if (document.getElementById('edit-lat')) document.getElementById('edit-lat').value = data.lat || '';
        if (document.getElementById('edit-lng')) document.getElementById('edit-lng').value = data.lng || '';
        
    } catch (e) { 
        alert('Ошибка загрузки: ' + e.message); 
    }
}

// 🎯 Действия на странице памятника
function toggleDetails() { 
    const el = document.getElementById('m-details');
    if (el) el.classList.toggle('hidden'); 
}

function openMap() {
    const lat = document.getElementById('edit-lat')?.value;
    const lng = document.getElementById('edit-lng')?.value;
    if (lat && lng) {
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    } else { 
        alert('📍 Геолокация не указана в данных памятника.'); 
    }
}

// 👨‍💼 Админка: Сохранение изменений
async function saveMemorial() {
    if (!currentMemorialId || userRole !== 'admin') {
        return alert('❌ Нет прав или