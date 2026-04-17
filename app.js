// === НАСТРОЙКИ FIREBASE ===
const firebaseConfig = {
  apiKey: "AIzaSyAgJkDzwzxrjwtBpKqSnoWD_jpfd92w0JE",
  authDomain: "eternal-memory-88f34.firebaseapp.com",
  projectId: "eternal-memory-88f34",
  storageBucket: "eternal-memory-88f34.firebasestorage.app",
  messagingSenderId: "954861065351",
  appId: "1:954861065351:web:7447617950e5714d381422"
};

// Инициализация
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Глобальные переменные
let currentUser = null;
let userRole = 'guest';
let currentMemorialId = null;

console.log("✅ Firebase подключен!");

// === НАВИГАЦИЯ ===
function showSection(id) {
  document.querySelectorAll('main > section').forEach(function(sec) {
    sec.classList.add('hidden');
    sec.classList.remove('active');
  });
  var target = document.getElementById(id);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }
}

// === АВТОРИЗАЦИЯ ===
function showAuth(mode) {
  var isReg = (mode === 'register');
  document.getElementById('auth-title').textContent = isReg ? 'Регистрация' : 'Вход';
  document.getElementById('auth-submit').textContent = isReg ? 'Создать аккаунт' : 'Войти';
  document.getElementById('switch-auth').textContent = isReg ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться';
  showSection('auth');
}

function toggleAuthMode() {
  var cur = document.getElementById('auth-submit').textContent;
  showAuth(cur === 'Войти' ? 'register' : 'login');
}

document.getElementById('auth-form').addEventListener('submit', function(e) {
  e.preventDefault();
  var email = document.getElementById('email').value;
  var pass = document.getElementById('password').value;
  var isReg = document.getElementById('auth-submit').textContent === 'Создать аккаунт';
  
  var promise = isReg 
    ? auth.createUserWithEmailAndPassword(email, pass) 
    : auth.signInWithEmailAndPassword(email, pass);
  
  promise.then(function(cred) {
    if (isReg) {
      db.collection('users').doc(cred.user.uid).set({
        email: email,
        role: 'user',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    showSection('home');
  }).catch(function(err) {
    alert('Ошибка: ' + err.message);
  });
});

function logout() {
  auth.signOut();
  showSection('home');
}

// === UI ОБНОВЛЕНИЕ ===
auth.onAuthStateChanged(function(user) {
  currentUser = user;
  if (user) {
    db.collection('users').doc(user.uid).get().then(function(doc) {
      userRole = doc.exists ? doc.data().role : 'user';
      updateUI();
    });
  } else {
    userRole = 'guest';
    updateUI();
  }
});

function updateUI() {
  var btns = {
    'btn-login': !currentUser,
    'btn-register': !currentUser,
    'btn-logout': !!currentUser,
    'btn-admin': userRole === 'admin'
  };
  for (var id in btns) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', !btns[id]);
  }
  var authExtra = document.getElementById('auth-extra');
  if (authExtra) authExtra.classList.toggle('hidden', !currentUser);
  var adminExtra = document.getElementById('admin-extra');
  if (adminExtra) adminExtra.classList.toggle('hidden', userRole !== 'admin');
}

// === QR СКАНЕР (упрощённый) ===
function startScanner() {
  alert("📷 Камера запрашивается...\nРазреши доступ и наведи на QR-код");
  showSection('scanner');
  
  if (window.Html5Qrcode) {
    var scanner = new Html5Qrcode("qr-reader");
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, function(code) {
      scanner.stop();
      var id = code.includes('id=') ? code.split('id=')[1].split('&')[0] : code;
      loadMemorial(id.trim());
    }, function(err) { /* игнор */ });
  }
}

function stopScanner() {
  showSection('home');
}

// === ЗАГРУЗКА ПАМЯТНИКА ===
function loadMemorial(id) {
  currentMemorialId = id;
  showSection('memorial');
  
  db.collection('memorials').doc(id).get().then(function(doc) {
    if (!doc.exists) {
      document.getElementById('m-name').textContent = '❌ Не найдено';
      return;
    }
    var d = doc.data();
    document.getElementById('m-name').textContent = d.name || 'Без имени';
    document.getElementById('m-years').textContent = d.years || '';
    var rel = document.getElementById('m-relation');
    if (rel) rel.textContent = 'Кем приходится: ' + (d.relation || '—');
    var det = document.getElementById('m-details');
    if (det) det.textContent = d.details || 'Нет данных';
    
    // Заполняем поля для админа
    ['edit-name','edit-years','edit-relation','edit-details','edit-lat','edit-lng'].forEach(function(fid) {
      var el = document.getElementById(fid);
      if (el && d[fid.replace('edit-','')]) el.value = d[fid.replace('edit-','')];
    });
  }).catch(function(e) {
    alert('Ошибка: ' + e.message);
  });
}

// === ДЕЙСТВИЯ ===
function toggleDetails() {
  var el = document.getElementById('m-details');
  if (el) el.classList.toggle('hidden');
}

function openMap() {
  var lat = document.getElementById('edit-lat').value;
  var lng = document.getElementById('edit-lng').value;
  if (lat && lng) window.open('https://maps.google.com/?q=' + lat + ',' + lng, '_blank');
  else alert('📍 Координаты не указаны');
}

// === АДМИНКА ===
function saveMemorial() {
  if (!currentMemorialId || userRole !== 'admin') return alert('Нет прав');
  
  db.collection('memorials').doc(currentMemorialId).set({
    name: document.getElementById('edit-name').value,
    years: document.getElementById('edit-years').value,
    relation: document.getElementById('edit-relation').value,
    details: document.getElementById('edit-details').value,
    lat: document.getElementById('edit-lat').value,
    lng: document.getElementById('edit-lng').value
  }).then(function() {
    alert('✅ Сохранено!');
    loadMemorial(currentMemorialId);
  }).catch(function(e) { alert('Ошибка: ' + e.message); });
}

document.getElementById('add-memorial').addEventListener('submit', function(e) {
  e.preventDefault();
  if (userRole !== 'admin') return;
  var id = document.getElementById('new-id').value.trim();
  if (!id) return alert('Введите ID');
  
  db.collection('memorials').doc(id).set({
    name: document.getElementById('new-name').value,
    years: document.getElementById('new-years').value,
    relation: document.getElementById('new-relation').value,
    details: document.getElementById('new-details').value,
    lat: document.getElementById('new-lat').value,
    lng: document.getElementById('new-lng').value
  }).then(function() {
    alert('✅ Добавлено!');
    e.target.reset();
    showSection('admin');
  }).catch(function(e) { alert('Ошибка: ' + e.message); });
});

function generateQR() {
  if (!currentMemorialId) return alert('Выберите памятник');
  var out = document.getElementById('qr-output');
  out.innerHTML = '';
  var url = window.location.href.split('?')[0] + '?id=' + currentMemorialId;
  if (window.QRCode) new QRCode(out, { text: url, width: 180, height: 180 });
}

// === ЗАГРУЗКА ПО ССЫЛКЕ ===
window.addEventListener('load', function() {
  var params = new URLSearchParams(window.location.search);
  if (params.has('id')) loadMemorial(params.get('id'));
});
