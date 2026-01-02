/**
 * @jest-environment jsdom
 */

// Mock window.alert
global.alert = jest.fn();

const utils = require('../../src/content/utils');

// Expose functions to global scope
Object.assign(global, utils);

const {
    enableReleaf, // Not present in utils, but setupContent might rely on global state? No, extractContent is pure-ish.
    // Actually, extractContent is in utils.
    // The tests call enableReleaf() usually to trigger extraction. 
    // Wait, the original tests called `enableReleaf` which calls `extractContent` internally.
    // But `enableReleaf` is in MAIN.
    // If I want to test `extractContent` in isolation, I should call `extractContent()` directly 
    // OR mock `enableReleaf` to just do extraction?
    // In "1. Content Extraction", the tests call `enableReleaf()` and check `.releaf-content`.
    // That means they are Integration Tests relying on `enableReleaf`.

    // However, since we split the logic, `extractContent` is exported from `utils`.
    // We can test `extractContent()` directly!
    // But `extractContent` returns HTML string, it doesn't modify DOM to add .releaf-content (that's `createContent` + `main`).

    // The original tests:
    // enableReleaf();
    // const content = document.querySelector('.releaf-content');

    // To adapt to `utils.test.js`:
    // We should test `extractContent()` and expect the returned HTML string.
    // OR we can test `findMainContent`, `cleanupNodes` etc directly?
    // The "1. Content Extraction" tests describe high-level behavior.

    // Let's adapt them to call `extractContent()` and check the output string.
    // OR, since `extractContent` calls `findMainContent` etc, it's the main entry point for utils.

    // IMPORTANT: The original tests checked `document.querySelector('.releaf-content').innerHTML`.
    // `extractContent()` returns the innerHTML string of the cloned content.
    // So `const extracted = extractContent(); expect(extracted).toContain(...)` is equivalent.
} = global;

describe('Re:Leaf Utils (Content Extraction)', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();

        // Mock offsetParent for JSDOM logic in removeHiddenElements/findBestBlockByDensity
        Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
            configurable: true,
            get() {
                if (this.style.display === 'none' || this.classList.contains('hidden')) {
                    return null;
                }
                if (this.parentElement && (this.parentElement.style.display === 'none' || this.parentElement.classList.contains('hidden'))) {
                    return null;
                }
                return document.body;
            }
        });
    });

    const setupContent = (contentHtml) => {
        const filler = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(10);
        document.body.innerHTML = `
            <div id="wrapper">
                ${contentHtml}
                <p class="filler">${filler}</p>
            </div>
        `;
    };

    test('Should identify and extract content from Naver News ID (#dic_area)', () => {
        setupContent(`
            <div id="dic_area">
                <h3>Naver Headline</h3>
                <p>Naver news content body.</p>
            </div>
        `);
        const extracted = extractContent();
        expect(extracted).toContain('Naver Headline');
        expect(extracted).toContain('Naver news content body');
    });

    test('Should remove hidden duplicate content', () => {
        setupContent(`
            <div id="content">
                <p>Visible Content</p>
                <p style="display: none">Hidden Duplicate</p>
                <div class="hidden">
                    <p>Hidden Child</p>
                </div>
            </div>
        `);
        const extracted = extractContent();
        expect(extracted).toContain('Visible Content');
        expect(extracted).not.toContain('Hidden Duplicate');
        expect(extracted).not.toContain('Hidden Child');
    });

    test('Should extract content from generic wrapper (.content or [role="main"])', () => {
        setupContent(`
            <div class="content" role="main">
                <h3>Generic Report Title</h3>
                <p>This is a report body that lacks semantic tags like article or main.</p>
            </div>
        `);
        const extracted = extractContent();
        expect(extracted).toContain('Generic Report Title');
        expect(extracted).toContain('report body');
    });

    test('Should pick the first candidate that meets the length threshold', () => {
        const longText = "Long content ".repeat(50);
        const anotherLongText = "Another long content ".repeat(50);
        document.body.innerHTML = `
            <div id="short" class="newsct_article">Too short</div>
            <div id="long" class="article_txt">${longText}</div>
            <div id="another" class="main-content">${anotherLongText}</div>
        `;
        const extracted = extractContent();
        expect(extracted).toContain('Long content');
        expect(extracted).not.toContain('Another long content');
    });

    test('Should fall back to text density if no selectors match', () => {
        const mainText = "This is the very long main content of the article. ".repeat(20);
        const sidebarText = "Link Link Link Link";

        document.body.innerHTML = `
            <div>
                <div id="nav">
                    <a href="#">Menu</a> <a href="#">Home</a>
                </div>
                <div class="random-wrapper-123">
                    ${mainText}
                </div>
                <div class="sidebar">
                    <a href="#">${sidebarText}</a>
                </div>
            </div>
        `;

        const extracted = extractContent();
        expect(extracted).toContain('This is the very long main content');
    });

    test('Should fall back to body if no candidates meet the threshold', () => {
        const bodyText = "This is the fallback body content. " + "Filler ".repeat(50);
        document.body.innerHTML = `
            <div class="newsct_article">Too short</div>
            <p>${bodyText}</p>
        `;
        const extracted = extractContent();
        expect(extracted).toContain('This is the fallback body content');
        expect(extracted).toContain('Too short');
    });

    // NOTE: The alert test was originally here.
    // But `extractContent` does NOT alert. `enableReleaf` alerts if `extractContent` returns null.
    // So we should test that `extractContent` handles empty gracefully?
    // `extractContent` currently does `findMainContent` -> returns element.
    // `findMainContent` always returns something (body at least).
    // The alert logic is in `enableReleaf`.
    // So that test belongs in `main.test.js`.

    test('Should remove noisy elements (scripts, styles, inputs)', () => {
        setupContent(`
            <div id="content">
                <h1>Clean Title</h1>
                <script>console.log("bad");</script>
                <style>.bad { color: red; }</style>
                <input type="text" />
                <button>Click Me</button>
                <p>Clean Paragraph.</p>
            </div>
        `);
        const extracted = extractContent();
        expect(extracted).toContain('Clean Title');
        expect(extracted).toContain('Clean Paragraph');
        expect(extracted).not.toContain('<script');
        expect(extracted).not.toContain('<style');
        expect(extracted).not.toContain('<input');
        expect(extracted).not.toContain('<button');
    });

    test('Should remove specific news portal noise (Daum, Naver, Donga)', () => {
        setupContent(`
            <article>
                <p>Genuine content</p>
                <div class="layer_util">Utility Layer</div>
                <div class="box_recommend">Recommended Articles</div>
                <div class="art_copy">Copyright info</div>
                <div class="article_foot">Footer</div>
                <div class="article_reporter">Reporter Bio</div>
                <div class="poll_wrap">Poll</div>
            </article>
        `);
        const extracted = extractContent();
        expect(extracted).toContain('Genuine content');
        expect(extracted).not.toContain('Utility Layer');
        expect(extracted).not.toContain('Recommended Articles');
        expect(extracted).not.toContain('Copyright info');
        expect(extracted).not.toContain('Footer');
        expect(extracted).not.toContain('Reporter Bio');
        expect(extracted).not.toContain('Poll');
    });

    test('Should remove all attributes except the allowed whitelist', () => {
        setupContent(`
            <div id="main">
                <p data-unknown="value" aria-label="label" class="test" style="color:red">Text</p>
                <table>
                    <tr>
                        <td colspan="2" rowspan="2" class="cell">Cell</td>
                    </tr>
                </table>
            </div>
        `);
        // We need to parse the returned HTML string to check attributes easily, 
        // or just regex check.
        const extracted = extractContent();
        const div = document.createElement('div');
        div.innerHTML = extracted;

        const p = div.querySelector('p');
        expect(p.hasAttribute('data-unknown')).toBe(false);
        expect(p.hasAttribute('aria-label')).toBe(false);
        expect(p.hasAttribute('class')).toBe(false);
        expect(p.hasAttribute('style')).toBe(false);

        const td = div.querySelector('td');
        expect(td.getAttribute('colspan')).toBe("2");
        expect(td.getAttribute('rowspan')).toBe("2");
        expect(td.hasAttribute('class')).toBe(false);
    });

    test('Should remove unwanted metadata (tags, reporter info, related news)', () => {
        setupContent(`
            <article>
                <p>Main Article Text.</p>
                <div class="reporter_info">Reporter: Samuel</div>
                <div class="tags">#Tag1 #Tag2</div>
                <div class="related_news"><h3>Related News</h3><ul><li>Link</li></ul></div>
            </article>
        `);
        const extracted = extractContent();
        expect(extracted).toContain('Main Article Text');
        expect(extracted).not.toContain('Reporter: Samuel');
        expect(extracted).not.toContain('#Tag1');
        expect(extracted).not.toContain('Related News');
    });

    test('Should prepend document title if missing in extracted content (ZDNet Style)', () => {
        // ZDNet: Title is h1 outside, content is #articleBody
        const title = "ZDNet News Title";
        const bodyContent = "This is the actual news content. ".repeat(20); // > 200 chars to pass heuristic
        document.body.innerHTML = `
            <div class="header">
                <h1>${title}</h1>
            </div>
            <div class="wrapper">
                <div id="articleBody">
                    <p>${bodyContent}</p>
                </div>
            </div>
        `;

        const extracted = extractContent();

        // It should extract #articleBody (because it's in the list now)
        expect(extracted).toContain(bodyContent);

        // It should ALSO contain the title, because we appended it manually
        expect(extracted).toContain(title);

        // Check order: Title first
        const div = document.createElement('div');
        div.innerHTML = extracted;
        expect(div.firstElementChild.tagName).toBe('H1');
        expect(div.firstElementChild.textContent).toBe(title);
    });

    test('Should restore title if it was removed by cleanup (Wikipedia Style)', () => {
        // Wikipedia: H1 is often in a <header> or div that gets cleaned up.
        // Setup: Main content has H1 inside <header>, and body text.
        const title = "Wikipedia Article Title";
        const bodyText = "This is the encyclopedia content. ".repeat(20);

        document.body.innerHTML = `
            <main id="content">
                <header class="mw-body-header">
                    <h1>${title}</h1>
                </header>
                <div id="bodyContent">
                    <p>${bodyText}</p>
                </div>
            </main>
        `;

        // 1. extractContent finds 'main#content' (contains header + body)
        // 2. removeHiddenElements...
        // 3. cleanupNodes removes <header> (so H1 is GONE from clone)
        // 4. sanitizeAndFixContent...
        // 5. title fallback checks for H1. It's gone.
        // 6. It finds doc H1 and prepends it.

        const extracted = extractContent();

        const div = document.createElement('div');
        div.innerHTML = extracted;

        // H1 should be present (restored)
        expect(div.querySelector('h1')).not.toBeNull();
        expect(div.querySelector('h1').textContent).toBe(title);
        expect(extracted).toContain(bodyText);
    });

    test('Should extract missing summary and remove ads (NYT Style)', () => {
        const title = "NYT Article Title";
        const summary = "This is the article summary.";
        const bodyText = "This is the lengthy article content. ".repeat(20);

        document.body.innerHTML = `
             <div id="top-wrapper">
                 <div id="top-slug">Advertisement</div>
                 <a href="#">SKIP ADVERTISEMENT</a>
             </div>
             <main>
                 <h1>${title}</h1>
                 <p id="article-summary">${summary}</p>
                 <section name="articleBody">
                     <p>${bodyText}</p>
                 </section>
             </main>
         `;

        // 1. extractContent selects 'section[name="articleBody"]' (specifically added in utils)
        // 2. It misses #article-summary (outside)
        // 3. It misses H1 (outside)
        // 4. cleanupNodes should handle #top-wrapper? (Not in body content though)

        const extracted = extractContent();
        const div = document.createElement('div');
        div.innerHTML = extracted;

        // Verify Title restored
        const h1 = div.querySelector('h1');
        expect(h1).not.toBeNull();
        expect(h1.textContent).toBe(title);

        // Verify Summary restored
        const sumEl = div.querySelector('#article-summary');
        expect(sumEl).not.toBeNull();
        expect(sumEl.textContent).toBe(summary);

        // Verify Summary position (after H1)
        expect(h1.nextElementSibling).toBe(sumEl);

        // Verify Body content
        expect(extracted).toContain(bodyText);

        // Verify Ad Noise not present (it wasn't in body anyway, but good to check)
        expect(extracted).not.toContain('SKIP ADVERTISEMENT');
    });

    test('Should clean attributes but preserve href and src', () => {
        setupContent(`
            <div id="main">
                <p style="color: red" class="ugly" onclick="alert('hack')">Text</p>
                <a href="https://example.com" target="_blank" class="link">Link</a>
                <img src="img.jpg" width="100" height="100" />
            </div>
        `);
        const extracted = extractContent();
        // Should strip style, class, onclick
        expect(extracted).not.toContain('style="color: red"');
        expect(extracted).not.toContain('onclick');

        const div = document.createElement('div');
        div.innerHTML = extracted;

        const link = div.querySelector('a');
        expect(link.getAttribute('href')).toBe('https://example.com');
        expect(link.hasAttribute('style')).toBe(false);

        const img = div.querySelector('img');
        expect(img.getAttribute('src')).toBe('img.jpg');
    });

    test('Should fix lazy loaded images (data-src -> src)', () => {
        setupContent(`
            <div id="content">
                <img data-src="real-image.jpg" src="placeholder.gif" />
            </div>
        `);
        const extracted = extractContent();
        const div = document.createElement('div');
        div.innerHTML = extracted;
        const img = div.querySelector('img');
        expect(img.src).toContain('real-image.jpg');
    });

    test('createIconSvg should return SVG string', () => {
        const svg = createIconSvg('settings');
        expect(svg).toContain('<svg');
        expect(svg).toContain('width="22"');
    });
});
