const fs = require('fs');
const path = require('path');

const zettlrDir = '/Users/gleb/local-important/Zettlr';

function buildZettelMap(files) {
  const zettelMap = {};
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    let match =
      file.match(/^(.+)\s(20\d{14})\.md$/) ||
      file.match(/^(.+?)(20\d{14})\.md$/) ||
      file.match(/^(.+)\s\[\[(20\d{14})\]\]\.md$/);
    if (match) {
      const [_, title, id] = match;
      zettelMap[id] = title.trim();
    }
  }
  return zettelMap;
}

function replaceIdLinks(files, zettelMap) {
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const filePath = path.join(zettlrDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let missingLinks = [];

    let modified = content.replace(/\[\[(\d{14})\]\]/g, (match, id) => {
      let title = zettelMap[id];
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
        missingLinks.push(id);
        return match;
      }
      return `[[${title}]]`;
    });

    modified = modified.replace(/\[\[(.+?)(?:\s)?(20\d{14})\]\]/g, (match, title, id) => {
      if (zettelMap[id] && zettelMap[id] === title.trim()) {
        return `[[${title.trim()}]]`;
      }
      return match;
    });

    modified = modified.replace(/\[\[(\d{14})\]\]\s+([^\n\]]+)/g, (match, id, titleAfter) => {
      const title = zettelMap[id];
      if (title && title === titleAfter.trim()) {
        return `[[${title}]]`;
      }
      return match;
    });

    modified = modified.replace(/\[\[(.+?)(?:\s)?20\d{12,14}\]\]/g, (_, title) => {
      return `[[${title.trim()}]]`;
    });

    Object.values(zettelMap).forEach(title => {
      const dupRegex = new RegExp(`\\[\\[${title.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\]\\](\\s+)${title}(?=\\b)`, 'g');
      modified = modified.replace(dupRegex, `[[${title}]]`);
    });

    if (missingLinks.length > 0) {
      console.warn(`⚠️  Missing links in ${file}: ${missingLinks.join(', ')}`);
    }

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

// --- MAIN EXECUTION ---
const files = fs.readdirSync(zettlrDir);
const zettelMap = buildZettelMap(files);
replaceIdLinks(files, zettelMap);
chainJournalDiaryLinks(files);
renameFiles(files);