# Re:Leaf 🍃

**Re:Leaf** is a Chrome extension that transforms messy web articles into a beautiful, distraction-free ebook experience. It replaces infinite scrolling with paginated navigation, allowing you to focus on reading.

## Key Features

### 📖 Ebook-style Pagination
-   **No more scrolling**: Read content in distinct pages.
-   **View Modes**: Toggle between **Single Page** (centered) and **Two Page** (book spread) views.
-   **Intuitive Navigation**: Use arrow keys (`←`, `→`) or click the left/right edges of the screen to turn pages.

### 🎨 Customizable Themes
-   **Light**: Classic white paper look.
-   **Sepia**: Warm tones for easier reading.
-   **Dark**: High contrast dark mode for night reading.
-   **Forest / Mint**: Soothing green variants.
-   **Gray**: Neutral gray dark mode.

### 🛠️ Smart Settings
-   **Typography**: Adjust Font Size and Line Height.
-   **Layout**: Fine-tune Vertical and Horizontal Margins.
-   **Immersive Mode**: The UI automatically hides when you're reading to minimize distractions.

### 🧠 Robust Content Parsing
-   **Universal Support**: Works on major news sites (BBC, The Verge, Naver News) and general articles (Wikipedia, Medium).
-   **Clean Extraction**: Intelligently strips ads, sidebars, popups, and non-content media (like video placeholders) while preserving article structure and images.

---

## Installation

1.  Clone this repository:
    ```bash
    git clone https://github.com/gyedongjeon/releaf.git
    ```
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode** (toggle in the top right).
4.  Click **Load unpacked**.
5.  Select the `releaf` directory you just cloned.
6.  The 🍃 icon should appear in your toolbar.

## Usage

1.  Navigate to any article page.
2.  Click the **Re:Leaf extension icon**.
3.  The page will transform into the reader view.
4.  **Hover** over the bottom center to access the **Menu Bar**:
    -   **Settings**: Change themes, font size, margins, and page view.
    -   **Page Counter**: See your current progress.
    -   **Close**: Return to the original web page.

## Development

-   **Tech Stack**: Vanilla JavaScript, CSS variables for theming, SVG icons (Lucide style).
-   **Testing**: Run unit tests with Jest:
    ```bash
    npm test
    ```
-   **Linting/Verify**: Use the provided scripts in `scripts/` to verify parsing logic on real-world HTML.
