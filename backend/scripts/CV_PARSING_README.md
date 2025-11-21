# CV Parsing Scripts

These scripts help automate the process of extracting professor statistics from CVs and updating the database.

## Available Scripts

### 1. PDF CV Parser (`parse-cv-pdf.js`)

Parses PDF CV files to extract:
- Undergraduate researchers
- Lab members (graduate students + postdocs)
- Published papers

**Usage:**
```bash
node scripts/parse-cv-pdf.js <department> <name> <pdf-file-path>
```

**Example:**
```bash
node scripts/parse-cv-pdf.js statistics "Guillaume Bal" ./cvs/guillaume-bal-cv.pdf
```

### 2. Text CV Parser (`parse-cv-text.js`)

Parses text-based CV files (or pasted text) to extract the same information.

**Usage:**
```bash
node scripts/parse-cv-text.js <department> <name> <text-file-path>
```

**Example:**
```bash
# From a text file
node scripts/parse-cv-text.js statistics "Jingshu Wang" ./cvs/jingshu-wang-cv.txt

# From stdin (paste text directly)
cat cv.txt | node scripts/parse-cv-text.js statistics "Professor Name" -
```

### 3. Manual Update Script (`update-professor-stats.js`)

For manual updates when you already have the counts.

**Usage:**
```bash
node scripts/update-professor-stats.js <department> <name> <undergrads> <labMembers> <publishedPapers>
```

**Example:**
```bash
node scripts/update-professor-stats.js statistics "Guillaume Bal" 13 4 188
```

## How It Works

The parsers look for common CV section headings like:
- **Undergraduate Students/Researchers**
- **Graduate Students/Doctoral Students**
- **Postdoctoral Researchers**
- **Publications**

They then count entries in each section by looking for:
- Names (capitalized words)
- Years (4-digit years, possibly with ranges)
- Bullet points or list formatting

## Tips for Best Results

1. **PDF Quality**: PDFs with selectable text work best. Scanned PDFs may need OCR first.

2. **CV Format**: The scripts work best with CVs that have:
   - Clear section headings
   - List formatting (bullets, dashes, or numbered lists)
   - Years associated with entries

3. **Verification**: Always verify the extracted numbers! The parsing is not 100% accurate and may:
   - Miss entries if formatting is unusual
   - Count incorrectly if sections are merged
   - Have trouble with non-standard formats

4. **Manual Correction**: If the parser misses entries, use the manual update script to correct the numbers.

## Workflow Recommendation

1. **Try PDF parser first** (if you have PDF):
   ```bash
   node scripts/parse-cv-pdf.js statistics "Professor Name" ./cv.pdf
   ```

2. **Verify the numbers** by checking the output

3. **Manually correct if needed**:
   ```bash
   node scripts/update-professor-stats.js statistics "Professor Name" <correct-undergrads> <correct-lab-members> <correct-papers>
   ```

## Common Issues

- **"No section found"**: The CV might use different terminology. Try the text parser and manually count, or update manually.

- **Incorrect counts**: CV formatting can vary. Always verify and use manual update if needed.

- **PDF parsing errors**: Make sure the PDF has selectable text (not just images). You may need to extract text first.

## Future Improvements

Potential enhancements:
- Machine learning for better pattern recognition
- Support for more CV formats
- Automatic verification against lab websites
- Integration with Google Scholar or ORCID APIs

