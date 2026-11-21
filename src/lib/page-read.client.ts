// Read-only requests belong to the current document. A background tab is still active.
let lifetime: AbortController | undefined;
if (typeof window !== 'undefined') {
  lifetime = new AbortController();
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) lifetime?.abort();
  });
}

export function pageReadSignal() {
  return lifetime?.signal;
}

export function isPageReadCancelled(error: unknown) {
  return lifetime?.signal.aborted === true && (
    error instanceof TypeError ||
    (error instanceof Error && error.name === 'AbortError')
  );
}
