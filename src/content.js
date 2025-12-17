/**
 * Content script for Re:Leaf.
 * Transforms the page into an ebook-like view.
 */

const RELEAF_Container_ID = "releaf-container";

// Prevent duplicate initialization
if (window.hasRunReleaf) {
    // If already loaded, we don't need to add listeners again.
    // We can just exit, as the listeners are already active.
    throw new Error("Re:Leaf already initialized");
}
window.hasRunReleaf = true;

/**
 * Toggles the Re:Leaf view on the current page.
 */
function toggleReleaf() {
    const existingContainer = document.getElementById(RELEAF_Container_ID);

    if (existingContainer) {
        // If active, remove it (restore original view)
        // Remove listeners
        document.removeEventListener('keydown', handleKeyNavigation);
        window.removeEventListener('resize', handleResize);
        existingContainer.remove();
        document.body.style.overflow = ""; // Restore scrolling
    } else {
        // If inactive, activate it
        enableReleaf();
    }
}

/**
 * Extracts content from the page, preserving structure.
 * @returns {string} HTML string of the extracted content
 */
function extractContent() {
    // Heuristic: Try to find the main article content.
    // Order matters: specific IDs often used for main content > semantic tags > fallback
    const candidates = [
        'article', 'main', '#content', '#main', '#bodyContent', '.main-content', '.post-content', '.article-content'
    ];

    let article = null;
    for (const selector of candidates) {
        article = document.querySelector(selector);
        if (article) break;
    }
    article = article || document.body;

    // Create a clone to manipulate without affecting the original page during extraction
    const clone = article.cloneNode(true);

    // Remove scripts, styles, and interactive elements that clutter reading
    // Expanded list to include common sidebar/nav patterns
    const unwantedSelectors = [
        'script', 'style', 'nav', 'footer', 'iframe', 'form', 'button',
        '[role="banner"]', '[role="navigation"]', '[role="complementary"]', '[role="search"]',
        '.sidebar', '#sidebar', '.menu', '#menu', '.nav', '.navigation', '.toc', '#toc',
        '.language-list', '.interlanguage-link', '#p-lang', // Specific to language menus
        '.ad', '.advertisement', '.social-share'
    ];

    const unwanted = clone.querySelectorAll(unwantedSelectors.join(', '));
    unwanted.forEach(el => el.remove());

    // Filter for readable elements
    const readableSelectors = 'p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, img, figure, pre, table';
    const elements = clone.querySelectorAll(readableSelectors);

    let extractedHtml = '';

    elements.forEach(el => {
        // Basic filtering: ignore hidden or empty elements
        // offsetParent check is good for real browsers but fails in JSDOM.
        // We'll rely on basic empty check for now.
        if (el.tagName !== 'BODY' && el.tagName !== 'IMG' && el.textContent.trim().length === 0) return;

        // Clean up inline styles for a consistent reading experience
        el.removeAttribute('style');
        el.removeAttribute('class');
        el.removeAttribute('id');

        // For images, fix relative URLs
        if (el.tagName === 'IMG') {
            if (!el.src) return; // Skip images without src
            el.style.maxWidth = '100%';
            el.style.height = 'auto';
        }

        // Check if the element contains text or has essential content (like img)
        if (el.textContent.trim().length > 0 || el.tagName === 'IMG' || el.tagName === 'FIGURE') {
            extractedHtml += el.outerHTML;
        }
    });

    return extractedHtml;
}

/**
 * Activates the Re:Leaf view.
 */
function enableReleaf() {
    const contentHtml = extractContent();

    if (!contentHtml) {
        alert("No content found to format.");
        return;
    }

    // Create the container
    const container = document.createElement("div");
    container.id = RELEAF_Container_ID;
    container.className = "releaf-theme-light"; // Default theme

    // Create Header
    const header = document.createElement("div");
    header.className = "releaf-header";

    // Theme Toggle Button
    const themeBtn = document.createElement("button");
    themeBtn.className = "releaf-btn";
    themeBtn.textContent = "Theme"; // textContent is safer for JSDOM
    themeBtn.onclick = () => {
        const current = container.className;
        if (current.includes("theme-light")) {
            container.className = "releaf-theme-sepia";
        } else if (current.includes("theme-sepia")) {
            container.className = "releaf-theme-dark";
        } else {
            container.className = "releaf-theme-light";
        }
    };

    // Close Button
    const closeBtn = document.createElement("button");
    closeBtn.className = "releaf-btn";
    closeBtn.textContent = "Close"; // textContent is safer for JSDOM
    closeBtn.onclick = toggleReleaf;

    header.appendChild(themeBtn);
    header.appendChild(closeBtn);

    // Create the content wrapper
    const content = document.createElement("div");
    content.className = "releaf-content";
    content.innerHTML = contentHtml;

    // Nav Container
    const navContainer = document.createElement("div");
    navContainer.className = "releaf-nav";

    // Prev Button
    const prevBtn = document.createElement("button");
    prevBtn.className = "releaf-btn";
    prevBtn.textContent = "← Prev"; // textContent is safer for JSDOM
    prevBtn.onclick = () => {
        content.scrollBy({ left: -window.innerWidth, behavior: 'smooth' });
    };

    // Next Button
    const nextBtn = document.createElement("button");
    nextBtn.className = "releaf-btn";
    nextBtn.textContent = "Next →"; // textContent is safer for JSDOM
    nextBtn.onclick = () => {
        content.scrollBy({ left: window.innerWidth, behavior: 'smooth' });
    };

    // Keyboard Support
    document.addEventListener('keydown', handleKeyNavigation);

    // Resize Support
    window.addEventListener('resize', handleResize);

    navContainer.appendChild(prevBtn);
    navContainer.appendChild(nextBtn);

    container.appendChild(header);
    container.appendChild(content);
    container.appendChild(navContainer);
    document.body.appendChild(container);

    // Prevent background scrolling
    document.body.style.overflow = "hidden";
}

let resizeTimeout;
function handleResize() {
    // Debounce resize handling
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const content = document.querySelector('.releaf-content');
        if (!content) return;

        // Snap to the nearest page
        const pageWidth = window.innerWidth;
        const currentScroll = content.scrollLeft;
        const pageIndex = Math.round(currentScroll / pageWidth);

        content.scrollTo({
            left: pageIndex * pageWidth,
            behavior: 'smooth'
        });
    }, 100);
}

function handleKeyNavigation(e) {
    const content = document.querySelector('.releaf-content');
    if (!content) return;

    if (e.key === 'ArrowRight') {
        content.scrollBy({ left: window.innerWidth, behavior: 'smooth' });
    } else if (e.key === 'ArrowLeft') {
        content.scrollBy({ left: -window.innerWidth, behavior: 'smooth' });
    } else if (e.key === 'Escape') {
        toggleReleaf();
    }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleReleaf") {
        toggleReleaf();
    }
});

// Export functions for testing if using a module system (Jest usually needs CommonJS or Babel)
if (typeof module !== "undefined" && module.exports) {
    module.exports = { toggleReleaf, enableReleaf, extractContent };
}
