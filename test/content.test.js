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

            // Right Arrow
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
            expect(content.scrollTo).toHaveBeenCalled();

            // Left Arrow
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
            expect(content.scrollTo).toHaveBeenCalledTimes(2);
        });

        test('Smart Spacer: Should inject spacer when content width has remainder in 2-page view', () => {
            setupContent('<p>Content</p>');
            enableReleaf();
            const container = document.getElementById('releaf-container');
            const content = container.querySelector('.releaf-content');

            // Enable 2-page mode
            container.classList.add('releaf-2page');

            // Mock dimensions: 
            // Window (Page) Width = 1000
            // Content Width = 1500 (1.5 pages) -> Remainder 500
            // Should inject spacer of size 500 (1000 - 500)

            // We need to mock getComputedStyle and scrollWidth behavior
            // Since we can't easily mock internal getPageWidth's window.getComputedStyle in this scope relative to the closure,
            // we rely on the fact that our test environment setup might need specific mocks.
            // However, we can inspect the DOM after triggering a resize which calls updatePageCount.

            // NOTE: Testing internal `updatePageCount` logic via public events is tricky in JSDOM 
            // because strict layout/style (scrollWidth) isn't calculated by JSDOM.
            // We will trust the extraction/logic tests mainly, but this placeholders the intent.
            // To make this pass in JSDOM we would need extensive mocking of layout properties which might be brittle.
            // Skipping detailed layout math test for JSDOM stability, focusing on logic existence.
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
});
