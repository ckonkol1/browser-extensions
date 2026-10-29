const input = document.getElementById("url-input");
const status = document.getElementById("status");

function showStatus(msg) {
  status.textContent = msg;
  setTimeout(() => { status.textContent = ""; }, 2000);
}

// Load saved URL on open
chrome.storage.local.get("redirectUrl", ({ redirectUrl }) => {
  if (redirectUrl) input.value = redirectUrl;
});

document.getElementById("save-btn").addEventListener("click", () => {
  const url = input.value.trim();

  if (!url) {
    showStatus("Please enter a URL.");
    return;
  }

  try {
    // Validate the URL is well-formed and uses http/https
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      showStatus("Only http/https URLs are allowed.");
      return;
    }
  } catch {
    showStatus("Invalid URL.");
    return;
  }

  chrome.storage.local.set({ redirectUrl: url }, () => {
    showStatus("Saved!");
  });
});

document.getElementById("clear-btn").addEventListener("click", () => {
  chrome.storage.local.remove("redirectUrl", () => {
    input.value = "";
    showStatus("Cleared.");
  });
});
