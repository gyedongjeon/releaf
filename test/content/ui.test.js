/**
 * @jest-environment jsdom
 */

// Mock window.alert
global.alert = jest.fn();

const utils = require('../../src/content/utils');
const ui = require('../../src/content/ui');

// Expose functions to global scope
Object.assign(global, utils, ui);

const {
    createReaderContainer,
    createContent,
    createBottomMenu,
    createSettingsPopup,
    createPageCounter
} = global;

describe('Re:Leaf UI Components', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    test('createReaderContainer should return a div with correct ID and default theme', () => {
        // Warning: createReaderContainer() calls setupTapNavigation()!
        // setupTapNavigation is in MAIN.
        // If we don't include main, it will crash.
        // OR we can mock setupTapNavigation?
        // ui.js logic calls setupTapNavigation(container) inside createReaderContainer.

        // Option 1: Include main.js (Circular heavy)
        // Option 2: Mock setupTapNavigation on global.

        // Let's mock it since we are testing UI creation here, not nav logic.
        global.setupTapNavigation = jest.fn();

        const container = createReaderContainer();
        expect(container.tagName).toBe('DIV');
        expect(container.id).toBe('releaf-container');
        expect(container.className).toBe('releaf-theme-light');

        expect(global.setupTapNavigation).toHaveBeenCalledWith(container);
    });

    test('createContent should return a div with content and correct class', () => {
        const html = '<p>Test Content</p>';
        const content = createContent(html);
        expect(content.tagName).toBe('DIV');
        expect(content.className).toBe('releaf-content');
        expect(content.innerHTML).toBe(html);
    });

    test('createBottomMenu should create menu with all controls', () => {
        // createBottomMenu binds onclick = () => toggleReleaf().
        // So global.toggleReleaf should be defined or we shouldn't click it.
        // It also calls createPageCounter.

        const container = document.createElement('div');
        container.id = 'releaf-container';
        document.body.appendChild(container);

        const content = document.createElement('div');

        // We need getVirtualScroll for createPageCounter (if it runs immediately).
        // createPageCounter calls `update` after 100ms.
        // So immediate return is safe.

        const menu = createBottomMenu(container, content);

        expect(menu.className).toBe('releaf-bottom-menu');
        expect(menu.querySelector('[data-role="settings-btn"]')).toBeTruthy();
        expect(menu.querySelector('.releaf-page-counter')).toBeTruthy();
        expect(menu.querySelector('[data-role="close-btn"]')).toBeTruthy();

        document.body.removeChild(container);
    });

    test('createSettingsPopup should create popup structure', () => {
        const container = document.createElement('div');
        const { settingsPopup, updateSettingsUI } = createSettingsPopup(container);

        expect(settingsPopup.className).toBe('releaf-settings-popup');
        expect(settingsPopup.querySelector('.releaf-settings-header')).toBeTruthy();
        expect(settingsPopup.querySelectorAll('.releaf-color-swatch').length).toBeGreaterThan(0);
        expect(settingsPopup.querySelector('#releaf-font-size')).toBeTruthy();
        expect(typeof updateSettingsUI).toBe('function');
    });

    // createPageCounter test requires getVirtualScroll + updateLayout from main.js if resize happens.
    // It mocks timers.
    test('createPageCounter should create counter and handle updates', () => {
        jest.useFakeTimers();

        // Mock dependencies from MAIN if used
        global.getVirtualScroll = jest.fn(() => 0);
        global.updateLayout = jest.fn();

        const content = document.createElement('div');
        Object.defineProperty(content, 'clientWidth', { value: 500 });
        Object.defineProperty(content, 'scrollWidth', { value: 1000 });

        const container = document.createElement('div');
        container.id = 'releaf-container';
        document.body.appendChild(container);

        const counter = createPageCounter(content);
        expect(counter.className).toBe('releaf-page-counter');
        expect(counter.textContent).toBe('1 / 1');

        jest.advanceTimersByTime(200);

        content.dispatchEvent(new Event('scroll'));
        jest.runAllTimers();

        expect(counter).toBeTruthy();
        expect(global.getVirtualScroll).toHaveBeenCalled(); // Should be called during update

        document.body.removeChild(container);
        jest.useRealTimers();
    });
});
