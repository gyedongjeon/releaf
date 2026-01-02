/**
 * Main orchestration logic for Re:Leaf.
 * Transforms the page into an ebook-like view.
 */

// If using Modules, imports would go here. 
// For sequential sequential injection, we rely on global scope.

// Constants
// Constants
var RELEAF_Container_ID = "releaf-container";

// Initialization Guard
if (window.hasRunReleaf) {
    // If already initialized, we don't need to re-run the setup logic.
    // The previously attached event listeners and functions are still active.
    // We just exit this script block to avoid re-declaring listeners.
} else {
    window.hasRunReleaf = true;

    // Globals for Timer
    var idleTimer;
    var resizeTimeout;

    // Listen for messages from background.js
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "toggleReleaf") {
            toggleReleaf();
        }
    });
}

var IDLE_TIMEOUT = 3000; // Move outside to be accessible or var.

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
 * Activates the Re:Leaf view.
 */
function enableReleaf() {
    // extractContent() is defined in utils.js
    const contentHtml = extractContent();

    if (!contentHtml) {
        alert("No content found to format.");
        return;
    }

    // 1. Create Core UI Elements (defined in ui.js)
    const container = createReaderContainer();
    const content = createContent(contentHtml);
    const bottomMenu = createBottomMenu(container, content);

    // 2. Assemble DOM
    container.appendChild(content);
    container.appendChild(bottomMenu);

    // Settings popup
    const { settingsPopup, updateSettingsUI } = createSettingsPopup(container);
    container.appendChild(settingsPopup);

    // Re-attach settings button click to popup toggle
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

    // 4. Video Restoration Logic
    // If user clicks on a video placeholder, we restore the original page.
    content.addEventListener('click', (e) => {
        const placeholder = e.target.closest('[data-action="restore"]');
        if (placeholder) {
            e.preventDefault();
            e.stopPropagation();
            toggleReleaf(); // Close Reader Mode
        }
    });

    // 4. Immersive Mode
    resetIdleTimer();
    document.addEventListener('mousemove', handleUserActivity);
    document.addEventListener('keydown', handleUserActivity);
    window.addEventListener('resize', handleResize);
}

// --- Logic Initialization ---

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
    // Tap Navigation setup is handled in createReaderContainer (ui.js / tap logic)
    // Here we might manage Keyboard if not handled globally? 
    // Keyboard listener is added to 'document' in enableReleaf -> handleUserActivity -> handleKeyNavigation
}

function setupTapNavigation(container) {
    let tapStartX, tapStartY, tapStartTime;
    container.addEventListener('mousedown', (e) => {
        tapStartX = e.clientX;
        tapStartY = e.clientY;
        tapStartTime = Date.now();
    });

    container.addEventListener('mouseup', (e) => {
        if (e.target.closest('.releaf-btn') ||
            e.target.closest('.releaf-bottom-menu') ||
            e.target.closest('.releaf-settings-popup') ||
            e.target.closest('[data-action]')) return;

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
    const currentVirtual = getVirtualScroll(content);

    // Calculate precise page width using the layout helper logic
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

function handleKeyNavigation(e) {
    const container = document.getElementById(RELEAF_Container_ID);
    if (!container) return;
    const content = container.querySelector('.releaf-content');
    if (!content) return;

    if (e.key === 'ArrowRight') {
        navigatePage(content, 1);
    } else if (e.key === 'ArrowLeft') {
        navigatePage(content, -1);
    } else if (e.key === 'Escape') {
        toggleReleaf();
    }
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
    card.style.position = 'relative';
    overlay.appendChild(card);
    container.appendChild(overlay);

    let currentStep = 0;
    const steps = [
        {
            title: `Welcome to Re:Leaf! <img src="${chrome.runtime.getURL('src/assets/logo.png')}" class="releaf-tutorial-logo" alt="Leaf Logo"/>`,
            text: "Tap <b>Left/Right</b> to turn pages.<br>Tap <b>Center</b> to show the menu.",
            action: () => {
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
        if (index > 0 && steps[index - 1].cleanup) steps[index - 1].cleanup();
        if (index > 0 && steps[index - 1].target) steps[index - 1].target.classList.remove('releaf-highlight');

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

        if (step.target) {
            step.target.classList.add('releaf-highlight');
            container.classList.remove('releaf-ui-hidden');
            container.classList.add('releaf-menu-visible');
        }

        if (step.action) step.action();

        card.querySelector('.releaf-tutorial-btn').onclick = () => {
            currentStep++;
            showStep(currentStep);
        };
        card.querySelector('.releaf-tutorial-close').onclick = () => closeTutorial(false);

        requestAnimationFrame(() => overlay.classList.add('visible'));
    };

    showStep(0);
}

function updateLayout(content, container) {
    if (!content || !container) return;
    const hMarginRaw = container.style.getPropertyValue('--releaf-margin-h');
    const hMargin = parseInt(hMarginRaw) || 40;
    const availableWidth = window.innerWidth - (hMargin * 2);
    const gap = 60;
    const colWidth = (availableWidth - gap) / 2;
    container.style.setProperty('--releaf-column-width', `${colWidth}px`);
}

function resetIdleTimer() {
    const container = document.getElementById(RELEAF_Container_ID);
    if (!container) return;

    container.classList.remove('releaf-ui-hidden');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        container.classList.add('releaf-ui-hidden');
    }, IDLE_TIMEOUT);
}

function handleUserActivity(e) {
    resetIdleTimer();
    if (e.type === 'keydown') {
        handleKeyNavigation(e);
    }
}

function setScrollPosition(content, targetScrollLeft) {
    content.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });

    setTimeout(() => {
        const maxScroll = content.scrollWidth - content.clientWidth;
        if (targetScrollLeft > maxScroll + 2) {
            const overscrollAmount = targetScrollLeft - maxScroll;
            content.style.transform = `translateX(-${overscrollAmount}px)`;
        } else {
            content.style.transform = 'translateX(0)';
        }
    }, 0);
}

function getVirtualScroll(content) {
    const currentScroll = content.scrollLeft;
    const transformMatch = content.style.transform.match(/translateX\(-?([\d.]+)px\)/);
    const visualOffset = transformMatch ? parseFloat(transformMatch[1]) : 0;
    return currentScroll + visualOffset;
}

function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const content = document.querySelector('.releaf-content');
        const container = document.getElementById(RELEAF_Container_ID);
        if (!content || !container) return;

        updateLayout(content, container);

        // Snap to the nearest page
        // Reuse strict layout calculation for accuracy or window width as fallback
        const style = window.getComputedStyle(content);
        const pLeft = parseFloat(style.paddingLeft) || 0;
        const pRight = parseFloat(style.paddingRight) || 0;
        const gap = parseFloat(style.columnGap) || 0;
        // Efficient width logic:
        const pageWidth = Math.round(content.clientWidth - pLeft - pRight + gap);

        const currentVirtualScroll = getVirtualScroll(content);
        const pageIndex = Math.round(currentVirtualScroll / pageWidth);

        setScrollPosition(content, pageIndex * pageWidth);
    }, 100);
}

// Export functions for testing
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        toggleReleaf,
        enableReleaf,
        initializeSettings,
        initializeNavigation,
        setupTutorial,
        updateLayout,
        resetIdleTimer,
        handleUserActivity,
        setScrollPosition,
        getVirtualScroll,
        handleResize,
        handleKeyNavigation,
        setupTapNavigation
    };
}
