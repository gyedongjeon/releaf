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

describe('Re:Leaf Messaging Logic', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        document.body.removeAttribute('style');
        document.body.className = '';
        window.hasRunReleaf = false;
        jest.clearAllMocks();
    });

    const setupContent = (contentHtml) => {
        // Add enough text density for extractContent to work
        const filler = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(10);
        document.body.innerHTML = `
            <div id="wrapper">
                ${contentHtml}
                <p class="filler">${filler}</p>
            </div>
        `;
    };

    test('Should register message listener and toggle on message', () => {
        setupContent('<p>Content</p>');

        // Re-load main.js in isolation to trigger the top-level initialization code again.
        jest.isolateModules(() => {
            // Ensure global state works for re-init
            window.hasRunReleaf = false;

            // We need to require main to trigger the listener
            // Note: main.js requires utils and ui, so standard require works if paths are correct relative to THIS file.
            // But main.js relies on global scope variables usually. 
            // In our main.test.js we Object.assign(global, ...). 
            // Here we should do minimal setup.

            // Mock dependencies usually in global if sequential
            // But main.js uses them from global scope? 
            // Let's check main.js source.
            // It calls `extractContent` (utils), `createReaderContainer` (ui), globals.

            // So we must expose them to global before requiring main.
            const utils = require('../../src/content/utils');
            const ui = require('../../src/content/ui');
            Object.assign(global, utils, ui);

            const main = require('../../src/content/main');
            Object.assign(global, main);

            // Now the listener should have been added
            expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
            const callback = chrome.runtime.onMessage.addListener.mock.calls[0][0];

            expect(callback).toBeDefined();

            // Invoke callback
            callback({ action: "toggleReleaf" });

            // Check result: toggleReleaf should have run and created the container
            expect(document.getElementById('releaf-container')).toBeTruthy();
        });
    });
});
