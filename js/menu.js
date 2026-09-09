const SESSION_KEY = 'cyaGessoUsuarioLogado';
const LOGIN_PATH = document.documentElement.dataset.loginPath || 'index.html';
if (!sessionStorage.getItem(SESSION_KEY)) window.location.replace(LOGIN_PATH);
document.querySelectorAll('[data-action="logout"]').forEach((link) => {
  link.addEventListener('click', (evento) => {
    evento.preventDefault();
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace(LOGIN_PATH);
  });
});
