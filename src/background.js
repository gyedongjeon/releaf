/**
 * Background script for Re:Leaf.
 * Listens for extension icon clicks and sends a message to the active tab.
 */

// Listen for the extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    // Send a message to the content script to toggle the view
    chrome.tabs.sendMessage(tab.id, { action: "toggleReleaf" });
  }
});
