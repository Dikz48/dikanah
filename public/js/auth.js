// Authentication System
let isAuthenticated = false;

document.addEventListener('DOMContentLoaded', function() {
  checkAuthentication();
});

function checkAuthentication() {
  // Check if user is already logged in
  const token = localStorage.getItem('authToken');
  if (token) {
    isAuthenticated = true;
    showDashboard();
  }
}

function switchPage(pageId) {
  // Hide all auth pages
  document.querySelectorAll('.auth-page').forEach(page => {
    page.classList.remove('active');
  });
  
  // Show selected page
  const selectedPage = document.getElementById(pageId);
  if (selectedPage) {
    selectedPage.classList.add('active');
  }
}

async function handleLogin(event) {
  event.preventDefault();
  
  const form = event.target;
  const email = form.querySelector('input[type="email"]').value;
  const password = form.querySelector('input[type="password"]').value;
  
  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Loading...';
  
  try {
    // In production, this would call a real API
    // For now, we'll simulate login
    if (email && password) {
      // Store simple token (in production, use JWT)
      const token = btoa(`${email}:${password}`);
      localStorage.setItem('authToken', token);
      localStorage.setItem('userEmail', email);
      
      isAuthenticated = true;
      showDashboard();
    }
  } catch (error) {
    showToast('Login gagal. Silakan coba lagi.', 'error');
    btn.disabled = false;
    btn.textContent = 'Login';
  }
}

async function handleRegister(event) {
  event.preventDefault();
  
  const form = event.target;
  const [nameInput, emailInput, passwordInput, confirmInput] = form.querySelectorAll('input');
  
  const name = nameInput.value;
  const email = emailInput.value;
  const password = passwordInput.value;
  const confirm = confirmInput.value;
  
  if (password !== confirm) {
    showToast('Password tidak cocok!', 'error');
    return;
  }
  
  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Loading...';
  
  try {
    // In production, this would call a real API
    if (email && password && name) {
      const token = btoa(`${email}:${password}`);
      localStorage.setItem('authToken', token);
      localStorage.setItem('userEmail', email);
      localStorage.setItem('userName', name);
      
      isAuthenticated = true;
      showToast('Akun berhasil dibuat!', 'success');
      showDashboard();
    }
  } catch (error) {
    showToast('Registrasi gagal. Silakan coba lagi.', 'error');
    btn.disabled = false;
    btn.textContent = 'Daftar';
  }
}

async function handleForgot(event) {
  event.preventDefault();
  
  const form = event.target;
  const email = form.querySelector('input[type="email"]').value;
  
  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Loading...';
  
  try {
    // In production, this would send a reset email
    showToast('Link reset telah dikirim ke email Anda!', 'success');
    setTimeout(() => {
      switchPage('loginPage');
      form.reset();
      btn.disabled = false;
      btn.textContent = 'Kirim Link Reset';
    }, 2000);
  } catch (error) {
    showToast('Gagal mengirim reset link. Silakan coba lagi.', 'error');
    btn.disabled = false;
    btn.textContent = 'Kirim Link Reset';
  }
}

function showDashboard() {
  const authContainer = document.getElementById('authContainer');
  const main = document.getElementById('main');
  
  if (authContainer) {
    authContainer.style.display = 'none';
  }
  if (main) {
    main.style.display = 'block';
  }
  
  initializeApp();
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userName');
  
  isAuthenticated = false;
  
  const authContainer = document.getElementById('authContainer');
  const main = document.getElementById('main');
  
  if (authContainer) {
    authContainer.style.display = 'flex';
  }
  if (main) {
    main.style.display = 'none';
  }
  
  switchPage('loginPage');
}

window.switchPage = switchPage;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleForgot = handleForgot;
window.logout = logout;
