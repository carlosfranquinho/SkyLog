function setupMenu() {
  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('menu-tempo');
  if (!toggle || !menu) {
    // header may not be loaded yet, try again shortly
    return setTimeout(setupMenu, 100);
  }
  toggle.addEventListener('click', () => {
    menu.classList.toggle('open');
  });
}

document.addEventListener('DOMContentLoaded', setupMenu);
