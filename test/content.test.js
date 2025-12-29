/**
 * @jest-environment jsdom
 */

// Mock chrome object
global.chrome = {
    runtime: {
        onMessage: {
            addListener: jest.fn(),
        },
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

const { toggleReleaf, enableReleaf, extractContent } = require('../src/content');

describe('Re:Leaf Content Script', () => {
    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        document.body.style.overflow = '';
        window.hasRunReleaf = false; // Reset the flag
    });

    test('enableReleaf creates the container and extracts content preserving structure', () => {
        // Setup initial DOM with structured content
        document.body.innerHTML = `
      <div id="content">
        <h1>Title</h1>
        <p>Paragraph 1</p>
        <div id="sidebar">
            <a href="#">Sidebar Link</a>
            <ul><li>Language 1</li><li>Language 2</li></ul>
        </div>
        <h2>Subtitle</h2>
        <p>Paragraph 2</p>
        <div class="language-list">English, Spanish</div>
        <button>Click me</button> <!-- Should be ignored -->
      </div>
    `;

        enableReleaf();

        const container = document.getElementById('releaf-container');
        expect(container).not.toBeNull();

        const content = container.querySelector('.releaf-content');

        // Check that H1 and P are present in the output
        expect(content.innerHTML).toContain('<h1>Title</h1>');
        expect(content.innerHTML).toContain('<p>Paragraph 1</p>');
        expect(content.innerHTML).toContain('<h2>Subtitle</h2>');

        // Check that sidebar/language content is NOT present
        expect(content.innerHTML).not.toContain('Sidebar Link');
        expect(content.innerHTML).not.toContain('Language 1');
        expect(content.innerHTML).not.toContain('English, Spanish');

        // Check that button is NOT present
        expect(content.innerHTML).not.toContain('<button>');

        // Check for UI controls
        const closeBtn = container.querySelector('.releaf-btn'); // Matches any button with this class
        expect(closeBtn).not.toBeNull();

        // Use dataset.tooltip matcher effectively - bottom menu now only has Settings and Close
        const buttonTooltips = Array.from(container.querySelectorAll('.releaf-btn')).map(b => b.dataset.tooltip);
        expect(buttonTooltips).toContain('Settings');
        expect(buttonTooltips).toContain('Close Reader');

        // Check for Settings Popup
        const settingsPopup = container.querySelector('.releaf-settings-popup');
        expect(settingsPopup).not.toBeNull();

        // Mock scrollTo for navigation tests
        content.scrollTo = jest.fn();

        // Mock window.innerWidth for zone detection
        Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });

        // Helper to simulate a tap on container at specific x position
        const simulateTap = (x) => {
            const mousedown = new MouseEvent('mousedown', { clientX: x, clientY: 50, bubbles: true });
            const mouseup = new MouseEvent('mouseup', { clientX: x, clientY: 50, bubbles: true });
            container.dispatchEvent(mousedown);
            container.dispatchEvent(mouseup);
        };

        // Simulate left zone tap (x < 20% = 200px)
        simulateTap(100);
        expect(content.scrollTo).toHaveBeenCalled();

        // Simulate right zone tap (x > 80% = 800px)
        simulateTap(900);
        expect(content.scrollTo).toHaveBeenCalled();

        expect(document.body.style.overflow).toBe('hidden');
    });

    test('toggleReleaf removes the container if it exists', () => {
        // Manually create the container
        const container = document.createElement('div');
        container.id = 'releaf-container';
        document.body.appendChild(container);
        document.body.style.overflow = 'hidden';

        toggleReleaf();

        expect(document.getElementById('releaf-container')).toBeNull();
        expect(document.body.style.overflow).toBe('');
    });

    test('toggleReleaf calls enableReleaf if container does not exist', () => {
        document.body.innerHTML = '<p>Test content</p>';

        toggleReleaf();

        expect(document.getElementById('releaf-container')).not.toBeNull();
    });

    test('Settings are saved to storage when changed', () => {
        document.body.innerHTML = '<p>Content</p>'; // Ensure content exists
        enableReleaf();
        const container = document.getElementById('releaf-container');
        const settingsBtn = container.querySelector('.releaf-btn[data-tooltip="Settings"]');

        // Open settings (to select elements easily if needed, though mostly just ensures logic ran)
        settingsBtn.click();

        // Simulate changing font size slider
        const fontSizeSlider = container.querySelector('#releaf-font-size');
        fontSizeSlider.value = 24;
        fontSizeSlider.dispatchEvent(new Event('input'));

        expect(chrome.storage.sync.set).toHaveBeenCalledWith({ releaf_fontSize: "24" });

        // Simulate theme change
        const mintSwatch = container.querySelector('.releaf-swatch-mint');
        mintSwatch.click();

        expect(chrome.storage.sync.set).toHaveBeenCalledWith(expect.objectContaining({
            releaf_theme_id: 'mint'
        }));
    });

    test('Tutorial launches on first run', () => {
        // Mock storage to return no settings (simulate first run)
        chrome.storage.sync.get.mockImplementation((keys, callback) => callback({})); // Empty object
        document.body.innerHTML = '<p>Content</p>';

        jest.useFakeTimers();
        enableReleaf();

        // Fast-forward for tutorial delay
        jest.advanceTimersByTime(500);

        const overlay = document.querySelector('.releaf-tutorial-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay.innerHTML).toContain('Welcome to Re:Leaf');

        jest.useRealTimers();
    });
});

test('Immersive mode hides UI after inactivity', () => {
    jest.useFakeTimers();
    document.body.innerHTML = '<p>Test content for immersive mode</p>';
    enableReleaf();
    const container = document.getElementById('releaf-container');

    // Initially visible
    expect(container.classList.contains('releaf-ui-hidden')).toBe(false);

    // Fast-forward time
    jest.advanceTimersByTime(3000);

    // Should be hidden
    expect(container.classList.contains('releaf-ui-hidden')).toBe(true);

    // Simulate activity (mousemove)
    document.dispatchEvent(new Event('mousemove'));

    // Should be visible again
    expect(container.classList.contains('releaf-ui-hidden')).toBe(false);

    jest.useRealTimers();
});

