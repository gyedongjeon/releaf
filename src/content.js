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
        document.removeEventListener('mousemove', handleUserActivity);
        document.removeEventListener('keydown', handleUserActivity);
        window.removeEventListener('resize', handleResize);
        clearTimeout(idleTimer);
        existingContainer.remove();
        document.body.style.overflow = ""; // Restore scrolling
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

    // Helper to create SVG icons
    const createIcon = (svgPath) => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "20");
        svg.setAttribute("height", "20");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.innerHTML = svgPath;
        return svg;
    };

    // Icons path data
    const ICONS = {
        theme: '<circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>', // Sun
        close: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>' // X
    };

    // Theme Toggle Button (for bottom menu)
    const themeBtn = document.createElement("button");
    themeBtn.className = "releaf-btn";
    themeBtn.title = "Toggle Theme";
    themeBtn.appendChild(createIcon(ICONS.theme));
    themeBtn.onclick = () => {
        const current = container.className;
        if (current.includes("theme-light")) {
            container.className = container.className.replace("theme-light", "theme-sepia");
        } else if (current.includes("theme-sepia")) {
            container.className = container.className.replace("theme-sepia", "theme-dark");
        } else {
            container.className = container.className.replace("theme-dark", "theme-light");
        }
    };

    // Font Size Controls
    let currentFontSize = 20;
    const minFontSize = 14;
    const maxFontSize = 32;

    const decreaseFontBtn = document.createElement("button");
    decreaseFontBtn.className = "releaf-btn";
    decreaseFontBtn.title = "Decrease Font Size";
    decreaseFontBtn.innerHTML = '<span style="font-family: serif; font-weight: bold;">A-</span>';
    decreaseFontBtn.onclick = () => {
        if (currentFontSize > minFontSize) {
            currentFontSize -= 2;
            container.style.setProperty('--releaf-font-size', `${currentFontSize}px`);
        }
    };

    const increaseFontBtn = document.createElement("button");
    increaseFontBtn.className = "releaf-btn";
    increaseFontBtn.title = "Increase Font Size";
    increaseFontBtn.innerHTML = '<span style="font-family: serif; font-weight: bold; font-size: 1.2em;">A+</span>';
    increaseFontBtn.onclick = () => {
        if (currentFontSize < maxFontSize) {
            currentFontSize += 2;
            container.style.setProperty('--releaf-font-size', `${currentFontSize}px`);
        }
    };

    // Close Button (for bottom menu)
    const closeBtn = document.createElement("button");
    closeBtn.className = "releaf-btn";
    closeBtn.title = "Close Reader View";
    closeBtn.appendChild(createIcon(ICONS.close));
    closeBtn.onclick = toggleReleaf;

    // Create the content wrapper
    const content = document.createElement("div");
    content.className = "releaf-content";
    content.innerHTML = contentHtml;

    // Navigation functions (used by touch zones and keyboard)
    const getPageWidth = () => window.innerWidth;

    const goToPrevPage = () => {
        const pageWidth = getPageWidth();
        const currentScroll = content.scrollLeft;
        const targetPage = Math.max(0, Math.floor((currentScroll - 10) / pageWidth));
        content.scrollTo({ left: targetPage * pageWidth, behavior: 'smooth' });
    };

    const goToNextPage = () => {
        const pageWidth = getPageWidth();
        const currentScroll = content.scrollLeft;
        const targetPage = Math.floor((currentScroll + 10) / pageWidth) + 1;
        content.scrollTo({ left: targetPage * pageWidth, behavior: 'smooth' });
    };

    const toggleMenu = () => {
        container.classList.toggle('releaf-menu-visible');
    };

    // Touch Zones Container
    const touchZones = document.createElement("div");
    touchZones.className = "releaf-touch-zones";

    // Tap detection helper - distinguishes taps from drags (for text selection)
    const TAP_THRESHOLD = 10; // pixels - movement less than this is a tap
    const TAP_TIME_LIMIT = 300; // ms - tap must be faster than this

    const createTapHandler = (action) => {
        let startX, startY, startTime;

        return {
            onMouseDown: (e) => {
                startX = e.clientX;
                startY = e.clientY;
                startTime = Date.now();
            },
            onMouseUp: (e) => {
                const deltaX = Math.abs(e.clientX - startX);
                const deltaY = Math.abs(e.clientY - startY);
                const deltaTime = Date.now() - startTime;

                // Only trigger action if it was a quick tap with minimal movement
                if (deltaX < TAP_THRESHOLD && deltaY < TAP_THRESHOLD && deltaTime < TAP_TIME_LIMIT) {
                    action();
                }
            }
        };
    };

    // Left zone (Previous page)
    const leftZone = document.createElement("div");
    leftZone.className = "releaf-touch-zone releaf-touch-zone-left";
    const leftTapHandler = createTapHandler(goToPrevPage);
    leftZone.onmousedown = leftTapHandler.onMouseDown;
    leftZone.onmouseup = leftTapHandler.onMouseUp;

    // Center zone (Toggle menu)
    const centerZone = document.createElement("div");
    centerZone.className = "releaf-touch-zone releaf-touch-zone-center";
    const centerTapHandler = createTapHandler(toggleMenu);
    centerZone.onmousedown = centerTapHandler.onMouseDown;
    centerZone.onmouseup = centerTapHandler.onMouseUp;

    // Right zone (Next page)
    const rightZone = document.createElement("div");
    rightZone.className = "releaf-touch-zone releaf-touch-zone-right";
    const rightTapHandler = createTapHandler(goToNextPage);
    rightZone.onmousedown = rightTapHandler.onMouseDown;
    rightZone.onmouseup = rightTapHandler.onMouseUp;

    touchZones.appendChild(leftZone);
    touchZones.appendChild(centerZone);
    touchZones.appendChild(rightZone);

    // Bottom Menu Bar
    const bottomMenu = document.createElement("div");
    bottomMenu.className = "releaf-bottom-menu";

    // Clone buttons for bottom menu
    const menuThemeBtn = themeBtn.cloneNode(true);
    menuThemeBtn.onclick = themeBtn.onclick;

    const menuDecreaseFontBtn = decreaseFontBtn.cloneNode(true);
    menuDecreaseFontBtn.onclick = decreaseFontBtn.onclick;

    const menuIncreaseFontBtn = increaseFontBtn.cloneNode(true);
    menuIncreaseFontBtn.onclick = increaseFontBtn.onclick;

    const menuCloseBtn = closeBtn.cloneNode(true);
    menuCloseBtn.onclick = toggleReleaf;

    bottomMenu.appendChild(menuThemeBtn);
    bottomMenu.appendChild(menuDecreaseFontBtn);
    bottomMenu.appendChild(menuIncreaseFontBtn);
    bottomMenu.appendChild(menuCloseBtn);

    container.appendChild(content);
    container.appendChild(touchZones);
    container.appendChild(bottomMenu);
    document.body.appendChild(container);

    // Prevent background scrolling
    document.body.style.overflow = "hidden";

    // Start Immersive Mode Timer
    resetIdleTimer();

    // Add Immersive Mode Listeners
    document.addEventListener('mousemove', handleUserActivity);
    document.addEventListener('keydown', handleUserActivity);
    window.addEventListener('resize', handleResize);
}

let idleTimer;
const IDLE_TIMEOUT = 3000; // 3 seconds

function resetIdleTimer() {
    const container = document.getElementById(RELEAF_Container_ID);
    if (!container) return;

    // Show UI
    container.classList.remove('releaf-ui-hidden');

    // Reset Timer
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        container.classList.add('releaf-ui-hidden');
    }, IDLE_TIMEOUT);
}

// Activity Listeners for Immersive Mode
function handleUserActivity(e) {
    resetIdleTimer();
    if (e.type === 'keydown') {
        handleKeyNavigation(e);
    }
}

// Listeners are now added in enableReleaf and removed in toggleReleaf

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

    const pageWidth = window.innerWidth;

    if (e.key === 'ArrowRight') {
        const currentScroll = content.scrollLeft;
        const targetPage = Math.floor((currentScroll + 10) / pageWidth) + 1;
        content.scrollTo({ left: targetPage * pageWidth, behavior: 'smooth' });
    } else if (e.key === 'ArrowLeft') {
        const currentScroll = content.scrollLeft;
        const targetPage = Math.max(0, Math.floor((currentScroll - 10) / pageWidth));
        content.scrollTo({ left: targetPage * pageWidth, behavior: 'smooth' });
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
