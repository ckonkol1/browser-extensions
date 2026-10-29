chrome.storage.local.get("redirectUrl", ({ redirectUrl }) => {
  if (redirectUrl) {
    // Re-validate before redirecting — guards against tampered storage values
    try {
      const parsed = new URL(redirectUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Disallowed protocol");
      }
      window.location.replace(parsed.href);
    } catch {
      document.getElementById("setup").hidden = false;
    }
  } else {
    document.getElementById("setup").hidden = false;
    document.getElementById("options-link").addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }
});
