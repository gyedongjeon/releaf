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
      <main>
        <h1>Title</h1>
        <p>Paragraph 1</p>
        <h2>Subtitle</h2>
        <p>Paragraph 2</p>
        <button>Click me</button> <!-- Should be ignored -->
      </main>
    `;

        enableReleaf();

        const container = document.getElementById('releaf-container');
        expect(container).not.toBeNull();

        const content = container.querySelector('.releaf-content');

        // Check that H1 and P are present in the output
        expect(content.innerHTML).toContain('<h1>Title</h1>');
        expect(content.innerHTML).toContain('<p>Paragraph 1</p>');
        expect(content.innerHTML).toContain('<h2>Subtitle</h2>');

        // Check that button is NOT present
        expect(content.innerHTML).not.toContain('<button>');

        // Check for UI controls
        const closeBtn = container.querySelector('.releaf-btn'); // Matches any button with this class
        expect(closeBtn).not.toBeNull();

        // Check for Navigation controls
        const navButtons = container.querySelectorAll('.releaf-nav .releaf-btn');
        expect(navButtons.length).toBe(2); // Prev(0) and Next(1)
        expect(navButtons[0].textContent).toContain('Prev');
        expect(navButtons[1].textContent).toContain('Next');

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
});
