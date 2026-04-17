const firebaseConfig = {
  apiKey: "AIzaSyAgJkDzwzxrjwtBpKqSnoWD_jpfd92w0JE",
  authDomain: "eternal-memory-88f34.firebaseapp.com",
  projectId: "eternal-memory-88f34",
  storageBucket: "eternal-memory-88f34.firebasestorage.app",
  messagingSenderId: "954861065351",
  appId: "1:954861065351:web:7447617950e5714d381422"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let userRole = 'guest';
let currentMemorialId = null;

console.log("Firebase initialized!");

function showSection(id) {
  console.log("Showing section:", id);
  document.querySelectorAll('main > section').forEach(function(s) {
    s.classList.remove('active');
    s.classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
  document.getElementById(id).classList.add('active');
}

function showAuth(mode) {
  console.log("Show auth");
  showSection('auth');
}

function startScanner() {
  console.log("Start scanner");
  alert("Сканер QR запущен!");
}

auth.onAuthStateChanged(function(user) {
  console.log("Auth state changed:", user);
  currentUser = user;
  updateUI();
});

function updateUI() {
  var loginBtn = document.getElementById('btn-login');
  var registerBtn = document.getElementById('btn-register');
  var logoutBtn = document.getElementById('btn-logout');
  var adminBtn = document.getElementById('btn-admin');
  
  if (loginBtn) loginBtn.classList.toggle('hidden', !!currentUser);
  if (registerBtn) registerBtn.classList.toggle('hidden', !!currentUser);
  if (logoutBtn) logoutBtn.classList.toggle('hidden', !currentUser);
  if (adminBtn) adminBtn.classList.toggle('hidden', userRole !== 'admin');
}

function logout() {
  auth.signOut();
  showSection('home');
}
