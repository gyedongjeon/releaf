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
            get: jest.fn((keys, callback) => callback({})),
            set: jest.fn(),
        }
    }
};

// Mock window.alert
global.alert = jest.fn();

// Import all
const utils = require('../../src/content/utils');
const ui = require('../../src/content/ui');
const main = require('../../src/content/main');

// Expose all to global
Object.assign(global, utils, ui, main);

const {
    toggleReleaf,
    enableReleaf
} = global;

describe('Re:Leaf Main Logic', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.body.removeAttribute('style');
        document.body.className = '';
        window.hasRunReleaf = false;
        jest.clearAllMocks();

        // Mock offsetParent for removeHiddenElements called by extractContent in enableReleaf
        Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
            configurable: true,
            get() {
                if (this.style.display === 'none' || this.classList.contains('hidden')) return null;
                if (this.parentElement && (this.parentElement.style.display === 'none' || this.parentElement.classList.contains('hidden'))) return null;
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

    test('Should show alert if no content is found', () => {
        setupContent('');
        document.body.innerHTML = ''; // Force empty
        enableReleaf();
        expect(global.alert).toHaveBeenCalledWith("No content found to format.");
        expect(document.getElementById('releaf-container')).toBeFalsy();
    });

    describe('2. UI & Navigation', () => {
        test('Should toggle Re:Leaf view on/off', () => {
            setupContent('<p>Simple Content</p>');
            toggleReleaf();
            expect(document.getElementById('releaf-container')).not.toBeNull();
            expect(document.body.style.overflow).toBe('hidden');

            toggleReleaf();
            expect(document.getElementById('releaf-container')).toBeNull();
            expect(document.body.style.overflow).toBe('');
        });

        test('Should handle Keyboard Navigation (Left/Right Arrays)', () => {
            setupContent('<p>Long Content...</p>');
            enableReleaf();
            const container = document.getElementById('releaf-container');
            const content = container.querySelector('.releaf-content');
            content.scrollTo = jest.fn();

            Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
            Object.defineProperty(content, 'clientWidth', { value: 1000, configurable: true });
            Object.defineProperty(content, 'scrollWidth', { value: 2000, configurable: true });

            // Re-apply style transform manually as setup for getVirtualScroll
            content.style.transform = 'translateX(0)';

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
            expect(content.scrollTo).toHaveBeenCalled();

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
            content.scrollTo = jest.fn((options) => { content.scrollLeft = options.left; });

            // Mock clientWidth to avoid effWidth=0 -> NaN
            Object.defineProperty(content, 'clientWidth', { value: 1000, configurable: true });

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

            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('resize'));

            expect(content.scrollTo).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);
            expect(content.scrollTo).toHaveBeenCalledTimes(1);
            jest.useRealTimers();
        });

        test('Strict Column: Should calculate and set precise column width', () => {
            jest.useFakeTimers();
            setupContent('<p>Content</p>');
            enableReleaf();
            const container = document.getElementById('releaf-container');
            const content = container.querySelector('.releaf-content');
            content.scrollTo = jest.fn();

            Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });

            // Default marginH is 40. Gap is 60.
            // Expected Col Width: (1200 - (40*2) - 60) / 2 = 530
            const expectedWidth = 530;

            window.dispatchEvent(new Event('resize'));
            jest.advanceTimersByTime(100);

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

            Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
            Object.defineProperty(content, 'clientWidth', { value: 1000, configurable: true });
            Object.defineProperty(content, 'scrollWidth', { value: 1500, configurable: true });

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

            // Expected to scroll to 1000
            expect(content.scrollTo).toHaveBeenCalledWith({ left: 1000, behavior: 'smooth' });

            jest.runAllTimers(); // Run internal timeout inside setScrollPosition

            // MaxScroll = 500. Target = 1000. Overscroll = 500.
            expect(content.style.transform).toBe('translateX(-500px)');
            jest.useRealTimers();
        });

        test('Navigation Limit: Should not navigate past the last page', () => {
            jest.useFakeTimers();
            setupContent('<p>Content</p>');
            enableReleaf();
            const content = document.querySelector('.releaf-content');
            content.scrollTo = jest.fn();

            Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
            Object.defineProperty(content, 'clientWidth', { value: 1000, configurable: true });
            Object.defineProperty(content, 'scrollWidth', { value: 1500, configurable: true });

            content.scrollLeft = 1000;
            content.style.transform = 'translateX(0)';

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
            expect(content.scrollTo).not.toHaveBeenCalled();
            jest.useRealTimers();
        });
        test('Bug Repro: Should navigate to previous page correctly (not skip one)', () => {
            jest.useFakeTimers();
            setupContent('<p>Content</p>');
            enableReleaf();
            const content = document.querySelector('.releaf-content');
            content.scrollTo = jest.fn();

            Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
            Object.defineProperty(content, 'clientWidth', { value: 1000, configurable: true });
            Object.defineProperty(content, 'scrollWidth', { value: 3000, configurable: true });

            // Start at Page 2 (2000px)
            // Page 0: 0-1000
            // Page 1: 1000-2000
            // Page 2: 2000-3000
            content.scrollLeft = 2000;
            // Mock getVirtualScroll return via style transform (since getVirtualScroll parses it)
            // But wait, the test setup for getVirtualScroll parses style.transform.
            // We need to ensure logic uses scrollLeft if transform is 0.
            content.style.transform = 'translateX(0)';

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));

            // Expect to go to Page 1 (1000px)
            // Bug expectation: It goes to Page 0 (0px)
            expect(content.scrollTo).toHaveBeenCalledWith({ left: 1000, behavior: 'smooth' });
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

            expect(chrome.storage.sync.set).toHaveBeenCalledWith(expect.objectContaining({ releaf_theme_id: 'mint' }));
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
            chrome.storage.sync.get.mockImplementation((keys, cb) => cb({}));
            jest.useFakeTimers();

            setupContent('<p>Content</p>');
            enableReleaf();
            jest.advanceTimersByTime(500);

            const overlay = document.querySelector('.releaf-tutorial-overlay');
            expect(overlay).not.toBeNull();

            const nextBtn = overlay.querySelector('.releaf-tutorial-btn');
            nextBtn.click(); // 1 -> 2
            nextBtn.click(); // 2 -> 3

            const finishBtn = overlay.querySelector('.releaf-tutorial-btn');
            finishBtn.click(); // Finish

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
            jest.advanceTimersByTime(3000);
            expect(container.classList.contains('releaf-ui-hidden')).toBe(true);
            jest.useRealTimers();
        });

        test('Should show UI and reset timer on activity', () => {
            jest.useFakeTimers();
            setupContent('<p>Content</p>');
            enableReleaf();
            const container = document.getElementById('releaf-container');

            jest.advanceTimersByTime(3000);
            expect(container.classList.contains('releaf-ui-hidden')).toBe(true);

            document.dispatchEvent(new MouseEvent('mousemove'));
            expect(container.classList.contains('releaf-ui-hidden')).toBe(false);

            jest.advanceTimersByTime(3000);
            expect(container.classList.contains('releaf-ui-hidden')).toBe(true);
            jest.useRealTimers();
        });
    });
});
