function includeHTML() {
  document.querySelectorAll('[data-include-html]').forEach(el => {
    const file = el.getAttribute('data-include-html');
    if (!file) return;
    fetch(file)
      .then(resp => resp.text())
      .then(html => {
        el.outerHTML = html;
      })
      .catch(err => {
        console.error('Erro ao incluir', file, err);
      });
  });
}
window.addEventListener('DOMContentLoaded', includeHTML);
