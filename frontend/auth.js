const API_BASE = 'https://todolist-worker.atiohaidar.workers.dev'; // Ganti dengan URL Worker setelah deploy

function decodeJWT(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
}

let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');

// If token exists but no user, try to decode from token
if (token && !currentUser) {
  const payload = decodeJWT(token);
  if (payload && payload.username) {
    currentUser = { id: payload.userId, username: payload.username };
    localStorage.setItem('user', JSON.stringify(currentUser));
  } else {
    // Invalid token, clear
    localStorage.removeItem('token');
    token = null;
  }
}

function showAuthSection() {
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('register-section').style.display = 'none';
  document.getElementById('todo-section').style.display = 'none';
}

function showRegisterSection() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('register-section').style.display = 'block';
  document.getElementById('todo-section').style.display = 'none';
}

function showTodoSection() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('register-section').style.display = 'none';
  document.getElementById('todo-section').style.display = 'block';
  document.getElementById('user-greeting').textContent = currentUser.username;
}

function checkAuth() {
  if (token && currentUser) {
    // Verify token (optional, bisa skip untuk kesederhanaan)
    showTodoSection();
    loadTasks();
  } else {
    showAuthSection();
  }
}

document.getElementById('show-register').addEventListener('click', (e) => {
  e.preventDefault();
  showRegisterSection();
});

document.getElementById('show-login').addEventListener('click', (e) => {
  e.preventDefault();
  showAuthSection();
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(currentUser));
      showTodoSection();
      loadTasks();
    } else {
      alert(data.error);
    }
  } catch (err) {
    alert('Login failed');
  }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('register-username').value;
  const password = document.getElementById('register-password').value;
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(currentUser));
      showTodoSection();
      loadTasks();
    } else {
      alert(data.error);
    }
  } catch (err) {
    alert('Register failed');
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showAuthSection();
});

window.onload = checkAuth;

// Anonymous polling-based collaborative list functionality
document.getElementById('anonymous-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const listName = document.getElementById('anonymous-list-name').value.trim() || 'Untitled List';

  try {
    const response = await fetch(`${API_BASE}/api/anonymous/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list_name: listName })
    });

    if (!response.ok) {
      throw new Error('Failed to create anonymous list');
    }

    const data = await response.json();

    // Show result
    document.getElementById('share-url').value = data.share_url;
    document.getElementById('open-list').href = data.share_url;
    document.getElementById('anonymous-result').style.display = 'block';

    // Clear form
    document.getElementById('anonymous-list-name').value = '';

  } catch (error) {
    alert('Failed to create anonymous list: ' + error.message);
  }
});

function copyShareUrl() {
  const shareUrl = document.getElementById('share-url');
  shareUrl.select();
  shareUrl.setSelectionRange(0, 99999); // For mobile devices
  document.execCommand('copy');
  alert('Link copied to clipboard!');
}