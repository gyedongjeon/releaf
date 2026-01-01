/**
 * UI generation functions for Re:Leaf.
 */

// Note: RELEAF_Container_ID is expected to be defined in main.js or globally if strictly sequential, 
// but for cleaner modules we can just use the string literal or rely on shared scope if not using modules.
// Since we are doing sequential injection, we ideally want these to be functions that take dependencies or define constants.
// For simplicity in this non-module setup, we will use the string literal "releaf-container".
var RELEAF_Container_ID_UI = "releaf-container";

/**
 * Creates the main container for the reader view.
 * @returns {HTMLDivElement}
 */
function createReaderContainer() {
    const container = document.createElement("div");
    container.id = RELEAF_Container_ID_UI;
    container.className = "releaf-theme-light"; // Default theme

    // Tap detection for navigation
    setupTapNavigation(container);

    return container;
}

/**
 * Creates the content wrapper.
 * @param {string} html 
 * @returns {HTMLDivElement}
 */
function createContent(html) {
    const content = document.createElement("div");
    content.className = "releaf-content";
    content.innerHTML = html;
    return content;
}

/**
 * Creates the bottom menu bar.
 * @param {HTMLElement} container 
 * @param {HTMLElement} content 
 * @returns {HTMLDivElement}
 */
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
    // toggleReleaf is in main.js. 
    // In sequential loading, this might be undefined if bound immediately? 
    // No, it's bound on click, so as long as toggleReleaf is defined by the time user clicks, it's fine.
    closeBtn.onclick = () => toggleReleaf();

    bottomMenu.appendChild(settingsBtn);
    bottomMenu.appendChild(pageCounter);
    bottomMenu.appendChild(closeBtn);

    return bottomMenu;
}

/**
 * Creates the settings popup and returns it along with an update helper.
 * @param {HTMLElement} container 
 * @returns {{settingsPopup: HTMLDivElement, updateSettingsUI: Function}}
 */
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

/**
 * Creates the page counter element.
 * @param {HTMLElement} content 
 * @returns {HTMLDivElement}
 */
function createPageCounter(content) {
    const pageCounter = document.createElement("div");
    pageCounter.className = "releaf-page-counter";
    pageCounter.textContent = "1 / 1";

    const update = () => {
        const container = document.getElementById(RELEAF_Container_ID_UI);
        if (!container) return;

        // Let's use the strict logic by re-querying dimensions
        const style = window.getComputedStyle(content);
        const pLeft = parseFloat(style.paddingLeft) || 0;
        const pRight = parseFloat(style.paddingRight) || 0;
        const gap = parseFloat(style.columnGap) || 0;
        const effWidth = Math.round(content.clientWidth - pLeft - pRight + gap);

        const totalPages = Math.max(1, Math.ceil((content.scrollWidth - 10) / effWidth));
        const currentVirtualScroll = getVirtualScroll(content); // Defined in main.js (hoisting issue? See note)
        const currentPage = Math.min(totalPages, Math.max(1, Math.floor((currentVirtualScroll + 10) / effWidth) + 1));

        pageCounter.textContent = `${currentPage} / ${totalPages}`;
    };

    // Attach listener
    content.addEventListener('scroll', () => window.requestAnimationFrame(update));
    window.addEventListener('resize', () => {
        const container = document.getElementById(RELEAF_Container_ID_UI);
        if (container) updateLayout(content, container); // Defined in main.js
        update();
    });

    // Initial delay update
    setTimeout(update, 100);

    return pageCounter;
}


// --- Tooltips ---

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


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createReaderContainer,
        createContent,
        createBottomMenu,
        createSettingsPopup,
        createPageCounter,
        showTooltip,
        hideTooltip,
        setupTooltip
    };
}
