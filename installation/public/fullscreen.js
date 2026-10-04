export function setupFullscreen(button, status) {
  // Fullscreen must be requested directly from a user gesture.
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  function updateFullscreen() {
    const active = !!fullscreenElement();
    button.textContent = active ? 'Exit full screen' : 'Full screen';
    button.setAttribute('aria-pressed', String(active));
    button.hidden = !active && (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);
    status.hidden = true;
  }
  function fullscreenFallback() {
    status.textContent = 'Full screen is unavailable here. On iPad, use Safari’s Share menu → Add to Home Screen, then open the controller from its icon.';
    status.hidden = false;
  }
  button.addEventListener('click', async () => {
    try {
      if (fullscreenElement()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (!exit) return fullscreenFallback();
        await exit.call(document);
      } else {
        const root = document.documentElement;
        const enter = root.requestFullscreen || root.webkitRequestFullscreen;
        if (!enter) return fullscreenFallback();
        await enter.call(root);
      }
    } catch { fullscreenFallback(); }
  });
  document.addEventListener('fullscreenchange', updateFullscreen);
  document.addEventListener('webkitfullscreenchange', updateFullscreen);
  updateFullscreen();
}
