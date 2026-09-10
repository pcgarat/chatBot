/**
 * Stream: chunks → buffer → flush al store (máximo 1 set por frame).
 * No un setState por token.
 */
export function createStreamBuffer(onFlush) {
  let text = "";
  let raf = 0;
  let flushed = 0;

  function flush() {
    raf = 0;
    if (flushed === text.length) return;
    flushed = text.length;
    onFlush(text);
  }

  return {
    append(chunk) {
      text += chunk;
      if (!raf) raf = requestAnimationFrame(flush);
    },
    getText() {
      return text;
    },
    syncFlush() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      flush();
    },
    reset() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      text = "";
      flushed = 0;
    },
  };
}
