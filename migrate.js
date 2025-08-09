const fs = require('fs');
const path = require('path');

const zettlrDir = '/Users/gleb/local-important/Zettlr';

function buildZettlrMap(files) {
  const zettlrMap = {};
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    let match =
      file.match(/^(.+)\s(20\d{14})\.md$/) ||
      file.match(/^(.+?)(20\d{14})\.md$/) ||
      file.match(/^(.+)\s\[\[(20\d{14})\]\]\.md$/);
    if (match) {
      const [_, title, id] = match;
      zettlrMap[id] = title.trim();
    }
  }
  return zettlrMap;
}

function replaceIdLinks(files, zettlrMap) {
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const filePath = path.join(zettlrDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let missingLinks = [];

    // Update links to .png files to point to relative assets/ for any .png filename
    content = content.replace(
      /(\!\[[^\]]*\]\()([^\s)]+\.png)(\))/gi,
      (match, prefix, filename, suffix) => {
        // Use relative path: assets/filename.png (no leading ./)
        if (filename.startsWith('assets/') || filename.startsWith('./assets/')) {
          // Normalize to assets/ (remove leading ./ if present)
          filename = filename.replace(/^\.\//, '');
          return `${prefix}${filename}${suffix}`;
        }
        return `${prefix}../assets/${filename}${suffix}`;
      }
    );

    // Step 1: Replace only [[ID]] with [[title]]
    let modified = content.replace(/\[\[(\d{14})\]\]/g, (match, id) => {
      let title = zettlrMap[id];
      if (!title) {
        const found = files.find(f =>
          f.endsWith('.md') &&
          (f.includes(id) || f.includes(`[[${id}]]`))
        );
        if (found) {
          title = found.replace(/\.md$/, '').replace(/\s*\[\[\d{14}\]\]$/, '').trim();
        }
      }
      if (!title) {
        // If no title found, keep the original link to avoid losing the link
        missingLinks.push(id);
        return match;
      }
      return `[[${title}]]`;
    });

    modified = modified.replace(/\[\[(.+?)(?:\s)?(20\d{14})\]\]/g, (match, title, id) => {
      if (zettlrMap[id] && zettlrMap[id] === title.trim()) {
        return `[[${title.trim()}]]`;
      }
      return match;
    });

    modified = modified.replace(/\[\[(\d{14})\]\]\s+([^\n\]]+)/g, (match, id, titleAfter) => {
      const title = zettlrMap[id];
      if (title && title === titleAfter.trim()) {
        return `[[${title}]]`;
      }
      return match;
    });

    modified = modified.replace(/\[\[(.+?)(?:\s)?20\d{12,14}\]\]/g, (_, title) => {
      return `[[${title.trim()}]]`;
    });

    // Step 2: Remove duplicate title after link (e.g., [[title]] title -> [[title]])
    // Remove duplicate even if followed by punctuation or end of line
    Object.values(zettlrMap).forEach(title => {
      const safeTitle = title.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      // Remove duplicate after [[title]] even if followed by punctuation or end of line
      const dupRegex = new RegExp(`\\[\\[${safeTitle}\\]\\](\\s+)${safeTitle}(?=[\\s.,;:!?\\-\\)\\]\\}]*|$)`, 'g');
      modified = modified.replace(dupRegex, `[[${title}]]`);
    });

    // Extra: Remove duplicate after [[title]] for any file that matches "title ID.md"
    Object.entries(zettlrMap).forEach(([id, title]) => {
      const safeTitle = title.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      // Remove duplicate after [[title]] even if followed by punctuation or end of line
      const regex = new RegExp(`\\[\\[${safeTitle}\\]\\](\\s+)${safeTitle}(?=[\\s.,;:!?\\-\\)\\]\\}]*|$)`, 'g');
      modified = modified.replace(regex, `[[${title}]]`);
    });

    // Extra: Remove duplicate after [[title]] for any file, even if not in zettelMap (for renamed files)
    // This is a fallback for cases where the title is not in zettelMap but the pattern still appears
    modified = modified.replace(/\[\[([^\]]+)\]\]\s+\1(?=[\s.,;:!?()\[\]{}-]*|$)/g, '[[$1]]');

    // Remove trailing duplicate after [[title]] if file with "title ID.md" exists
    Object.entries(zettlrMap).forEach(([id, title]) => {
      const fileWithId = files.find(f =>
        f.endsWith('.md') &&
        f.replace(/\.md$/, '') === `${title} ${id}`
      );
      if (fileWithId) {
        // Remove " [[title]] title" or " [[title]] title" (with possible punctuation after)
        const safeTitle = title.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\[\\[${safeTitle}\\]\\](\\s+)${safeTitle}(?=[^\\w]|$)`, 'g');
        modified = modified.replace(regex, `[[${title}]]`);
      }
    });

    if (missingLinks.length > 0) {
      // Warn, but do not remove or alter the original link
      console.warn(`⚠️  Missing links in ${file}: ${missingLinks.join(', ')}`);
    }

    // --- Insert YAML metadata at beginning ---
    // modified = insertYamlMetadata(file, modified);

    fs.writeFileSync(filePath, modified, 'utf8');
    console.log(`✅ Processed: ${file}`);
  }
}

function chainJournalDiaryLinks(files) {
  // Only match files containing "journal" or "diary" as a whole word (not "journaling", "diaries", etc.), and a 14-digit ID
  const journalFiles = files
    .filter(f =>
      f.endsWith('.md') &&
      (/\bjournal\b/i.test(f) || /\bdiary\b/i.test(f)) &&
      /(20\d{12,14})/.test(f)
    )
    .map(f => {
      const idMatch = f.match(/(20\d{12,14})/);
      return idMatch ? { file: f, id: idMatch[1] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));

  console.log(`🔗 Journal/diary files found for chaining: ${journalFiles.length}`);

  if (journalFiles.length === 0) {
    console.warn('⚠️  No journal/diary files found for chaining. Check your filename patterns.');
  }

  for (let i = 0; i < journalFiles.length; i++) {
    const { file } = journalFiles[i];
    const prev = journalFiles[i - 1];
    const next = journalFiles[i + 1];

    const filePath = path.join(zettlrDir, file);
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      console.error(`❌ Failed to read file: ${filePath}`, err);
      continue;
    }

    // Remove any existing chain links (optional, to avoid duplicates)
    content = content.replace(/^(\[\[.*?\]\] ← Previous\s*\|\s*Next → \[\[.*?\]\]\n)?/m, '');

    // Remove trailing 14-digit ID from link text for display
    function stripIdFromTitle(filename) {
      return filename
        .replace(/\.md$/, '')
        .replace(/\s*(20\d{12,14})$/, '')
        .replace(/\s*\[\[(20\d{12,14})\]\]$/, '')
        .trim();
    }

    const fileBase = stripIdFromTitle(file);
    const prevBase = prev ? stripIdFromTitle(prev.file) : null;
    const nextBase = next ? stripIdFromTitle(next.file) : null;

    let chainLine = '';
    if (prevBase && nextBase) {
      chainLine = `[[${prevBase}]] ← Previous | Next → [[${nextBase}]]\n`;
    } else if (prevBase) {
      chainLine = `[[${prevBase}]] ← Previous\n`;
    } else if (nextBase) {
      chainLine = `Next → [[${nextBase}]]\n`;
    }

    if (chainLine) {
      content = chainLine + content;
      try {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`🔗 Added chain links in: ${file}`);
      } catch (err) {
        console.error(`❌ Failed to write file: ${filePath}`, err);
      }
    }
  }
}

function renameFiles(files) {
  let renamedCount = 0;
  let renameMatched = 0;
  let renameSkipped = 0;
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const match = file.match(/^(.+?)(?:\s*\[\[|\s+)?(20\d{12,14})(?:\]\])?\.md$/);
    if (match) {
      renameMatched++;
      const [_, title] = match;
      const cleanTitle = title.trim();
      const oldPath = path.join(zettlrDir, file);
      const newPath = path.join(zettlrDir, `${cleanTitle}.md`);
      if (!fs.existsSync(newPath)) {
        fs.renameSync(oldPath, newPath);
        console.log(`📝 Renamed: ${file} → ${cleanTitle}.md`);
        renamedCount++;
      } else {
        console.warn(`⚠️  Cannot rename ${file} to ${cleanTitle}.md (target exists)`);
      }
    } else {
      renameSkipped++;
      // Uncomment the next line to see which files are skipped
      // console.log(`⏩ Skipped (no match): ${file}`);
    }
  }
  console.log(`🔄 Renaming complete. Files renamed: ${renamedCount}, matched: ${renameMatched}, skipped: ${renameSkipped}`);
}

function moveAssetsToFolder(dir) {
  const assetsDir = path.join(dir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir);
    console.log('📁 Created assets folder');
  }
  const files = fs.readdirSync(dir);
  let moved = 0;
  files.forEach(file => {
    // Move all .png files (any name/length)
    if (file.toLowerCase().endsWith('.png')) {
      const oldPath = path.join(dir, file);
      const newPath = path.join(assetsDir, file);
      fs.renameSync(oldPath, newPath);
      moved++;
      // console.log(`📦 Moved asset: ${file} → assets/${file}`);
    }
  });
  console.log(`✅ Moved ${moved} assets to assets folder.`);
}

function insertYamlMetadata(file, modified) {
  const idMatch = file.match(/(20\d{12,14})/);
    if (idMatch) {
      const id = idMatch[1];
      const dateStr = id.slice(0, 8); // YYYYMMDD
      const year = dateStr.slice(0, 4);
      const month = dateStr.slice(4, 6);
      const day = dateStr.slice(6, 8);
      const created = `${year}-${month}-${day}`;
      const yamlBlock = `---\ncreated: ${created}\n---\n`;
      // Insert YAML at the very beginning of the file
      return yamlBlock + modified;
    }
  return modified;
}

// --- MAIN EXECUTION ---
const files = fs.readdirSync(zettlrDir);
const zettelMap = buildZettlrMap(files);
replaceIdLinks(files, zettelMap);
chainJournalDiaryLinks(files);
renameFiles(files);
moveAssetsToFolder(zettlrDir);