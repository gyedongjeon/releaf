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
    // 1. Selector Candidates
    // specific IDs often used for main content > semantic tags > fallback
    // Added '#dic_area' for Naver News support
    const candidates = [
        '#dic_area', '.newsct_article', // Naver News
        'article', 'main', '#content', '#main', '#bodyContent',
        '.main-content', '.post-content', '.article-content',
        '.entry-content', '#story-body'
    ];

    let article = null;
    for (const selector of candidates) {
        article = document.querySelector(selector);
        if (article) break;
    }
    article = article || document.body;

    // 2. Clone to manipulate safely
    const clone = article.cloneNode(true);

    // 3. Remove Unwanted Elements (Noise)
    const unwantedSelectors = [
        'script', 'style', 'noscript', 'iframe', 'form', 'button', 'input', 'textarea',
        'nav', 'footer', 'header', 'aside',
        'video', 'audio', 'canvas', 'object', 'embed', 'map',
        '[data-component="video-block"]', '[data-component="ad-slot"]',
        '[role="banner"]', '[role="navigation"]', '[role="complementary"]', '[role="search"]',
        '.sidebar', '#sidebar', '.menu', '#menu', '.nav', '.navigation', '.toc', '#toc',
        '.language-list', '.interlanguage-link', '#p-lang',
        '.ad', '.advertisement', '.social-share', '.share-buttons',
        '.related-posts', '.comments', '#comments', '.meta', '.author-bio'
    ];

    // Safety check: Don't remove if the article IS one of these (unlikely but possible with poor semantics)
    clone.querySelectorAll(unwantedSelectors.join(', ')).forEach(el => el.remove());

    // 4. Attribute Stripping & Cleanup
    // Instead of selecting specific tags, we walk the tree and clean it.
    // This preserves Text Nodes (direct text children) and structure (divs used as paragraphs).
    const walk = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
    let currentNode = walk.nextNode(); // Skip root

    while (currentNode) {
        const el = currentNode;
        currentNode = walk.nextNode(); // Advance pointer before modification

        // 4.1 Remove all attributes except "src", "href", "alt"
        const attrs = [...el.attributes];
        attrs.forEach(attr => {
            if (!['src', 'href', 'alt', 'title', 'rowspan', 'colspan'].includes(attr.name)) {
                el.removeAttribute(attr.name);
            }
        });

        // 4.2 Handling Images
        if (el.tagName === 'IMG') {
            // Lazy loading fix: often src is hidden in data-src
            const dataSrc = el.getAttribute('data-src') || el.getAttribute('data-original');
            if (dataSrc) {
                el.src = dataSrc;
            }
            // Enhance basic image styling
            el.style.maxWidth = '100%';
            el.style.height = 'auto';
            el.style.display = 'block';
            el.style.margin = '1em auto';
            continue;
        }

        // 4.3 Unwrap useless containers? (Optional, but 'div' stripping might be risky)
        // For now, keep structure but rely on CSS to handle it.
    }

    // 5. Return Cleaned HTML
    return clone.innerHTML;
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
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="16" rx="2" /></svg>
                </button>
                <button class="releaf-page-view-btn" data-pages="2" title="Two Page View">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" /><line x1="12" y1="4" x2="12" y2="20" /></svg>
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

            // Save theme
            chrome.storage.sync.set({
                releaf_bg: colors.bg,
                releaf_text: colors.text,
                releaf_accent: colors.accent,
                releaf_theme_id: theme
            });
        };
    });

    // Wire up sliders
    settingsPopup.querySelector('#releaf-font-size').oninput = (e) => {
        const val = e.target.value;
        container.style.setProperty('--releaf-font-size', `${val}px`);
        currentFontSize = parseInt(val); // Update local var for A+/A- buttons
        saveSetting('releaf_fontSize', val);
    };

    settingsPopup.querySelector('#releaf-line-height').oninput = (e) => {
        const val = (e.target.value / 10).toFixed(1);
        container.style.setProperty('--releaf-line-height', val);
        saveSetting('releaf_lineHeight', val);
    };

    settingsPopup.querySelector('#releaf-margin-v').oninput = (e) => {
        const val = e.target.value;
        container.style.setProperty('--releaf-margin-v', `${val}px`);
        saveSetting('releaf_marginV', val);
    };

    settingsPopup.querySelector('#releaf-margin-h').oninput = (e) => {
        const val = e.target.value;
        container.style.setProperty('--releaf-margin-h', `${val}px`);
        saveSetting('releaf_marginH', val);
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
            saveSetting('releaf_pageView', pages);
        };
    });

    // Tutorial Logic
    const launchTutorial = () => {
        // Create Overlay
        const overlay = document.createElement("div");
        overlay.className = "releaf-tutorial-overlay";

        const card = document.createElement("div");
        card.className = "releaf-tutorial-card";
        // Relative position for close button
        card.style.position = 'relative';
        overlay.appendChild(card);
        container.appendChild(overlay);

        let currentStep = 0;
        const steps = [
            {
                title: `Welcome to Re:Leaf! <img src="${chrome.runtime.getURL('images/icon-48.png')}" class="releaf-tutorial-logo" alt="Leaf Logo"/>`,
                text: "Tap <b>Left/Right</b> to turn pages.<br>Tap <b>Center</b> to show the menu.",
                action: () => {
                    // Show zone indicators
                    const leftZone = document.createElement('div');
                    leftZone.className = 'releaf-zone-indicator releaf-zone-left';
                    leftZone.textContent = 'Prev';
                    overlay.appendChild(leftZone);

                    const rightZone = document.createElement('div');
                    rightZone.className = 'releaf-zone-indicator releaf-zone-right';
                    rightZone.textContent = 'Next';
                    overlay.appendChild(rightZone);
                },
                cleanup: () => {
                    overlay.querySelectorAll('.releaf-zone-indicator').forEach(el => el.remove());
                }
            },
            {
                title: "Customization",
                text: "Click the <b>Settings Gear</b> to change themes, font size, and spacing."
            },
            {
                title: "Finished Reading?",
                text: "Click the <b>Close Button</b> or press <b>Escape</b> to return to the original page."
            }
        ];

        const closeTutorial = (finished = false) => {
            const dontShowAgain = card.querySelector('#releaf-dont-show-again')?.checked;

            // Save if finished OR if user explicitly checked "Don't show again"
            if (finished || dontShowAgain) {
                chrome.storage.sync.set({ releaf_hasSeenTutorial: true });
            }

            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        };

        const showStep = (index) => {
            if (index >= steps.length) {
                closeTutorial(true);
                return;
            }

            const step = steps[index];

            // Clean up previous
            if (index > 0 && steps[index - 1].cleanup) steps[index - 1].cleanup();
            if (index > 0 && steps[index - 1].target) steps[index - 1].target.classList.remove('releaf-highlight');

            // Setup new step
            const isLast = index === steps.length - 1;
            card.innerHTML = `
                <button class="releaf-tutorial-close" title="Close">×</button>
                <h3>${step.title}</h3>
                <p>${step.text}</p>
                <div class="releaf-tutorial-footer">
                    <label class="releaf-tutorial-checkbox">
                        <input type="checkbox" id="releaf-dont-show-again">
                        Don't show again
                    </label>
                    <button class="releaf-tutorial-btn">${isLast ? "All Done!" : "Next"}</button>
                </div>
            `;

            // Handle target highlight
            if (step.target) {
                step.target.classList.add('releaf-highlight');

                // FORCE SHOW UI: Remove immersive hide AND add menu visible class
                container.classList.remove('releaf-ui-hidden');
                container.classList.add('releaf-menu-visible');
            }

            // Run action if any
            if (step.action) step.action();

            // Bind Next/Finish button
            card.querySelector('.releaf-tutorial-btn').onclick = () => {
                currentStep++;
                showStep(currentStep);
            };

            // Bind Close button
            card.querySelector('.releaf-tutorial-close').onclick = () => closeTutorial(false);

            // Show overlay
            requestAnimationFrame(() => overlay.classList.add('visible'));
        };

        // Start
        showStep(0);
    };

    // Load settings & Check Tutorial
    const loadSettings = () => {
        chrome.storage.sync.get([
            'releaf_bg', 'releaf_text', 'releaf_accent', 'releaf_theme_id',
            'releaf_fontSize', 'releaf_lineHeight',
            'releaf_marginV', 'releaf_marginH',
            'releaf_pageView',
            'releaf_hasSeenTutorial'
        ], (items) => {
            if (items.releaf_bg) container.style.setProperty('--releaf-bg-rgb', items.releaf_bg);
            if (items.releaf_text) container.style.setProperty('--releaf-text-rgb', items.releaf_text);
            if (items.releaf_accent) container.style.setProperty('--releaf-accent-rgb', items.releaf_accent);

            if (items.releaf_theme_id) {
                settingsPopup.querySelectorAll('.releaf-color-swatch').forEach(s => s.classList.remove('active'));
                const activeSwatch = settingsPopup.querySelector(`.releaf-color-swatch[data-theme="${items.releaf_theme_id}"]`);
                if (activeSwatch) activeSwatch.classList.add('active');
            }

            if (items.releaf_fontSize) {
                container.style.setProperty('--releaf-font-size', `${items.releaf_fontSize}px`);
                settingsPopup.querySelector('#releaf-font-size').value = items.releaf_fontSize;
                currentFontSize = parseInt(items.releaf_fontSize);
            }

            if (items.releaf_lineHeight) {
                container.style.setProperty('--releaf-line-height', items.releaf_lineHeight);
                settingsPopup.querySelector('#releaf-line-height').value = items.releaf_lineHeight * 10;
            }

            if (items.releaf_marginV) {
                container.style.setProperty('--releaf-margin-v', `${items.releaf_marginV}px`);
                settingsPopup.querySelector('#releaf-margin-v').value = items.releaf_marginV;
            }

            if (items.releaf_marginH) {
                container.style.setProperty('--releaf-margin-h', `${items.releaf_marginH}px`);
                settingsPopup.querySelector('#releaf-margin-h').value = items.releaf_marginH;
            }

            if (items.releaf_pageView) {
                settingsPopup.querySelectorAll('.releaf-page-view-btn').forEach(b => b.classList.remove('active'));
                const btn = settingsPopup.querySelector(`.releaf-page-view-btn[data-pages="${items.releaf_pageView}"]`);
                if (btn) btn.classList.add('active');

                if (items.releaf_pageView === '2') {
                    container.classList.add('releaf-2page');
                } else {
                    container.classList.remove('releaf-2page');
                }
            }

            // Launch Tutorial if not seen
            if (!items.releaf_hasSeenTutorial) {
                setTimeout(launchTutorial, 500); // Slight delay for smooth entry
            }
        });
    };

    // Helper to save settings
    const saveSetting = (key, value) => {
        chrome.storage.sync.set({ [key]: value });
    };

    // Load settings initially
    loadSettings();

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
