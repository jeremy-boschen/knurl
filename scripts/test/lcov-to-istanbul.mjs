/**
 * Simple LCOV to Istanbul JSON converter
 * 
 * Usage: node scripts/lcov-to-istanbul.mjs <input-lcov-file> <output-json-file>
 */

import fs from 'fs';
import path from 'path';

const inputFile = process.argv[2];
const outputFile = process.argv[3];

if (!inputFile || !outputFile) {
  console.error('Usage: node scripts/lcov-to-istanbul.mjs <input-lcov-file> <output-json-file>');
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`Input file not found: ${inputFile}`);
  process.exit(1);
}

const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split(/\r?\n/);

const coverageMap = {};
let currentFile = null;
let statementCounter = 0;

lines.forEach(line => {
  line = line.trim();
  if (!line) return;

  if (line.startsWith('SF:')) {
    const filePath = line.substring(3);
    // Normalize path to absolute if possible, or keep as is
    // cargo-llvm-cov usually outputs absolute paths or relative to root
    // We try to make it absolute based on cwd if it looks relative
    let absPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    
    // Normalize to forward slashes for consistency across OS and tools
    absPath = absPath.split(path.sep).join('/');

    currentFile = {
      path: absPath,
      statementMap: {},
      fnMap: {},
      branchMap: {},
      s: {},
      f: {},
      b: {}
    };
    coverageMap[absPath] = currentFile;
    statementCounter = 0;
  } else if (line.startsWith('DA:') && currentFile) {
    // DA:line,hits
    const parts = line.substring(3).split(',');
    const lineNumber = parseInt(parts[0], 10);
    const hits = parseInt(parts[1], 10);

    if (!isNaN(lineNumber) && !isNaN(hits)) {
      const id = statementCounter.toString();
      currentFile.statementMap[id] = {
        start: { line: lineNumber, column: 0 },
        end: { line: lineNumber, column: 0 }
      };
      currentFile.s[id] = hits;
      statementCounter++;
    }
  } else if (line === 'end_of_record') {
    currentFile = null;
  }
});

fs.writeFileSync(outputFile, JSON.stringify(coverageMap, null, 0)); // Compact JSON
console.log(`Converted LCOV to Istanbul JSON: ${outputFile}`);
