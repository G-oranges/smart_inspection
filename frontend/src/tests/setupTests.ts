if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (callback) =>
    setTimeout(() => callback(Date.now()), 0);
}

if (!globalThis.cancelAnimationFrame) {
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
