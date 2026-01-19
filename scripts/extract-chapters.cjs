#!/usr/bin/env node
/**
 * Extract chapters from bookContent.ts to separate markdown files
 * Creates public/chapters/manifest.json and individual .md files
 */

const fs = require('fs');
const path = require('path');

// Read the bookContent.ts file
const bookContentPath = path.join(__dirname, '..', 'constants', 'bookContent.ts');
const outputDir = path.join(__dirname, '..', 'public', 'chapters');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Read the file content
const content = fs.readFileSync(bookContentPath, 'utf-8');

// Extract book metadata
const titleMatch = content.match(/title:\s*"([^"]+)"/);
const subtitleMatch = content.match(/subtitle:\s*"([^"]+)"/);
const authorMatch = content.match(/author:\s*"([^"]+)"/);

const bookTitle = titleMatch ? titleMatch[1] : 'Ataraxia';
const bookSubtitle = subtitleMatch ? subtitleMatch[1] : 'Forging the Sovereign Self';
const bookAuthor = authorMatch ? authorMatch[1] : 'PYTHAI';

// Extract chapters - match the pattern of chapter objects
const chapterRegex = /\{\s*title:\s*"(Chapter\s*\d+[^"]+)",\s*content:\s*`([^`]+)`\s*\}/g;

const chapters = [];
let match;

while ((match = chapterRegex.exec(content)) !== null) {
    const title = match[1];
    const chapterContent = match[2].trim();

    // Extract chapter number from title
    const numMatch = title.match(/Chapter\s*(\d+)/);
    const chapterNum = numMatch ? parseInt(numMatch[1]) : chapters.length + 1;

    // Generate filename
    const titleSlug = title
        .replace(/^Chapter\s*\d+:\s*/, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);

    const paddedNum = String(chapterNum).padStart(2, '0');
    const filename = `${paddedNum}-${titleSlug || 'chapter'}.md`;

    chapters.push({
        id: chapterNum,
        title: title,
        file: filename,
        content: chapterContent
    });
}

console.log(`Found ${chapters.length} chapters`);

// Write individual chapter files
for (const chapter of chapters) {
    const filePath = path.join(outputDir, chapter.file);
    fs.writeFileSync(filePath, chapter.content, 'utf-8');
    console.log(`  Created: ${chapter.file}`);
}

// Create manifest.json (without content)
const manifest = {
    title: bookTitle,
    subtitle: bookSubtitle,
    author: bookAuthor,
    chapters: chapters.map(ch => ({
        id: ch.id,
        title: ch.title,
        file: ch.file
    }))
};

const manifestPath = path.join(outputDir, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
console.log(`\nCreated manifest.json with ${chapters.length} chapters`);
console.log(`Output directory: ${outputDir}`);
