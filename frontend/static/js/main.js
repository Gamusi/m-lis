// M-LIS Application Bootstrap & Entry Point
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    window.app.init();
  });
} else {
  window.app.init();
}
