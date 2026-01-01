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
    let article = findMainContent(document);

    // Deep clone to manipulate safely
    const clone = article.cloneNode(true);

    // Remove hidden elements from the clone based on the original structure
    removeHiddenElements(article, clone);

    // Remove noise (ads, sidebars, etc.)
    cleanupNodes(clone);

    // Strip attributes and fix images
    sanitizeAndFixContent(clone);

    return clone.innerHTML;
}

/**
 * Finds the main content element using selectors or text density.
 * @param {Document|Element} root 
 * @returns {Element} The matched element or body/fallback
 */
function findMainContent(root) {
    // 1. Selector Candidates
    const candidates = [
        '#dic_area', '.newsct_article', // Naver News
        '#article_txt', '.article_txt', // Donga
        'article', 'main', '#content', '#main', '#bodyContent',
        '.main-content', '.post-content', '.article-content',
        '.entry-content', '#story-body',
        '.content', '#content-area', '.page-content',
        '[role="main"]', '.post-body', '.report-content',
        '.document-body', '#report-body'
    ];

    for (const selector of candidates) {
        const found = root.querySelector(selector);
        // Heuristic: Content must be of substantial length (>200 chars)
        const textLength = found ? (found.innerText || found.textContent || '').length : 0;
        if (found && textLength > 200) {
            return found;
        }
    }

    // 2. Text Density Fallback
    const bestBlock = findBestBlockByDensity(root);
    if (bestBlock) return bestBlock;

    // 3. Last Resort
    return root.querySelector('article') || root.body;
}

/**
 * Scans for the element with the highest text density.
 * @param {Document|Element} root 
 * @returns {Element|null}
 */
function findBestBlockByDensity(root) {
    const blocks = root.querySelectorAll('div, section, article, main');
    let maxScore = 0;
    let bestBlock = null;

    blocks.forEach(block => {
        if (block.offsetParent === null) return; // Skip invisible

        const text = block.innerText || block.textContent || '';
        const textLen = text.length;
        if (textLen < 200) return; // Ignore small blocks

        const links = block.querySelectorAll('a');
        let linkLen = 0;
        links.forEach(l => linkLen += (l.innerText || l.textContent || '').length);

        // Score: Text Length penalized by Link Density
        const linkDensity = linkLen / Math.max(1, textLen);
        const score = textLen * (1 - linkDensity * 2);

        if (score > maxScore) {
            maxScore = score;
            bestBlock = block;
        }
    });

    return bestBlock;
}

/**
 * Removes hidden elements from the clone based on the original DOM.
 * @param {Element} original 
 * @param {Element} clone 
 */
function removeHiddenElements(original, clone) {
    if (!original.querySelectorAll) return;

    const originals = original.querySelectorAll('*');
    const clones = clone.querySelectorAll('*');

    for (let i = 0; i < originals.length; i++) {
        const origEl = originals[i];
        if (origEl.offsetParent === null && origEl.tagName !== 'SCRIPT' && origEl.tagName !== 'STYLE') {
            if (clones[i] && clones[i].parentNode) {
                clones[i].remove();
            }
        }
    }
}

/**
 * Removes noisy elements (ads, navs, sidebars) from the element.
 * @param {Element} element 
 */
function cleanupNodes(element) {
    const unwantedSelectors = [
        'script', 'style', 'noscript', 'iframe', 'form', 'button', 'input', 'textarea',
        'nav', 'footer', 'header', 'aside',
        'video', 'audio', 'canvas', 'object', 'embed', 'map',
        '[data-component="video-block"]', '[data-component="ad-slot"]',
        '[role="banner"]', '[role="navigation"]', '[role="complementary"]', '[role="search"]',
        '.sidebar', '#sidebar', '.menu', '#menu', '.nav', '.navigation', '.toc', '#toc',
        '.language-list', '.interlanguage-link', '#p-lang',
        '.ad', '.advertisement', '.social-share', '.share-buttons',
        '.related-posts', '.comments', '#comments', '.meta', '.author-bio',
        // Daum/Naver specific noise
        '.layer_util', '.box_setting', '.util_view', '.wrap_util',
        '.box_layer', '.img_mask', '.btn_util',
        // Daum/Naver Footers & Related
        '.foot_view', '.box_recommend', '.txt_copyright', '.box_etc',
        '#foot_view', '.kakao_ad', '.art_copy',
        // Donga specific noise
        '.article_foot', '.article_copy', '.article_relation', '.article_sns',
        '.article_issue', '.article_related', '.article_reporter',
        '.copyright', '.copy_txt', '.relation_list', '.link_news',
        // OhmyNews / Generic news portal noise
        '.article_reaction', '.reaction_wrap', '.poll_wrap', '.survey_wrap',
        '.news_reaction', '.article_poll', '.article_survey',
        '[class*="reaction"]', '[class*="poll"]', '[class*="survey"]',
        // Reporter contact / email sections
        '.reporter_info', '.writer_info', '.byline_info', '.journalist',
        '[class*="reporter"]', '[class*="journalist"]', '[class*="byline"]',
        // Related news lists (various portals)
        '.related_news', '.news_list', '.article_list', '.more_news',
        '[class*="news_list"]', '[class*="article_list"]',
        // Tags and keywords
        '.tags', '.tag', '.keywords', '.article_tags', '.view_tag',
        '[class*="tag"]', '[class*="keyword"]',
        // Generic footer patterns
        '[class*="copyright"]', '[class*="footer"]', '[class*="related"]',
        '[id*="copyright"]', '[id*="footer"]', '[id*="related"]'
    ];

    element.querySelectorAll(unwantedSelectors.join(', ')).forEach(el => el.remove());
}

/**
 * Strips attributes and fixes image sources.
 * @param {Element} root 
 */
function sanitizeAndFixContent(root) {
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let currentNode = walk.nextNode(); // Skip root

    const allowedAttrs = ['src', 'href', 'alt', 'title', 'rowspan', 'colspan', 'data-src', 'data-original'];

    while (currentNode) {
        const el = currentNode;
        currentNode = walk.nextNode(); // Advance before modifying

        // 1. Attribute Stripping
        const attrs = [...el.attributes];
        attrs.forEach(attr => {
            if (!allowedAttrs.includes(attr.name)) {
                el.removeAttribute(attr.name);
            }
        });

        // 2. Image Fixes (Lazy Loading & Styling)
        if (el.tagName === 'IMG') {
            const dataSrc = el.getAttribute('data-src') || el.getAttribute('data-original');
            if (dataSrc) el.src = dataSrc;

            el.style.maxWidth = '100%';
            el.style.height = 'auto';
            el.style.display = 'block';
            el.style.margin = '1em auto';
        }
    }
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

    // 1. Create Core UI Elements
    const container = createReaderContainer();
    const content = createContent(contentHtml);
    const bottomMenu = createBottomMenu(container, content);

    // 2. Assemble DOM
    container.appendChild(content);
    container.appendChild(bottomMenu); // Settings popup is attached inside createBottomMenu or separately? 
    // Actually, let's keep it clean. Settings popup usually sits in container.
    const { settingsPopup, updateSettingsUI } = createSettingsPopup(container);
    container.appendChild(settingsPopup);

    // Re-attach settings button click to popup toggle (since they are created separately now)
    const settingsBtn = bottomMenu.querySelector('[data-role="settings-btn"]');
    if (settingsBtn) {
        settingsBtn.onclick = () => container.classList.toggle('releaf-settings-visible');
        setupTooltip(settingsBtn, "Settings");
    }

    // Close button logic
    const closeBtn = bottomMenu.querySelector('[data-role="close-btn"]');
    if (closeBtn) {
        setupTooltip(closeBtn, "Close Reader");
    }

    document.body.appendChild(container);
    document.body.style.overflow = "hidden";

    // 3. Initialize Logic
    initializeNavigation(container, content);
    initializeSettings(container, settingsPopup, updateSettingsUI);
    setupTutorial(container);

    // 4. Immersive Mode
    resetIdleTimer();
    document.addEventListener('mousemove', handleUserActivity);
    document.addEventListener('keydown', handleUserActivity);
    window.addEventListener('resize', handleResize);
}

// --- UI Helper Functions ---

function createReaderContainer() {
    const container = document.createElement("div");
    container.id = RELEAF_Container_ID;
    container.className = "releaf-theme-light"; // Default theme

    // Tap detection for navigation
    setupTapNavigation(container);

    return container;
}

function createContent(html) {
    const content = document.createElement("div");
    content.className = "releaf-content";
    content.innerHTML = html;
    return content;
}

function createBottomMenu(container, content) {
    const bottomMenu = document.createElement("div");
    bottomMenu.className = "releaf-bottom-menu";

    // Settings Button
    const settingsBtn = document.createElement("button");
    settingsBtn.className = "releaf-btn";
    settingsBtn.dataset.role = "settings-btn";
    settingsBtn.innerHTML = createIconSvg('settings');

    // Page Counter
    const pageCounter = createPageCounter(content);

    // Close Button
    const closeBtn = document.createElement("button");
    closeBtn.className = "releaf-btn";
    closeBtn.dataset.role = "close-btn";
    closeBtn.innerHTML = createIconSvg('close');
    closeBtn.onclick = toggleReleaf;

    bottomMenu.appendChild(settingsBtn);
    bottomMenu.appendChild(pageCounter);
    bottomMenu.appendChild(closeBtn);

    return bottomMenu;
}

function createSettingsPopup(container) {
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
            <span class="releaf-settings-label">${createIconSvg('text')} Text Size</span>
            <input type="range" class="releaf-slider" id="releaf-font-size" min="14" max="32" value="20">
        </div>
        <div class="releaf-settings-row">
            <span class="releaf-settings-label">${createIconSvg('spacing')} Line Spacing</span>
            <input type="range" class="releaf-slider" id="releaf-line-height" min="12" max="24" value="18">
        </div>
        <div class="releaf-settings-row">
            <span class="releaf-settings-label">${createIconSvg('margin-v')} Vertical Margin</span>
            <input type="range" class="releaf-slider" id="releaf-margin-v" min="40" max="120" value="80">
        </div>
        <div class="releaf-settings-row">
            <span class="releaf-settings-label">${createIconSvg('margin-h')} Horizontal Margin</span>
            <input type="range" class="releaf-slider" id="releaf-margin-h" min="20" max="80" value="40">
        </div>
        <div class="releaf-settings-row">
            <span class="releaf-settings-label">${createIconSvg('view')} Page View</span>
            <div class="releaf-page-view-btns">
                <button class="releaf-page-view-btn active" data-pages="1" title="Single Page View">${createIconSvg('page-1')}</button>
                <button class="releaf-page-view-btn" data-pages="2" title="Two Page View">${createIconSvg('page-2')}</button>
            </div>
        </div>
    `;

    // Close logic
    settingsPopup.querySelector('.releaf-settings-close').onclick = () => container.classList.remove('releaf-settings-visible');

    // Click outside to close
    container.addEventListener('click', (e) => {
        if (container.classList.contains('releaf-settings-visible')) {
            const settingsBtn = container.querySelector('[data-role="settings-btn"]');
            if (!settingsPopup.contains(e.target) && (!settingsBtn || !settingsBtn.contains(e.target))) {
                container.classList.remove('releaf-settings-visible');
            }
        }
    });

    // Helper to update UI elements from state
    const updateSettingsUI = (items) => {
        if (items.releaf_theme_id) {
            settingsPopup.querySelectorAll('.releaf-color-swatch').forEach(s => s.classList.remove('active'));
            const active = settingsPopup.querySelector(`.releaf-color-swatch[data-theme="${items.releaf_theme_id}"]`);
            if (active) active.classList.add('active');
        }
        if (items.releaf_fontSize) settingsPopup.querySelector('#releaf-font-size').value = items.releaf_fontSize;
        if (items.releaf_lineHeight) settingsPopup.querySelector('#releaf-line-height').value = items.releaf_lineHeight * 10;
        if (items.releaf_marginV) settingsPopup.querySelector('#releaf-margin-v').value = items.releaf_marginV;
        if (items.releaf_marginH) settingsPopup.querySelector('#releaf-margin-h').value = items.releaf_marginH;

        if (items.releaf_pageView) {
            settingsPopup.querySelectorAll('.releaf-page-view-btn').forEach(b => b.classList.remove('active'));
            const btn = settingsPopup.querySelector(`.releaf-page-view-btn[data-pages="${items.releaf_pageView}"]`);
            if (btn) btn.classList.add('active');
        }
    };

    return { settingsPopup, updateSettingsUI };
}

function createPageCounter(content) {
    const pageCounter = document.createElement("div");
    pageCounter.className = "releaf-page-counter";
    pageCounter.textContent = "1 / 1";

    const update = () => {
        const container = document.getElementById(RELEAF_Container_ID);
        if (!container) return; // Should not happen if called from within enableReleaf context

        // We use a simplified total pages calc here or reuse the strict logic?
        // Let's use the strict logic by re-querying dimensions
        const style = window.getComputedStyle(content);
        const pLeft = parseFloat(style.paddingLeft) || 0;
        const pRight = parseFloat(style.paddingRight) || 0;
        const gap = parseFloat(style.columnGap) || 0;
        const effWidth = Math.round(content.clientWidth - pLeft - pRight + gap);

        const totalPages = Math.max(1, Math.ceil((content.scrollWidth - 10) / effWidth));
        const currentVirtualScroll = getVirtualScroll(content);
        const currentPage = Math.min(totalPages, Math.max(1, Math.floor((currentVirtualScroll + 10) / effWidth) + 1));

        pageCounter.textContent = `${currentPage} / ${totalPages}`;
    };

    // Attach listener
    content.addEventListener('scroll', () => window.requestAnimationFrame(update));
    window.addEventListener('resize', () => {
        // Also triggers layout update
        const container = document.getElementById(RELEAF_Container_ID);
        if (container) updateLayout(content, container);
        update();
    });

    // Initial delay update
    setTimeout(update, 100);

    return pageCounter;
}

function initializeSettings(container, popup, updateUI) {
    const save = (key, val) => chrome.storage.sync.set({ [key]: val });

    // Load
    chrome.storage.sync.get([
        'releaf_bg', 'releaf_text', 'releaf_accent', 'releaf_theme_id',
        'releaf_fontSize', 'releaf_lineHeight',
        'releaf_marginV', 'releaf_marginH',
        'releaf_pageView'
    ], (items) => {
        // Apply to Container
        if (items.releaf_bg) container.style.setProperty('--releaf-bg-rgb', items.releaf_bg);
        if (items.releaf_text) container.style.setProperty('--releaf-text-rgb', items.releaf_text);
        if (items.releaf_accent) container.style.setProperty('--releaf-accent-rgb', items.releaf_accent);
        if (items.releaf_fontSize) container.style.setProperty('--releaf-font-size', `${items.releaf_fontSize}px`);
        if (items.releaf_lineHeight) container.style.setProperty('--releaf-line-height', items.releaf_lineHeight);
        if (items.releaf_marginV) container.style.setProperty('--releaf-margin-v', `${items.releaf_marginV}px`);
        if (items.releaf_marginH) container.style.setProperty('--releaf-margin-h', `${items.releaf_marginH}px`);
        if (items.releaf_pageView === '2') container.classList.add('releaf-2page');

        // Update UI
        updateUI(items);

        // Initial Layout Update after applying settings
        setTimeout(() => updateLayout(container.querySelector('.releaf-content'), container), 50);
    });

    // Wire up Inputs
    const themeColors = {
        light: { bg: '255, 255, 255', text: '34, 34, 34', accent: '234, 234, 234' },
        sepia: { bg: '252, 246, 229', text: '74, 60, 49', accent: '234, 221, 207' },
        mint: { bg: '232, 245, 233', text: '46, 80, 54', accent: '200, 230, 201' },
        forest: { bg: '21, 128, 61', text: '236, 253, 245', accent: '22, 101, 52' },
        gray: { bg: '107, 114, 128', text: '243, 244, 246', accent: '75, 85, 99' },
        dark: { bg: '26, 26, 26', text: '212, 212, 212', accent: '51, 51, 51' }
    };

    popup.querySelectorAll('.releaf-color-swatch').forEach(swatch => {
        swatch.onclick = () => {
            popup.querySelectorAll('.releaf-color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            const theme = swatch.dataset.theme;
            const colors = themeColors[theme];

            container.style.setProperty('--releaf-bg-rgb', colors.bg);
            container.style.setProperty('--releaf-text-rgb', colors.text);
            container.style.setProperty('--releaf-accent-rgb', colors.accent);

            save('releaf_bg', colors.bg);
            save('releaf_text', colors.text);
            save('releaf_accent', colors.accent);
            save('releaf_theme_id', theme);
        };
    });

    popup.querySelector('#releaf-font-size').oninput = (e) => {
        container.style.setProperty('--releaf-font-size', `${e.target.value}px`);
        save('releaf_fontSize', e.target.value);
    };

    popup.querySelector('#releaf-line-height').oninput = (e) => {
        const val = (e.target.value / 10).toFixed(1);
        container.style.setProperty('--releaf-line-height', val);
        save('releaf_lineHeight', val);
    };

    popup.querySelector('#releaf-margin-v').oninput = (e) => {
        container.style.setProperty('--releaf-margin-v', `${e.target.value}px`);
        save('releaf_marginV', e.target.value);
    };

    popup.querySelector('#releaf-margin-h').oninput = (e) => {
        container.style.setProperty('--releaf-margin-h', `${e.target.value}px`);
        save('releaf_marginH', e.target.value);
        updateLayout(container.querySelector('.releaf-content'), container);
    };

    popup.querySelectorAll('.releaf-page-view-btn').forEach(btn => {
        btn.onclick = () => {
            popup.querySelectorAll('.releaf-page-view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const pages = btn.dataset.pages;

            if (pages === '2') container.classList.add('releaf-2page');
            else container.classList.remove('releaf-2page');

            save('releaf_pageView', pages);
            updateLayout(container.querySelector('.releaf-content'), container);
        };
    });
}

function initializeNavigation(container, content) {
    // We reuse the global 'handleKeyNavigation' but we need to ensure it works.
    // The previous implementation added listener to 'document' for keydown.
    // That's done in enableReleaf.

    // Tap Navigation
    // setupTapNavigation is called in createReaderContainer
}

function setupTapNavigation(container) {
    let tapStartX, tapStartY, tapStartTime;
    container.addEventListener('mousedown', (e) => {
        tapStartX = e.clientX;
        tapStartY = e.clientY;
        tapStartTime = Date.now();
    });

    container.addEventListener('mouseup', (e) => {
        if (e.target.closest('.releaf-btn') || e.target.closest('.releaf-bottom-menu') || e.target.closest('.releaf-settings-popup')) return;

        const deltaX = Math.abs(e.clientX - tapStartX);
        const deltaY = Math.abs(e.clientY - tapStartY);
        if (deltaX < 10 && deltaY < 10 && (Date.now() - tapStartTime) < 300) {
            const width = window.innerWidth;
            const content = container.querySelector('.releaf-content');

            if (e.clientX < width * 0.2) navigatePage(content, -1);
            else if (e.clientX > width * 0.8) navigatePage(content, 1);
            else container.classList.toggle('releaf-menu-visible');
        }
    });
}

function navigatePage(content, direction) {
    // Better to use strict calc if possible, but window width is close enough for navigation targets
    const currentVirtual = getVirtualScroll(content);

    // Calculate precise page width using the layout helper logic if needed
    // For now, simple logic reused:
    const style = window.getComputedStyle(content);
    const pLeft = parseFloat(style.paddingLeft) || 0;
    const pRight = parseFloat(style.paddingRight) || 0;
    const gap = parseFloat(style.columnGap) || 0;
    const effWidth = Math.round(content.clientWidth - pLeft - pRight + gap);

    const targetPage = Math.floor((currentVirtual + (direction * 10)) / effWidth) + direction;
    // Bounds check
    const totalPages = Math.max(1, Math.ceil((content.scrollWidth - 10) / effWidth));

    if (targetPage < 0) setScrollPosition(content, 0);
    else if (targetPage >= totalPages) return; // Stop at end
    else setScrollPosition(content, targetPage * effWidth);
}

function setupTutorial(container) {
    chrome.storage.sync.get('releaf_hasSeenTutorial', (items) => {
        if (!items.releaf_hasSeenTutorial) {
            setTimeout(() => launchTutorial(container), 500);
        }
    });
}

function launchTutorial(container) {
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
            title: `Welcome to Re:Leaf! <img src="${chrome.runtime.getURL('src/assets/logo.png')}" class="releaf-tutorial-logo" alt="Leaf Logo"/>`,
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
            <button class="releaf-tutorial-close" title="Close">✕</button>
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
}

function updateLayout(content, container) {
    if (!content || !container) return;
    const hMarginRaw = container.style.getPropertyValue('--releaf-margin-h');
    const hMargin = parseInt(hMarginRaw) || 40;
    const availableWidth = window.innerWidth - (hMargin * 2);
    const gap = 60; // Fixed CSS gap
    const colWidth = (availableWidth - gap) / 2;
    container.style.setProperty('--releaf-column-width', `${colWidth}px`);
}

function createIconSvg(name) {
    const icons = {
        settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.39a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>',
        close: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
        text: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
        spacing: '<path d="M21 10H3"/><path d="M21 6H3"/><path d="M21 14H3"/><path d="M21 18H3"/>',
        'margin-v': '<path d="M12 3v18"/><path d="m8 7 4-4 4 4"/><path d="m8 17 4 4 4-4"/>',
        'margin-h': '<path d="M3 12h18"/><path d="m7 8-4 4 4 4"/><path d="m17 8 4 4-4 4"/>',
        view: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="15" y1="3" y2="3"/><line x1="9" x2="15" y1="21" y2="21"/>',
        'page-1': '<rect x="5" y="4" width="14" height="16" rx="2" />',
        'page-2': '<rect x="4" y="4" width="16" height="16" rx="2" /><line x1="12" y1="4" x2="12" y2="20" />'
    };
    return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`;
}

function showTooltip(target, text) {
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
}

function hideTooltip() {
    const tooltip = document.getElementById('releaf-tooltip');
    if (tooltip) tooltip.classList.remove('visible');
}

function setupTooltip(element, text) {
    element.dataset.tooltip = text;
    element.addEventListener('mouseenter', (e) => showTooltip(e.currentTarget, text));
    element.addEventListener('mouseleave', hideTooltip);
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

// Helper to manage scroll + visual overscroll
function setScrollPosition(content, targetScrollLeft) {
    content.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });

    // Wait for browser clamping (macro-tick)
    setTimeout(() => {
        const maxScroll = content.scrollWidth - content.clientWidth;

        // If target is beyond max scrollable area, apply transform
        if (targetScrollLeft > maxScroll + 2) { // 2px buffer
            const overscrollAmount = targetScrollLeft - maxScroll;
            content.style.transform = `translateX(-${overscrollAmount}px)`;
        } else {
            content.style.transform = 'translateX(0)';
        }
    }, 0);
}

// Helper to get virtual scroll position (scroll + transform)
function getVirtualScroll(content) {
    const currentScroll = content.scrollLeft;
    const transformMatch = content.style.transform.match(/translateX\(-?([\d.]+)px\)/);
    const visualOffset = transformMatch ? parseFloat(transformMatch[1]) : 0;
    return currentScroll + visualOffset;
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
        const currentVirtualScroll = getVirtualScroll(content);
        const pageIndex = Math.round(currentVirtualScroll / pageWidth);

        setScrollPosition(content, pageIndex * pageWidth);
    }, 100);
}

function handleKeyNavigation(e) {
    const content = document.querySelector('.releaf-content');
    if (!content) return;

    const pageWidth = window.innerWidth;

    if (e.key === 'ArrowRight') {
        const currentVirtualScroll = getVirtualScroll(content);
        const targetPage = Math.floor((currentVirtualScroll + 10) / pageWidth) + 1;

        // Calculate total pages to prevent overflow
        // Use logic similar to internal helper
        const totalPages = Math.max(1, Math.ceil((content.scrollWidth - 10) / pageWidth));

        if (targetPage >= totalPages) return;

        setScrollPosition(content, targetPage * pageWidth);
    } else if (e.key === 'ArrowLeft') {
        const currentVirtualScroll = getVirtualScroll(content);
        const targetPage = Math.max(0, Math.floor((currentVirtualScroll - 10) / pageWidth));
        setScrollPosition(content, targetPage * pageWidth);
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
    module.exports = {
        toggleReleaf,
        enableReleaf,
        extractContent,
        // Helpers for testing
        findMainContent,
        findBestBlockByDensity,
        removeHiddenElements,
        cleanupNodes,
        sanitizeAndFixContent,
        createReaderContainer,
        createContent,
        createBottomMenu,
        createSettingsPopup,
        createPageCounter,
        initializeSettings,
        initializeNavigation,
        setupTutorial,
        createIconSvg
    };
}
