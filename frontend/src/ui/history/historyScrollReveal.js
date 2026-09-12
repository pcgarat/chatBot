const IDLE_HIDE_MS = 1200;

/** Revela el thumb del scroll al interactuar; lo oculta tras idle fuera del elemento. */
export function bindPointerScrollReveal(node) {
  if (!node || node.dataset.scrollRevealBound === "1") return;
  node.dataset.scrollRevealBound = "1";

  let hideTimer = null;
  let pointerOver = false;

  function setVisible(visible) {
    node.classList.toggle("is-scrollbar-visible", visible);
  }

  function clearHide() {
    if (hideTimer === null) return;
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  function scheduleHide() {
    clearHide();
    hideTimer = setTimeout(() => {
      hideTimer = null;
      if (!pointerOver) setVisible(false);
    }, IDLE_HIDE_MS);
  }

  node.addEventListener("mousemove", () => {
    setVisible(true);
    if (!pointerOver) scheduleHide();
  });
  node.addEventListener("mouseenter", () => {
    pointerOver = true;
    clearHide();
    setVisible(true);
  });
  node.addEventListener("mouseleave", () => {
    pointerOver = false;
    scheduleHide();
  });
  node.addEventListener(
    "scroll",
    () => {
      setVisible(true);
      if (!pointerOver) scheduleHide();
    },
    { passive: true },
  );
}

export function initHistoryScrollReveal() {
  bindPointerScrollReveal(document.querySelector(".column-left .conversations-list-wrap"));
}

export function initChatScrollReveal() {
  const wrap = document.querySelector(".chat-stream-wrap");
  if (!wrap || wrap.dataset.scrollRevealBound === "1") return;
  wrap.dataset.scrollRevealBound = "1";

  let hideTimer = null;
  let pointerOver = false;

  function target() {
    return document.getElementById("messages-container");
  }

  function setVisible(visible) {
    const node = target();
    if (node) node.classList.toggle("is-scrollbar-visible", visible);
  }

  function clearHide() {
    if (hideTimer === null) return;
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  function scheduleHide() {
    clearHide();
    hideTimer = setTimeout(() => {
      hideTimer = null;
      if (!pointerOver) setVisible(false);
    }, IDLE_HIDE_MS);
  }

  wrap.addEventListener("mousemove", () => {
    setVisible(true);
    if (!pointerOver) scheduleHide();
  });
  wrap.addEventListener("mouseenter", () => {
    pointerOver = true;
    clearHide();
    setVisible(true);
  });
  wrap.addEventListener("mouseleave", () => {
    pointerOver = false;
    scheduleHide();
  });
  wrap.addEventListener(
    "scroll",
    (e) => {
      if (e.target !== target()) return;
      setVisible(true);
      if (!pointerOver) scheduleHide();
    },
    true,
  );
}
