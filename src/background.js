/**
 * Background script for Re:Leaf.
 * Listens for extension icon clicks and sends a message to the active tab.
 */

// Listen for the extension icon click
// Listen for the extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  try {
    // Try sending a message. If the content script is ready, it will toggle.
    await chrome.tabs.sendMessage(tab.id, { action: "toggleReleaf" });
  } catch (err) {
    // If the message fails, the content script likely isn't loaded.
    console.log("Re:Leaf content script not ready. Injecting now...", err);

    try {
      // Dynamically inject the script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [
          "src/content/utils.js",
          "src/content/ui.js",
          "src/content/main.js"
        ]
      });

      // Also ensure CSS is present (though manifest usually handles this, dynamic injection might need it)
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["src/styles.css"]
      });

      // Retry sending the message
      await chrome.tabs.sendMessage(tab.id, { action: "toggleReleaf" });
    } catch (e) {
      console.error("Failed to inject or toggle Re:Leaf:", e);
    }
  }
});
