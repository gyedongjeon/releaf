/**
 * Content script for Re:Leaf.
 * Transforms the page into an ebook-like view.
 */

const RELEAF_Container_ID = "releaf-container";

/**
 * Toggles the Re:Leaf view on the current page.
 */
function toggleReleaf() {
    const existingContainer = document.getElementById(RELEAF_Container_ID);

    if (existingContainer) {
        // If active, remove it (restore original view)
        existingContainer.remove();
        document.body.style.overflow = ""; // Restore scrolling
    } else {
        // If inactive, activate it
        enableReleaf();
    }
}

/**
 * Activates the Re:Leaf view.
 */
function enableReleaf() {
    // Extract content (simplistic approach for now: taking all paragraphs)
    // In a real reader mode, we'd use a parsing library like readability.js
    const paragraphs = Array.from(document.querySelectorAll("p")).map(p => p.textContent).join("\n\n");

    if (!paragraphs) {
        alert("No content found to format.");
        return;
    }

    // Create the container
    const container = document.createElement("div");
    container.id = RELEAF_Container_ID;

    // Create the content wrapper
    const content = document.createElement("div");
    content.className = "releaf-content";
    content.textContent = paragraphs; // textContent is safer for JSDOM

    container.appendChild(content);
    document.body.appendChild(container); // Append to body

    // Prevent background scrolling
    document.body.style.overflow = "hidden";
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleReleaf") {
        toggleReleaf();
    }
});

// Export functions for testing if using a module system (Jest usually needs CommonJS or Babel)
if (typeof module !== "undefined" && module.exports) {
    module.exports = { toggleReleaf, enableReleaf };
}
