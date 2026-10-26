// Aplica el tema guardado antes del primer pintado para evitar el parpadeo claro→oscuro.
// Es un script externo (no inline) para respetar la política CSP.
try {
  var theme = JSON.parse(localStorage.getItem('pv:theme'))
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
} catch (error) {
  /* sin almacenamiento o valor ilegible: se usa el tema del sistema */
}
