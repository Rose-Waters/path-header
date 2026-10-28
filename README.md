
# Path Header

**Know where your code lives.**

Path Header is a Visual Studio Code extension that adds file path comments to your source files, making it easier to identify where a file belongs in your project.

## Features

- **Automatic headers** — add a path comment when a new file is created.
- **Manual insertion** — add a header to an existing file using the Command Palette.
- **Rename and move support** — update recognized headers when files are renamed or moved.
- **Customizable paths** — choose between relative and absolute paths.
- **Custom prefixes** — personalize headers with text such as `File:`.
- **Language-aware comments** — use common comment formats for supported file types.
- **JSON safety** — skip strict JSON files to avoid invalid syntax.

## Examples

**TypeScript**

```typescript
// src/services/userService.ts
```

**Python**

```python
# src/app.py
```

**HTML**

```html
<!-- src/index.html -->
```

**CSS**

```css
/* src/styles.css */
```

## Usage

### Add a header manually

1. Open a file in VS Code.
2. Open the Command Palette with `Ctrl + Shift + P` (Windows/Linux) or `Cmd + Shift + P` (macOS).
3. Run **Path Header: Add File Path**.

### Add headers automatically

Create a new file using the VS Code Explorer. Path Header will attempt to insert the header automatically.

### Rename or move a file

When a file with a recognized path header is renamed or moved, Path Header attempts to update the comment to reflect its new location.

## Settings

Configure Path Header in VS Code under **Settings → Extensions → Path Header**, or search for `Path Header` in the Settings interface.

| Setting | Default | Description |
|---|---|---|
| `pathHeader.autoInsert` | `true` | Automatically add headers to newly created files. |
| `pathHeader.pathStyle` | `relative` | Choose `relative` or `absolute` file paths. |
| `pathHeader.prefix` | `""` | Add custom text before the file path, such as `File: `. |

For example, setting `pathHeader.prefix` to `File: ` produces:

```typescript
// File: src/services/userService.ts
```

## Supported Comment Styles

| File types | Format |
|---|---|
| TypeScript and JavaScript | `// path/to/file` |
| Python, Shell, Ruby and YAML | `# path/to/file` |
| CSS, SCSS and Less | `/* path/to/file */` |
| HTML, XML, SVG and Vue | `<!-- path/to/file -->` |
| JSONC | `// path/to/file` |
| Strict JSON | Skipped to preserve valid JSON |

## Known Limitations

- Existing files are not modified simply by opening them.
- Automatic insertion depends on how the file is created.
- Changing the configured prefix may affect recognition of older headers.
- Some file types may require additional comment-format support.

## Requirements

- Visual Studio Code

## Release Notes

### 0.0.1

Initial development release.

- Added manual path header insertion.
- Added automatic headers for newly created files.
- Added header updates for file renames and moves.
- Added basic Save As handling.
- Added configurable path styles, prefixes, and automatic insertion.

---

**Path Header — Know where your code lives.**
