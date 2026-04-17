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
let qrScanner = null;

console.log("✅ Firebase подключен!");

// Делаем функции глобальными
window.showSection = function(id) {
  console.log("Переход в раздел:", id);
  document.querySelectorAll('main > section').forEach(function(sec) {
    sec.classList.add('hidden');
    sec.classList.remove('active');
  });
  var target = document.getElementById(id);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }
};

window.showAuth = function(mode) {
  console.log("Показать авторизацию, режим:", mode);
  var isReg = (mode === 'register');
  document.getElementById('auth-title').textContent = isReg ? 'Регистрация' : 'Вход';
  document.getElementById('auth-submit').textContent = isReg ? 'Создать аккаунт' : 'Войти';
  document.getElementById('switch-auth').textContent = isReg ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться';
  window.showSection('auth');
};

window.toggleAuthMode = function() {
  var cur = document.getElementById('auth-submit').textContent;
  window.showAuth(cur === 'Войти' ? 'register' : 'login');
};

window.logout = function() {
  auth.signOut();
  window.showSection('home');
};

window.startScanner = function() {
  console.log("Запуск сканера QR...");
  window.showSection('scanner');
  
  if (window.Html5Qrcode) {
    // Очищаем предыдущий сканер
    if (qrScanner) {
      qrScanner.stop().catch(function(){});
    }
    
    qrScanner = new Html5Qrcode("qr-reader");
    qrScanner.start(
      { facingMode: "environment" }, 
      { fps: 10, qrbox: { width: 250, height: 250 } }, 
      function(code) {
        // Успешное сканирование
        qrScanner.stop();
        var id = code.includes('id=') ? code.split('id=')[1].split('&')[0] : code;
        console.log("Отсканирован ID:", id);
        window.loadMemorial(id.trim());
      },
      function(err) {
        // Ошибки сканирования игнорируем
      }
    ).catch(function(err) {
      console.error("Ошибка запуска камеры:", err);
      alert("Не удалось запустить камеру. Проверьте разрешения.");
      window.showSection('home');
    });
  } else {
    alert("Библиотека сканера не загружена");
  }
};

window.stopScanner = function() {
  if (qrScanner) {
    qrScanner.stop().catch(function(){});
  }
  window.showSection('home');
};

window.loadMemorial = function(id) {
  currentMemorialId = id;
  window.showSection('memorial');
  
  db.collection('memorials').doc(id).get().then(function(doc) {
    if (!doc.exists) {
      document.getElementById('m-name').textContent = '❌ Запись не найдена';
      document.getElementById('m-years').textContent = '';
      return;
    }
    var d = doc.data();
    document.getElementById('m-name').textContent = d.name || 'Без имени';
    document.getElementById('m-years').textContent = d.years || '';
    
    var rel = document.getElementById('m-relation');
    if (rel) rel.textContent = 'Кем приходится: ' + (d.relation || '—');
    
    var det = document.getElementById('m-details');
    if (det) det.textContent = d.details || 'Нет подробной информации';
    
    // Заполняем поля для админа
    var fields = ['name','years','relation','details','lat','lng'];
    fields.forEach(function(f) {
      var el = document.getElementById('edit-' + f);
      if (el && d[f]) el.value = d[f];
    });
  }).catch(function(e) {
    console.error("Ошибка загрузки:", e);
    alert('Ошибка: ' + e.message);
  });
};

window.toggleDetails = function() {
  var el = document.getElementById('m-details');
  if (el) el.classList.toggle('hidden');
};

window.openMap = function() {
  var lat = document.getElementById('edit-lat').value;
  var lng = document.getElementById('edit-lng').value;
  if (lat && lng) {
    window.open('https://maps.google.com/?q=' + lat + ',' + lng, '_blank');
  } else {
    alert('📍 Координаты не указаны');
  }
};

window.saveMemorial = function() {
  if (!currentMemorialId || userRole !== 'admin') {
    return alert('Нет прав или памятник не выбран');
  }
  
  db.collection('memorials').doc(currentMemorialId).set({
    name: document.getElementById('edit-name').value,
    years: document.getElementById('edit-years').value,
    relation: document.getElementById('edit-relation').value,
    details: document.getElementById('edit-details').value,
    lat: document.getElementById('edit-lat').value,
    lng: document.getElementById('edit-lng').value
  }).then(function() {
    alert('✅ Сохранено!');
    window.loadMemorial(currentMemorialId);
  }).catch(function(e) {
    alert('Ошибка: ' + e.message);
  });
};

window.generateQR = function() {
  if (!currentMemorialId) return alert('Выберите памятник');
  var out = document.getElementById('qr-output');
  out.innerHTML = '';
  var url = window.location.href.split('?')[0] + '?id=' + currentMemorialId;
  if (window.QRCode) {
    new QRCode(out, { text: url, width: 180, height: 180 });
  }
};

// Обработка формы авторизации
document.addEventListener('DOMContentLoaded', function() {
  var form = document.getElementById('auth-form');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var email = document.getElementById('email').value;
      var pass = document.getElementById('password').value;
      var isReg = document.getElementById('auth-submit').textContent === 'Создать аккаунт';
      
      console.log("Авторизация:", email, "режим:", isReg ? 'регистрация' : 'вход');
      
      var promise = isReg 
        ? auth.createUserWithEmailAndPassword(email, pass) 
        : auth.signInWithEmailAndPassword(email, pass);
      
      promise.then(function(cred) {
        console.log("Успешная авторизация:", cred.user.uid);
        if (isReg) {
          db.collection('users').doc(cred.user.uid).set({
            email: email,
            role: 'user',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        window.showSection('home');
      }).catch(function(err) {
        console.error("Ошибка авторизации:", err);
        alert('Ошибка: ' + err.message);
      });
    });
  }
  
  // Обработка формы добавления памятника
  var addForm = document.getElementById('add-memorial');
  if (addForm) {
    addForm.addEventListener('submit', function(e) {
      e.preventDefault();
      if (userRole !== 'admin') return;
      
      var id = document.getElementById('new-id').value.trim();
      if (!id) return alert('Введите ID памятника');
      
      db.collection('memorials').doc(id).set({
        name: document.getElementById('new-name').value,
        years: document.getElementById('new-years').value,
        relation: document.getElementById('new-relation').value,
        details: document.getElementById('new-details').value,
        lat: document.getElementById('new-lat').value,
        lng: document.getElementById('new-lng').value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function() {
        alert('✅ Памятник добавлен!');
        e.target.reset();
        window.showSection('admin');
      }).catch(function(err) {
        alert('Ошибка: ' + err.message);
      });
    });
  }
  
  // Проверка авторизации
  auth.onAuthStateChanged(function(user) {
    currentUser = user;
    console.log("Auth state changed:", user ? user.email : 'null');
    
    if (user) {
      db.collection('users').doc(user.uid).get().then(function(doc) {
        userRole = doc.exists ? doc.data().role : 'user';
        console.log("Роль пользователя:", userRole);
        updateUI();
      });
    } else {
      userRole = 'guest';
      updateUI();
    }
  });
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
    if (el) {
      if (btns[id]) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  }
  
  var authExtra = document.getElementById('auth-extra');
  if (authExtra) {
    if (currentUser) {
      authExtra.classList.remove('hidden');
    } else {
      authExtra.classList.add('hidden');
    }
  }
  
  var adminExtra = document.getElementById('admin-extra');
  if (adminExtra) {
    if (userRole === 'admin') {
      adminExtra.classList.remove('hidden');
    } else {
      adminExtra.classList.add('hidden');
    }
  }
}

// Загрузка по ссылке
window.addEventListener('load', function() {
  var params = new URLSearchParams(window.location.search);
  if (params.has('id')) {
    window.loadMemorial(params.get('id'));
  }
});
