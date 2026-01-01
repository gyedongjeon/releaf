/**
 * Utility functions for Re:Leaf content extraction and basic helpers.
 */

// --- Content Extraction Utilities ---

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
        '#sub_content_view', // Added explicit selector from previous code if any, matching standard list
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

// --- Generic Helper Functions ---

/**
 * Returns an SVG string for a given icon name.
 * @param {string} name 
 * @returns {string} SVG HTML string
 */
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


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        findMainContent,
        findBestBlockByDensity,
        removeHiddenElements,
        cleanupNodes,
        sanitizeAndFixContent,
        extractContent,
        createIconSvg
    };
}
