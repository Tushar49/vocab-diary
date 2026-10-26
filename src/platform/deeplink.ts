/** Handle PWA launch URLs (installed app opened via link/Shortcut) → route into the app. */

export function initLaunchQueue(): void {
  const w = window as unknown as {
    launchQueue?: { setConsumer(cb: (params: { targetURL?: string }) => void): void };
  };
  if (!w.launchQueue) return;
  w.launchQueue.setConsumer(({ targetURL }) => {
    if (!targetURL) return;
    try {
      const url = new URL(targetURL);
      const params = url.searchParams;
      const word = params.get("word");
      const text = params.get("text") ?? params.get("translation");
      if (word || text) {
        const q = new URLSearchParams();
        if (word) q.set("word", word);
        if (text) q.set("translation", text);
        window.location.hash = `#/add?${q.toString()}`;
      }
    } catch {
      /* ignore malformed launch URLs */
    }
  });
}
