const formulario = document.getElementById('recovery-form');
formulario?.addEventListener('submit', (evento) => {
  evento.preventDefault();
  window.alert('Para recuperar sua senha, entre em contato com o administrador do sistema.');
});
