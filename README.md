# Standard Notes Extension API

This is an easier-to-use API to write Standard Notes extensions.

## Getting started

The easiest way to start creating Standard Notes extensions is to use the template repo: https://github.com/nienow/sn-extension-template

Otherwise, install the npm module:

```
npm install sn-extension-api
```

## Importing theme

Import the base theme variables in your root CSS or SASS file:

```css
@import 'sn-extension-api/dist/sn.min.css';
```

Then make sure you use the standard notes theme variables when styling your extension.

## Basic API usage

```javascript
import snApi from "sn-extension-api";

// only call this once - it will establish communication with standard notes
snApi.initialize();

// get notified when note is received from standard notes
snApi.subscribe(() => {
  // set current text into text area for editing
  document.getElementById('my-text-area').value = snApi.text;
});

document.getElementById('my-text-area').addEventListener('input', (e) => {
  // update text on change - automatically saves to standard notes
  snApi.text = e.target.value;
});
```

## Full API documentation

### Initialize

This needs to be called before doing anything else. Do not call more than once.

```javascript
snApi.initialize({
  debounceSave: 300 // the number of ms to debounce the save for performance reasons (defaults to 250ms)
});
```

### Note Text

```javascript
// get text
console.log(snApi.text);
// update text
snApi.text = 'new text';
```

The note text must be a string. So if the extension uses json, it must be converted back and forth from a string:

```javascript
// get text
console.log(JSON.parse(snApi.text));
// update text
snApi.text = JSON.stringify({cell1: 'some content', cell2: 2});
```

### Preview Text

By default, the note preview will be generated using the first 50 characters of the text. If you want to use a custom preview, you can set the preview directly after setting the text:

```javascript
snApi.text = JSON.stringify({...});
snApi.preview = 'my note preview';
```

### Note Metadata

You can store metadata separately from the note text. This data can be any object (it does not need to be a string like the text).

```javascript
// get metadata
console.log(snApi.meta);

// set metadata
snApi.meta = {lastCursorPosition: 123, selectedLines: [1, 3]};
```

### Extension Metadata

This data is stored per extension (not per note). It can be any object.

```javascript
// get extension metadata
console.log(snApi.extensionMeta);

// set extension metadata
snApi.extensionMeta = {spacingPreference: 'comfortable'};
```

### Environment

Check which environment the extension is being used in. There are 3 different environments: browser, desktop app, mobile app.

```javascript
console.log(
  snApi.isRunningInBrowser,
  snApi.isRunningInDesktopApplication,
  snApi.isRunningInMobileApplication
);
```

### Locked

When the "Prevent editing" is toggled for a note, the *locked* property will be true.

```javascript
console.log(
  snApi.locked
);
```
