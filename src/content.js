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

    // Close Button (Rounded X)
    const closeBtn = document.createElement("button");
    closeBtn.className = "releaf-btn";
    closeBtn.dataset.tooltip = "Close Reader"; // Custom tooltip
    closeBtn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>`;
    closeBtn.onclick = toggleReleaf;

    // Create the content wrapper
    const content = document.createElement("div");
    content.className = "releaf-content";
    content.innerHTML = contentHtml;

    // Navigation functions (used by touch zones and keyboard)
    // Precise scroll distance calculation
    const getPageWidth = () => {
        const style = window.getComputedStyle(content);
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        const paddingRight = parseFloat(style.paddingRight) || 0;
        const columnGap = parseFloat(style.columnGap) || 0;

        // Content area width (viewport - visible padding)
        const visibleContentWidth = content.clientWidth - paddingLeft - paddingRight;

        // Scroll distance = one 'screenful' of content + the gap to the next column
        return Math.round(visibleContentWidth + columnGap);
    };

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

    // Tap detection on container - determines zone based on x position
    const TAP_THRESHOLD = 10; // pixels - movement less than this is a tap
    const TAP_TIME_LIMIT = 300; // ms - tap must be faster than this
    let tapStartX, tapStartY, tapStartTime;

    container.addEventListener('mousedown', (e) => {
        tapStartX = e.clientX;
        tapStartY = e.clientY;
        tapStartTime = Date.now();
    });

    container.addEventListener('mouseup', (e) => {
        // Skip if clicking on buttons
        if (e.target.closest('.releaf-btn') || e.target.closest('.releaf-bottom-menu')) {
            return;
        }

        const deltaX = Math.abs(e.clientX - tapStartX);
        const deltaY = Math.abs(e.clientY - tapStartY);
        const deltaTime = Date.now() - tapStartTime;

        // Only trigger if it was a quick tap with minimal movement
        if (deltaX < TAP_THRESHOLD && deltaY < TAP_THRESHOLD && deltaTime < TAP_TIME_LIMIT) {
            const screenWidth = window.innerWidth;
            const clickX = e.clientX;

            if (clickX < screenWidth * 0.2) {
                // Left 20% - Previous page
                goToPrevPage();
            } else if (clickX > screenWidth * 0.8) {
                // Right 20% - Next page
                goToNextPage();
            } else {
                // Center 60% - Toggle menu
                toggleMenu();
            }
        }
    });

    // Bottom Menu Bar
    const bottomMenu = document.createElement("div");
    bottomMenu.className = "releaf-bottom-menu";

    // Settings state
    let currentFontSizeValue = 20;
    let currentLineHeight = 1.8;
    let currentMarginV = 80;
    let currentMarginH = 40;

    // Settings Button (Gear Icon)
    const settingsBtn = document.createElement("button");
    settingsBtn.className = "releaf-btn";
    settingsBtn.title = ""; // Removed standard title to use custom tooltip
    settingsBtn.dataset.tooltip = "Settings";
    // Premium Gear Icon (Lucide-style)
    settingsBtn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>`;

    // Toggle settings popup
    const toggleSettings = () => {
        container.classList.toggle('releaf-settings-visible');
    };
    settingsBtn.onclick = toggleSettings;

    // Settings Popup
    const settingsPopup = document.createElement("div");
    settingsPopup.className = "releaf-settings-popup";
    settingsPopup.innerHTML = `
        <div class="releaf-settings-header">
            <h3 class="releaf-settings-title">View Settings</h3>
            <button class="releaf-settings-close">✕</button>
        </div>
        <div class="releaf-color-swatches">
            <div class="releaf-color-swatch releaf-swatch-light active" data-theme="light"></div>
            <div class="releaf-color-swatch releaf-swatch-cream" data-theme="sepia"></div>
            <div class="releaf-color-swatch releaf-swatch-mint" data-theme="mint"></div>
            <div class="releaf-color-swatch releaf-swatch-green" data-theme="forest"></div>
            <div class="releaf-color-swatch releaf-swatch-gray" data-theme="gray"></div>
            <div class="releaf-color-swatch releaf-swatch-dark" data-theme="dark"></div>
        </div>
        <div class="releaf-settings-row">
            <span class="releaf-settings-label">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
                Text Size
            </span>
            <input type="range" class="releaf-slider" id="releaf-font-size" min="14" max="32" value="20">
        </div>
        <div class="releaf-settings-row">
            <span class="releaf-settings-label">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10H3"/><path d="M21 6H3"/><path d="M21 14H3"/><path d="M21 18H3"/></svg>
                Line Spacing
            </span>
            <input type="range" class="releaf-slider" id="releaf-line-height" min="12" max="24" value="18">
        </div>
        <div class="releaf-settings-row">
            <span class="releaf-settings-label">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="m8 7 4-4 4 4"/><path d="m8 17 4 4 4-4"/></svg>
                Vertical Margin
            </span>
            <input type="range" class="releaf-slider" id="releaf-margin-v" min="40" max="120" value="80">
        </div>
        <div class="releaf-settings-row">
            <span class="releaf-settings-label">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="m7 8-4 4 4 4"/><path d="m17 8 4 4-4 4"/></svg>
                Horizontal Margin
            </span>
            <input type="range" class="releaf-slider" id="releaf-margin-h" min="20" max="80" value="40">
        </div>
        <div class="releaf-settings-row">
            <span class="releaf-settings-label">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="15" y1="3" y2="3"/><line x1="9" x2="15" y1="21" y2="21"/></svg>
                Page View
            </span>
            <div class="releaf-page-view-btns">
                <button class="releaf-page-view-btn active" data-pages="1" title="Single Page View">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
                </button>
                <button class="releaf-page-view-btn" data-pages="2" title="Two Page View">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M12 2v20"/></svg>
                </button>
            </div>
        </div>
    `;

    // Wire up close button
    settingsPopup.querySelector('.releaf-settings-close').onclick = toggleSettings;

    // Close popup when clicking outside
    container.addEventListener('click', (e) => {
        if (container.classList.contains('releaf-settings-visible')) {
            // Check if click is outside the popup and not on the settings button
            if (!settingsPopup.contains(e.target) && !settingsBtn.contains(e.target)) {
                container.classList.remove('releaf-settings-visible');
            }
        }
    });

    // Wire up color swatches
    const themeColors = {
        light: { bg: '255, 255, 255', text: '34, 34, 34', accent: '234, 234, 234' },
        sepia: { bg: '252, 246, 229', text: '74, 60, 49', accent: '234, 221, 207' },
        mint: { bg: '232, 245, 233', text: '46, 80, 54', accent: '200, 230, 201' },
        forest: { bg: '21, 128, 61', text: '236, 253, 245', accent: '22, 101, 52' },
        gray: { bg: '107, 114, 128', text: '243, 244, 246', accent: '75, 85, 99' },
        dark: { bg: '26, 26, 26', text: '212, 212, 212', accent: '51, 51, 51' }
    };

    settingsPopup.querySelectorAll('.releaf-color-swatch').forEach(swatch => {
        swatch.onclick = () => {
            // Remove active from all
            settingsPopup.querySelectorAll('.releaf-color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');

            const theme = swatch.dataset.theme;
            const colors = themeColors[theme];
            container.style.setProperty('--releaf-bg-rgb', colors.bg);
            container.style.setProperty('--releaf-text-rgb', colors.text);
            container.style.setProperty('--releaf-accent-rgb', colors.accent);
        };
    });

    // Wire up sliders
    settingsPopup.querySelector('#releaf-font-size').oninput = (e) => {
        container.style.setProperty('--releaf-font-size', `${e.target.value}px`);
    };

    settingsPopup.querySelector('#releaf-line-height').oninput = (e) => {
        container.style.setProperty('--releaf-line-height', (e.target.value / 10).toFixed(1));
    };

    settingsPopup.querySelector('#releaf-margin-v').oninput = (e) => {
        container.style.setProperty('--releaf-margin-v', `${e.target.value}px`);
    };

    settingsPopup.querySelector('#releaf-margin-h').oninput = (e) => {
        container.style.setProperty('--releaf-margin-h', `${e.target.value}px`);
    };

    // Wire up page view buttons
    settingsPopup.querySelectorAll('.releaf-page-view-btn').forEach(btn => {
        btn.onclick = () => {
            // Update active state
            settingsPopup.querySelectorAll('.releaf-page-view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Toggle 2-page mode
            const pages = btn.dataset.pages;
            if (pages === '2') {
                container.classList.add('releaf-2page');
            } else {
                container.classList.remove('releaf-2page');
            }
        };
    });

    // Page Counter
    const pageCounter = document.createElement("div");
    pageCounter.className = "releaf-page-counter";
    pageCounter.textContent = "1 / 1"; // Initial state

    // Update page counter function
    const updatePageCount = () => {
        const pageWidth = getPageWidth();
        const totalWidth = content.scrollWidth;
        const currentScroll = content.scrollLeft;

        // Calculate pages (add small buffer for rounding errors)
        const totalPages = Math.max(1, Math.ceil((totalWidth - 10) / pageWidth));
        const currentPage = Math.min(totalPages, Math.max(1, Math.floor((currentScroll + 10) / pageWidth) + 1));

        pageCounter.textContent = `${currentPage} / ${totalPages}`;

        // Update range input if we had a progress slider
        // But for now just text
    };

    // Update on scroll and resize
    content.addEventListener('scroll', () => {
        // Debounce slightly for performance? No need for simple text update
        window.requestAnimationFrame(updatePageCount);
    });
    window.addEventListener('resize', updatePageCount);

    // Also update when settings change (font size, margins etc)
    const observer = new MutationObserver(updatePageCount);
    observer.observe(container, { attributes: true, attributeFilter: ['style', 'class'] });

    // Initial update after layout
    setTimeout(updatePageCount, 100);

    // Tooltip Helper
    const showTooltip = (target, text) => {
        let tooltip = document.getElementById('releaf-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'releaf-tooltip';
            tooltip.className = 'releaf-tooltip';
            document.body.appendChild(tooltip);
        }
        tooltip.textContent = text;
        const rect = target.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.bottom = `${window.innerHeight - rect.top + 8}px`; // Position above
        tooltip.classList.add('visible');
    };

    const hideTooltip = () => {
        const tooltip = document.getElementById('releaf-tooltip');
        if (tooltip) tooltip.classList.remove('visible');
    };

    // Attach tooltips
    [settingsBtn, closeBtn].forEach(btn => {
        btn.addEventListener('mouseenter', (e) => showTooltip(e.currentTarget, e.currentTarget.dataset.tooltip));
        btn.addEventListener('mouseleave', hideTooltip);
    });

    // Add to bottom menu (Order: Settings | Counter | Close)
    bottomMenu.appendChild(settingsBtn);
    bottomMenu.appendChild(pageCounter);
    bottomMenu.appendChild(closeBtn);

    container.appendChild(content);
    container.appendChild(settingsPopup);
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
