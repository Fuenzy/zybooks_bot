# zyBooks Activity Helper

A Tampermonkey userscript that adds a small control panel to zyBooks pages and automates several repetitive interactive activity actions.

What's different from other scripts like this one?
It detects if the answer is wrong and tries again until the answer is right!

The script can detect supported activities, run animation steps, enable faster playback, track completion progress, and interact with certain question/activity interfaces

## Features

### Animation automation

The helper can:

- Detect zyBooks animation activities
- Click the initial **Start** button
- Enable the available **2× speed** option
- Play each numbered animation step
- Wait for each step to finish before continuing
- Move through multiple animation activities on the same page

### Activity detection

The script continuously scans the page for newly loaded activities.

This is useful because zyBooks often loads page elements dynamically without performing a full browser refresh.

The script uses:

- A regular timed page scan
- A `MutationObserver` to detect page changes
- Internal tracking to avoid repeatedly processing completed activities

### Control panel

A floating panel appears in the bottom-right corner of the zyBooks page.

It displays:

- Current activity status
- Additional operation details
- Animation completion count
- Question completion count
- Short-answer completion count
- Matching activity completion count

The panel also includes:

- **Run all** — manually starts another complete page scan
- **Pause** — safely stops current automation
- **Resume** — enables automation again

### Render webpage support

When a coding activity contains a **Render webpage** button, the helper can automatically click it so the webpage preview is loaded.

### Multiple-choice interface testing

The script contains experimental logic for detecting multiple-choice questions and checking the result displayed by the webpage.

This functionality should only be used with:

- Your own locally created test pages
- Practice material where automation is explicitly permitted
- UI development and debugging

### Short-answer interface testing

The helper contains experimental support for:

- Finding short-answer inputs
- Detecting answer-reveal controls
- Entering text into React-controlled inputs
- Clicking the question’s check button
- Reading the displayed result

Do not use this feature to bypass graded coursework.

### Drag-and-drop activity testing

The script includes synthetic mouse, drag, pointer, and keyboard events for testing matching interfaces.

It can:

- Detect draggable terms
- Detect available matching buckets
- Move terms using simulated drag events
- Fall back to keyboard interaction when dragging fails
- Detect accepted or rejected placements
- Track completed matching activities

Compatibility may vary because drag-and-drop behavior can change when zyBooks updates its interface.

## Requirements

Before installing the script, you need:

- Google Chrome, Microsoft Edge, Firefox, or another userscript-compatible browser
- The Tampermonkey browser extension
- Access to `https://learn.zybooks.com/`

## Installing Tampermonkey

### Google Chrome or Microsoft Edge

1. Open your browser’s extension store.
2. Search for **Tampermonkey**.
3. Select the official Tampermonkey extension.
4. Click **Add to Chrome** or **Get**.
5. Approve the requested extension permissions.
6. Pin Tampermonkey to your browser toolbar for easier access.

### Firefox

1. Open the Firefox Add-ons website.
2. Search for **Tampermonkey**.
3. Select the official extension.
4. Click **Add to Firefox**.
5. Approve the requested permissions.

## Installing the userscript

1. Install Tampermonkey.
2. Click the Tampermonkey icon in your browser toolbar.
3. Select **Create a new script**.
4. Delete the example code in the editor.
5. Copy the complete userscript from this repository.
6. Paste it into the Tampermonkey editor.
7. Press `Ctrl + S` to save it.

The script should now appear in the Tampermonkey dashboard as:

```text
zyBooks Helper
```

## Using the helper

1. Sign in to zyBooks.
2. Open a zyBooks chapter or activity page.
3. Wait for the page to finish loading.
4. Look for the **Local Activity Tester** panel in the bottom-right corner.
5. The helper will automatically scan the page.
6. Select **Run all** to manually start another scan.
7. Select **Pause** whenever you want automation to stop.
8. Select **Resume** to continue.

The status panel will update while activities are being detected and processed.

## Updating the script

To install a newer version manually:

1. Open the Tampermonkey dashboard.
2. Select the installed script.
3. Replace the existing code with the updated version.
4. Press `Ctrl + S`.
5. Refresh the open zyBooks page.

## Configuration

Timing and safety limits are stored near the top of the script inside the `CONFIG` object.

```javascript
const CONFIG = {
    initialDelay: 1000,
    scanInterval: 900,
    clickDelay: 350,
    answerDelay: 450,
    dragDelay: 450
};
```

### Common settings

| Setting | Purpose |
|---|---|
| `initialDelay` | Delay before the first page scan |
| `scanInterval` | Time between automatic scans |
| `clickDelay` | Delay after clicking controls |
| `answerDelay` | Delay after interacting with an answer input |
| `dragDelay` | Delay after a drag-and-drop operation |
| `controlsTimeout` | Maximum wait for animation controls |
| `stepTimeout` | Maximum wait for an animation step |
| `maxAnimationSteps` | Safety limit for animation steps |
| `maxMatchingPasses` | Safety limit for matching attempts |

Values are measured in milliseconds.

For example:

```javascript
scanInterval: 1500
```

This scans the page every 1.5 seconds.

Avoid setting delays extremely low. Browser interfaces often require time to update after clicks, input events, and drag operations.

## How it works

The script runs inside an immediately invoked function expression:

```javascript
(() => {
    // Script logic
})();
```

This keeps most variables and functions out of the website’s global scope.

### DOM queries

The helper finds activities using selectors such as:

```javascript
document.querySelectorAll(".interactive-activity-container");
```

### Async timing

Browser operations are coordinated using promises and `async`/`await`:

```javascript
function sleep(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}
```

### Completion tracking

The helper uses `WeakSet` objects to remember page elements it has already processed:

```javascript
const finishedAnimations = new WeakSet();
```

Because these collections store references to DOM elements, removed elements can still be garbage-collected by the browser.

### Dynamic-page monitoring

zyBooks updates parts of its interface dynamically. The helper watches those changes using a `MutationObserver`:

```javascript
const pageObserver = new MutationObserver(() => {
    scanPage();
});
```

This allows newly displayed activities to be detected without refreshing the full page.

## Console logs

The script writes debugging information to the browser console using the prefix:

```text
[Local Activity Tester]
```

To view the console:

1. Press `F12`.
2. Open the **Console** tab.
3. Search for `Local Activity Tester`.

Console messages can help identify unsupported activities, timeouts, disabled buttons, or interface changes.

## Troubleshooting

### The panel does not appear

Check that:

- Tampermonkey is enabled
- The userscript is enabled
- The page URL begins with `https://learn.zybooks.com/`
- The page has been refreshed since installing the script

Also verify that the metadata contains:

```javascript
// @match        https://learn.zybooks.com/*
```

### The script says no activities were found

The current page may not contain a supported activity type.

Try:

- Expanding the activity
- Scrolling until it loads
- Clicking **Run all**
- Refreshing the page

### An animation stops

The animation controls may have changed or the activity may have exceeded a timeout.

Try increasing:

```javascript
stepTimeout: 60000
```

For example:

```javascript
stepTimeout: 90000
```

### Drag-and-drop does not work

Synthetic drag-and-drop behavior varies between browsers and website versions.

Try:

- Using Chrome or Edge
- Keeping the activity visible on screen
- Avoiding interaction with the page while the helper is moving an item
- Refreshing the page
- Increasing `dragDelay`

### The helper repeats an activity

Some zyBooks activities replace their DOM elements after an update. Since completion tracking is attached to the previous element, the replacement may be treated as a new activity.

### The page behaves strangely

Pause the helper using the panel.

You can also disable the script completely:

1. Click the Tampermonkey icon.
2. Find the script.
3. Toggle it off.
4. Refresh the page.

## Direct installation from GitHub

After uploading the `.user.js` file:

1. Open the file on GitHub.
2. Click **Raw**.
3. Tampermonkey should detect the userscript.
4. Review the metadata and source code.
5. Click **Install**.

## Privacy

The script:

- Runs directly inside the browser
- Does not intentionally send data to an external server
- Uses no special Tampermonkey API permissions
- Declares `@grant none`

Users should still review the complete source before installing any userscript.

## Compatibility

The script was designed around the zyBooks interface structure available when it was written.

It may stop working when:

- Class names change
- Activity layouts are redesigned
- Controls are moved into an iframe
- Event handling is changed
- New activity types are introduced

This project is not affiliated with, maintained by, or endorsed by zyBooks.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This software is provided as-is, without warranty.

The author is not responsible for account restrictions, lost progress, academic consequences, website errors, or other issues caused by using or modifying the script.
