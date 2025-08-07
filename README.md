# Zettlr to Obsidian Migration

A Node.js script to migrate your Zettlr markdown notes to Obsidian, with special handling for Zettelkasten IDs, journal/diary chaining, and filename/link normalization.

## Features

- **ID → Title Link Conversion:**  
  Converts all `[[ID]]` and `[[title ID]]` style links to `[[title]]` links, including edge cases.
- **Filename Normalization:**  
  Renames files to remove Zettelkasten IDs and trailing spaces.
- **Journal/Diary Chain Links:**  
  Automatically adds previous/next navigation links between journal/diary files, sorted by Zettelkasten ID, allowing to chain journals and diaries into single non-interrupted chain. Order of chaining based on date of file creation represented as ID in filename.
- **Robust Regex Handling:**  
  Handles various filename and link patterns, including those with or without spaces, brackets, or special characters.

## Use Cases

- Migrating a Zettlr vault to Obsidian, preserving all note links.
- Cleaning up filenames and links for better compatibility with Obsidian.
- Creating a navigable chain of journal/diary entries.
- Handling edge cases like links with IDs, titles, or special symbols.

## Requirements

- Node.js (v14 or newer recommended)
- Your Zettlr notes in a local directory

## Installation

Clone this repository:

```sh
git clone https://github.com/yourusername/migrate-zettlr-to-obsidian.git
cd migrate-zettlr-to-obsidian
```

Install dependencies (if any; currently, only Node.js built-in modules are used):

```sh
npm install
```

## Usage

1. **Edit the script:**  
   Open `migrate.js` and set the `zettlrDir` variable to the path of your Zettlr notes directory.

2. **Run the migration:**

   ```sh
   node migrate.js
   ```

3. **What happens:**
   - All `.md` files in the directory are processed.
   - Links like `[[20201119092503]]`, `[[title 20201119092503]]`, `[[title20201119092503]]`, and `[[ID]] title` are converted to `[[title]]`.
   - Files are renamed to remove Zettelkasten IDs.
   - Journal/diary files (with "journal" or "diary" as a whole word in the filename) are chained with previous/next links at the top of each file.

## Example

**Before:**
- `journal 2020 September 20200914220000.md`
- `personal health 20201119092503.md`
- Links like `[[20201119092503]]` or `[[personal health 20201119092503]]`

**After:**
- `journal 2020 September.md` (with navigation links at the top)
- `personal health.md`
- Links like `[[personal health]]`

## Customization

- Adjust the `zettlrDir` variable in `migrate.js` to point to your notes directory.
- The script is modular: you can comment out or modify steps as needed.

## Contributing

Pull requests are welcome! Please open an issue or discussion for major changes.

## License

MIT License

## Disclaimer

- Always **backup your notes** before running the script.
- This script modifies files in place.
- Test on a copy of your notes if unsure.

---
