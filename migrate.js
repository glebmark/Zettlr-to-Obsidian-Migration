const fs = require('fs');
const path = require('path');

// Step 1: Build ID → Title map
const zettlrDir = '/Users/gleb/local-important/Zettlr';
const files = fs.readdirSync(zettlrDir);
const zettelMap = {};

for (const file of files) {
  if (file.endsWith('.md')) {
    const match = file.match(/^(.+)\s(20\d{12})\.md$/);
    if (match) {
      const [_, title, id] = match;
      zettelMap[id] = title;
    }
  }
}

// Step 2: Go over all .md files and replace [[ID]] with [[Title]]
for (const file of files) {
  if (!file.endsWith('.md')) continue;

  const filePath = path.join(zettlrDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  let missingLinks = [];
  // Step 1: Replace only [[ID]] with [[title]]
  let modified = content.replace(/\[\[(\d{14})\]\]/g, (match, id) => {
    const title = zettelMap[id];
    if (!title) {
      missingLinks.push(id);
      return match; // no match found
    }
    return `[[${title}]]`;
  });

  // Step 2: Remove duplicate title after link (e.g., [[title]] title -> [[title]])
  // Only if the duplicate is a full word match
  Object.values(zettelMap).forEach(title => {
    // Regex: [[title]] title (with word boundary)
    const dupRegex = new RegExp(`\\[\\[${title.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\]\\](\\s+)${title}(?=\\b)`, 'g');
    modified = modified.replace(dupRegex, `[[${title}]]`);
  });

  if (missingLinks.length > 0) {
    console.warn(`⚠️  Missing links in ${file}: ${missingLinks.join(', ')}`);
  }

  fs.writeFileSync(filePath, modified, 'utf8');
  console.log(`✅ Processed: ${file}`);
}

// Step 3: Rename all .md files to remove trailing space and 14-digit number before .md
for (const file of files) {
  if (!file.endsWith('.md')) continue;
  const match = file.match(/^(.+)\s(20\d{12})\.md$/);
  if (match) {
    const [_, title] = match;
    const oldPath = path.join(zettlrDir, file);
    const newPath = path.join(zettlrDir, `${title}.md`);
    if (!fs.existsSync(newPath)) {
      fs.renameSync(oldPath, newPath);
      console.log(`📝 Renamed: ${file} → ${title}.md`);
    } else {
      console.warn(`⚠️  Cannot rename ${file} to ${title}.md (target exists)`);
    }
  }
}

// --- Update files list after renaming ---
const updatedFiles = fs.readdirSync(zettlrDir);

// --- Chain links for journals/diaries ---
const journalFiles = updatedFiles
  .filter(f => f.endsWith('.md') && /diary|journal/i.test(f))
  .map(f => {
    // Try to get the date from the zettelMap by matching the title
    // Title is filename without .md
    const title = f.replace(/\.md$/, '');
    // Find the id for this title
    const id = Object.keys(zettelMap).find(k => zettelMap[k] === title);
    return id ? { file: f, date: id } : null;
  })
  .filter(Boolean)
  .sort((a, b) => a.date.localeCompare(b.date));

// Build chain: for each, add prev/next links
for (let i = 0; i < journalFiles.length; i++) {
  const { file } = journalFiles[i];
  const prev = journalFiles[i - 1];
  const next = journalFiles[i + 1];

  const filePath = path.join(zettlrDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove any existing chain links (optional, to avoid duplicates)
  content = content.replace(/^(\[\[.*?\]\] ← Previous\s*\|\s*Next → \[\[.*?\]\]\n)?/m, '');

  // Always use the exact filename (without .md) for links
  const fileBase = file.replace(/\.md$/, '');
  const prevBase = prev ? prev.file.replace(/\.md$/, '') : null;
  const nextBase = next ? next.file.replace(/\.md$/, '') : null;

  let chainLine = '';
  if (prevBase && nextBase) {
    chainLine = `[[${prevBase}]] ← Previous | Next → [[${nextBase}]]\n`;
  } else if (prevBase) {
    chainLine = `[[${prevBase}]] ← Previous\n`;
  } else if (nextBase) {
    chainLine = `Next → [[${nextBase}]]\n`;
  }

  // Insert at the top
  if (chainLine) {
    content = chainLine + content;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`🔗 Added chain links in: ${file}`);
  }
}
