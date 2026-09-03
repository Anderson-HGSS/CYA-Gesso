const SESSION_KEY = 'cyaGessoUsuarioLogado';
if (!sessionStorage.getItem(SESSION_KEY)) window.location.replace('index.html');
document.querySelectorAll('[data-action="logout"]').forEach((link) => {
  link.addEventListener('click', (evento) => {
    evento.preventDefault();
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace('index.html');
  });
});
