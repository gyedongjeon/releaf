/**
 * @jest-environment jsdom
 */

// Mock chrome object
global.chrome = {
    runtime: {
        onMessage: {
            addListener: jest.fn(),
        },
        getURL: jest.fn((path) => `chrome-extension://test-id/${path}`),
    },
    storage: {
        sync: {
            get: jest.fn((keys, callback) => callback({})), // Default empty
            set: jest.fn(),
        }
    }
};

// Mock window.alert
global.alert = jest.fn();

const { toggleReleaf, enableReleaf } = require('../src/content');

describe('Re:Leaf Content Script', () => {
    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        document.body.removeAttribute('style');
        document.body.className = '';
        window.hasRunReleaf = false; // Reset the flag
        jest.clearAllMocks();

        // Mock offsetParent for JSDOM
        // JSDOM defaults offsetParent to null (or unavailable), which causes our "remove hidden" logic to delete everything.
        // We mock it: if 'hidden' class or style display:none is present, return null. Otherwise return a dummy object.
        Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
            configurable: true,
            get() {
                // Simple heuristic for test: if display: none, return null. 
                // Note: window.getComputedStyle is expensive/complex in JSDOM if not fully supported, 
                // but simpler checks work for our manual setup.
                // We'll check inline style and a special class for testing.
                if (this.style.display === 'none' || this.classList.contains('hidden')) {
                    return null;
                }
                // Also check parent (recursive) - simulated simple bubble up
                if (this.parentElement && (this.parentElement.style.display === 'none' || this.parentElement.classList.contains('hidden'))) {
                    return null;
                }
                return document.body; // Return something truthy
            }
        });
    });

    // Helper to setup DOM with realistic content
    const setupContent = (contentHtml) => {
        // Wrap in a div to simulate body structure, ensure length > 200 for heuristic
        const filler = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(10);
        document.body.innerHTML = `
            <div id="wrapper">
                ${contentHtml}
                <p class="filler">${filler}</p>
            </div>
        `;
    };

    describe('1. Content Extraction', () => {
        test('Should identify and extract content from Naver News ID (#dic_area)', () => {
            setupContent(`
                <div id="dic_area">
                    <h3>Naver Headline</h3>
                    <p>Naver news content body.</p>
                </div>
            `);
            enableReleaf();
            const content = document.querySelector('.releaf-content');
            expect(content.innerHTML).toContain('Naver Headline');
            expect(content.innerHTML).toContain('Naver news content body');
        });

        test('Should remove hidden duplicate content (e.g. mobile/desktop versions)', () => {
            setupContent(`
                <div id="content">
                    <p>Visible Content</p>
                    <p style="display: none">Hidden Duplicate</p>
                    <div class="hidden">
                        <p>Hidden Child</p>
                    </div>
                </div>
            `);
            enableReleaf();
            const content = document.querySelector('.releaf-content');
            expect(content.textContent).toContain('Visible Content');
            expect(content.textContent).not.toContain('Hidden Duplicate');
            expect(content.textContent).not.toContain('Hidden Child');
        });

        test('Should extract content from generic wrapper (.content or [role="main"])', () => {
            setupContent(`
                <div class="content" role="main">
                    <h3>Generic Report Title</h3>
                    <p>This is a report body that lacks semantic tags like article or main.</p>
                </div>
            `);
            enableReleaf();
            const content = document.querySelector('.releaf-content');
            expect(content.innerHTML).toContain('Generic Report Title');
            expect(content.innerHTML).toContain('report body');
        });

        test('Should pick the first candidate that meets the length threshold', () => {
            const longText = "Long content ".repeat(50);
            const anotherLongText = "Another long content ".repeat(50);
            document.body.innerHTML = `
                <div id="short" class="newsct_article">Too short</div>
                <div id="long" class="article_txt">${longText}</div>
                <div id="another" class="main-content">${anotherLongText}</div>
            `;
            enableReleaf();
            const content = document.querySelector('.releaf-content');
            expect(content.textContent).toContain('Long content');
            expect(content.textContent).not.toContain('Another long content');
        });

        test('Should fall back to text density if no selectors match', () => {
            // A page with NO specific class names, but one main block of text
            // and a noisy sidebar with links.
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

            enableReleaf();
            const content = document.querySelector('.releaf-content');
            expect(content.textContent).toContain('This is the very long main content');
        });

        test('Should fall back to body if no candidates meet the threshold', () => {
            const bodyText = "This is the fallback body content. " + "Filler ".repeat(50);
            document.body.innerHTML = `
                <div class="newsct_article">Too short</div>
                <p>${bodyText}</p>
            `;
            enableReleaf();
            const content = document.querySelector('.releaf-content');
            // Since it falls back to body, it should contain everything in body (except what was removed by cleanup)
            expect(content.textContent).toContain('This is the fallback body content');
            expect(content.textContent).toContain('Too short');
        });

        test('Should show alert if no content is found', () => {
            document.body.innerHTML = '';
            enableReleaf();
            expect(global.alert).toHaveBeenCalledWith("No content found to format.");
            expect(document.getElementById('releaf-container')).toBeFalsy();
        });

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
            enableReleaf();
            const content = document.querySelector('.releaf-content');
            expect(content.innerHTML).toContain('Clean Title');
            expect(content.innerHTML).toContain('Clean Paragraph');
            expect(content.innerHTML).not.toContain('<script');
            expect(content.innerHTML).not.toContain('<style');
            expect(content.innerHTML).not.toContain('<input');
            expect(content.innerHTML).not.toContain('<button');
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
            enableReleaf();
            const content = document.querySelector('.releaf-content');
            expect(content.textContent).toContain('Genuine content');
            expect(content.textContent).not.toContain('Utility Layer');
            expect(content.textContent).not.toContain('Recommended Articles');
            expect(content.textContent).not.toContain('Copyright info');
            expect(content.textContent).not.toContain('Footer');
            expect(content.textContent).not.toContain('Reporter Bio');
            expect(content.textContent).not.toContain('Poll');
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
            enableReleaf();
            const content = document.querySelector('.releaf-content');
            const p = content.querySelector('p');
            expect(p.hasAttribute('data-unknown')).toBe(false);
            expect(p.hasAttribute('aria-label')).toBe(false);
            expect(p.hasAttribute('class')).toBe(false);
            expect(p.hasAttribute('style')).toBe(false);

            const td = content.querySelector('td');
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
            enableReleaf();
            const content = document.querySelector('.releaf-content');
            expect(content.innerHTML).toContain('Main Article Text');
            expect(content.innerHTML).not.toContain('Reporter: Samuel');
            expect(content.innerHTML).not.toContain('#Tag1');
            expect(content.innerHTML).not.toContain('Related News');
        });

        test('Should clean attributes but preserve href and src', () => {
            setupContent(`
                <div id="main">
                    <p style="color: red" class="ugly" onclick="alert('hack')">Text</p>
                    <a href="https://example.com" target="_blank" class="link">Link</a>
                    <img src="img.jpg" width="100" height="100" />
                </div>
            `);
            enableReleaf();
            const content = document.querySelector('.releaf-content');

            // Should strip style, class, onclick
            expect(content.innerHTML).not.toContain('style="color: red"');
            expect(content.innerHTML).not.toContain('onclick');
            // JSDOM might serialize distinct attributes differently, checking presence
            const link = content.querySelector('a');
            expect(link.getAttribute('href')).toBe('https://example.com');
            expect(link.hasAttribute('style')).toBe(false);

            const img = content.querySelector('img');
            expect(img.getAttribute('src')).toBe('img.jpg');
        });

        test('Should fix lazy loaded images (data-src -> src)', () => {
            setupContent(`
                <div id="content">
                    <img data-src="real-image.jpg" src="placeholder.gif" />
                </div>
            `);
            enableReleaf();
            const img = document.querySelector('.releaf-content img');
            expect(img.src).toContain('real-image.jpg');
        });
    });

    describe('2. UI & Navigation', () => {
        test('Should toggle Re:Leaf view on/off', () => {
            setupContent('<p>Simple Content</p>');

            // ON
            toggleReleaf();
            expect(document.getElementById('releaf-container')).not.toBeNull();
            expect(document.body.style.overflow).toBe('hidden');

            // OFF
            toggleReleaf();
            expect(document.getElementById('releaf-container')).toBeNull();
            expect(document.body.style.overflow).toBe('');
        });

        test('Should handle Keyboard Navigation (Left/Right Arrays)', () => {
            setupContent('<p>Long Content...</p>');
            enableReleaf();
            const container = document.getElementById('releaf-container');
            const content = container.querySelector('.releaf-content');

            // Mock navigation
            content.scrollTo = jest.fn();

            // Mock Dimensions to ensure 2 pages
            Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
            Object.defineProperty(content, 'clientWidth', { value: 1000, configurable: true });
            Object.defineProperty(content, 'scrollWidth', { value: 2000, configurable: true });
            content.style.transform = 'translateX(0)';

            // Right Arrow
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
            expect(content.scrollTo).toHaveBeenCalled();

            // Left Arrow
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
            expect(content.scrollTo).toHaveBeenCalledTimes(2);
        });

        test('Should toggle off Re:Leaf on Escape key', () => {
            setupContent('<h1>Hello World</h1>');
            enableReleaf();
            expect(document.getElementById('releaf-container')).toBeTruthy();

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            expect(document.getElementById('releaf-container')).toBeFalsy();
        });

        test('Should stay at page 0 when ArrowLeft is pressed at the beginning', () => {
            setupContent('<p>Content</p>');
            enableReleaf();
            const content = document.querySelector('.releaf-content');
            content.scrollLeft = 0;
            content.scrollTo = jest.fn((options) => {
                content.scrollLeft = options.left;
            });

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
            expect(content.scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' });
            expect(content.scrollLeft).toBe(0);
        });

        test('Should debounce resize events and snap to nearest page', () => {
            jest.useFakeTimers();
            setupContent('<p>Content</p>');
            enableReleaf();
            const content = document.querySelector('.releaf-content');
            content.scrollTo = jest.fn();

            // Trigger multiple resize events
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('resize'));

            expect(content.scrollTo).not.toHaveBeenCalled();

            // Fast-forward
            jest.advanceTimersByTime(100);

            expect(content.scrollTo).toHaveBeenCalledTimes(1);
            jest.useRealTimers();
        });

        test('Strict Column: Should calculate and set precise column width', () => {
            jest.useFakeTimers();
            setupContent('<p>Content</p>');
            enableReleaf();
            const container = document.getElementById('releaf-container');

            // Mock scrollTo since JSDOM doesn't implement it
            const content = container.querySelector('.releaf-content');
            content.scrollTo = jest.fn();

            // Set specific window width
            Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });

            // Default marginH is 40. Gap is 60.
            // Expected Col Width: (1200 - (40*2) - 60) / 2 = (1120 - 60) / 2 = 530
            const expectedWidth = 530;

            // Trigger resize to run updateLayout
            window.dispatchEvent(new Event('resize'));

            // Wait for debounce
            jest.advanceTimersByTime(100);

            // Check CSS variable
            const colWidth = container.style.getPropertyValue('--releaf-column-width');
            expect(colWidth).toBe(`${expectedWidth}px`);

            jest.useRealTimers();
        });

        test('Virtual Overscroll: Should apply transform when scrolling past max content', () => {
            jest.useFakeTimers();
            setupContent('<p>Content</p>');
            enableReleaf();
            const container = document.getElementById('releaf-container');
            const content = container.querySelector('.releaf-content');
            content.scrollTo = jest.fn();

            // Mock Dimensions
            // Viewport: 1000
            // Content: 1500 (Max Scroll = 500)
            Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
            Object.defineProperty(content, 'clientWidth', { value: 1000, configurable: true });
            Object.defineProperty(content, 'scrollWidth', { value: 1500, configurable: true });

            // Trigger ArrowRight twice. 
            // 1st: Scroll to 1000 (valid, maxScroll=500? wait. maxScroll = 1500 - 1000 = 500).
            // So target 1000 is > 500. Should overscroll.

            // We need to trigger the global listener or the internal logic.
            // Since we are monitoring side effects, global Keydown is easiest.
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

            // Initial call is to scrollTo(1000)
            expect(content.scrollTo).toHaveBeenCalledWith({ left: 1000, behavior: 'smooth' });

            // Wait for setTimeout in setScrollPosition
            jest.runAllTimers();

            // Check Transform
            // Target: 1000. Max: 500. Overscroll: 500.
            expect(content.style.transform).toBe('translateX(-500px)');

            jest.useRealTimers();
        });

        test('Navigation Limit: Should not navigate past the last page', () => {
            jest.useFakeTimers();
            setupContent('<p>Content</p>');
            enableReleaf();
            const container = document.getElementById('releaf-container');
            const content = container.querySelector('.releaf-content');
            content.scrollTo = jest.fn();

            // Mock Dimensions: 2 Pages total
            // Viewport: 1000
            // Content: 1500
            Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
            Object.defineProperty(content, 'clientWidth', { value: 1000, configurable: true });
            Object.defineProperty(content, 'scrollWidth', { value: 1500, configurable: true });

            // Set initial position to Page 2 (index 1, scrollLeft 1000)
            content.scrollLeft = 1000;
            // Also need to spoof getVirtualScroll since it reads transform
            // Assuming no transform initially or just 0
            content.style.transform = 'translateX(0)';

            // Trigger ArrowRight (Next Page)
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

            // Should NOT try to scroll to 2000
            expect(content.scrollTo).not.toHaveBeenCalled();
            // Or if it did, it should be to 1000 (re-snap) but logic says return.

            jest.useRealTimers();
        });
    });

    describe('3. Settings & Storage', () => {
        test('Should save and apply Theme changes', () => {
            setupContent('<p>Content</p>');
            enableReleaf();
            const container = document.getElementById('releaf-container');
            const mintBtn = container.querySelector('.releaf-swatch-mint');

            mintBtn.click();

            expect(chrome.storage.sync.set).toHaveBeenCalledWith(expect.objectContaining({
                releaf_theme_id: 'mint'
            }));
            // Verify CSS variable update (JSDOM style)
            expect(container.style.getPropertyValue('--releaf-bg-rgb')).toBe('232, 245, 233');
        });

        test('Should save and apply Font Size changes', () => {
            setupContent('<p>Content</p>');
            enableReleaf();
            const container = document.getElementById('releaf-container');
            const slider = container.querySelector('#releaf-font-size');

            slider.value = 28;
            slider.dispatchEvent(new Event('input'));

            expect(chrome.storage.sync.set).toHaveBeenCalledWith({ releaf_fontSize: "28" });
            expect(container.style.getPropertyValue('--releaf-font-size')).toBe('28px');
        });

        test('Should save and apply Margins', () => {
            setupContent('<p>Content</p>');
            enableReleaf();
            const container = document.getElementById('releaf-container');
            const slider = container.querySelector('#releaf-margin-v');

            slider.value = 100;
            slider.dispatchEvent(new Event('input'));

            expect(chrome.storage.sync.set).toHaveBeenCalledWith({ releaf_marginV: "100" });
            expect(container.style.getPropertyValue('--releaf-margin-v')).toBe('100px');
        });
    });

    describe('4. Tutorial Flow', () => {
        test('Should show tutorial on first run and handle completion', () => {
            // Mock first run
            chrome.storage.sync.get.mockImplementation((keys, cb) => cb({}));
            jest.useFakeTimers();

            setupContent('<p>Content</p>');
            enableReleaf();
            jest.advanceTimersByTime(500); // Wait for tutorial delay

            const overlay = document.querySelector('.releaf-tutorial-overlay');
            expect(overlay).not.toBeNull();
            expect(overlay.innerHTML).toContain('Welcome to Re:Leaf');

            // Click Next
            const nextBtn = overlay.querySelector('.releaf-tutorial-btn');
            nextBtn.click();
            expect(overlay.innerHTML).toContain('Customization');

            // Click Next again
            nextBtn.click();
            expect(overlay.innerHTML).toContain('Finished Reading?');

            // Click Finish
            const finishBtn = overlay.querySelector('.releaf-tutorial-btn'); // Now says "All Done!"
            finishBtn.click();

            // Should save complete state
            expect(chrome.storage.sync.set).toHaveBeenCalledWith({ releaf_hasSeenTutorial: true });

            jest.useRealTimers();
        });
    });

    describe('5. Immersive Mode', () => {
        test('Should hide UI after idle timeout', () => {
            jest.useFakeTimers();
            setupContent('<p>Content</p>');
            enableReleaf();
            const container = document.getElementById('releaf-container');

            expect(container.classList.contains('releaf-ui-hidden')).toBe(false);

            // Fast-forward 3 seconds (IDLE_TIMEOUT is 3000)
            jest.advanceTimersByTime(3000);

            expect(container.classList.contains('releaf-ui-hidden')).toBe(true);
            jest.useRealTimers();
        });

        test('Should show UI and reset timer on activity', () => {
            jest.useFakeTimers();
            setupContent('<p>Content</p>');
            enableReleaf();
            const container = document.getElementById('releaf-container');

            // Hide it first
            jest.advanceTimersByTime(3000);
            expect(container.classList.contains('releaf-ui-hidden')).toBe(true);

            // Trigger mousemove activity
            document.dispatchEvent(new MouseEvent('mousemove'));

            expect(container.classList.contains('releaf-ui-hidden')).toBe(false);

            // Should hide again after another 3 seconds
            jest.advanceTimersByTime(3000);
            expect(container.classList.contains('releaf-ui-hidden')).toBe(true);
            jest.useRealTimers();
        });
    });
});
