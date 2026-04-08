use std::cmp::Reverse;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime};

use glob::Pattern;
use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::edit_replacers::{get_replacers, ReplacementMatch};

/// Maximum file size that can be read (10 MB).
const MAX_READ_SIZE: u64 = 10 * 1024 * 1024;

/// Maximum file size that can be written (10 MB).
const MAX_WRITE_SIZE: usize = 10 * 1024 * 1024;

/// Maximum file size that can be edited (1 GB) - matches TypeScript implementation
const MAX_EDIT_FILE_SIZE: u64 = 1024 * 1024 * 1024;

/// Curly quote characters for normalization
const LEFT_SINGLE_CURLY: char = '\u{2018}'; // '
const RIGHT_SINGLE_CURLY: char = '\u{2019}'; // '
const LEFT_DOUBLE_CURLY: char = '\u{201C}'; // "
const RIGHT_DOUBLE_CURLY: char = '\u{201D}'; // "

/// Check whether a file appears to contain binary content by examining
/// the first chunk for NUL bytes.
fn is_binary_file(path: &Path) -> io::Result<bool> {
    use std::io::Read;
    let mut file = fs::File::open(path)?;
    let mut buffer = [0u8; 8192];
    let bytes_read = file.read(&mut buffer)?;
    Ok(buffer[..bytes_read].contains(&0))
}

/// Validate that a resolved path stays within the given workspace root.
/// Returns the canonical path on success, or an error if the path escapes
/// the workspace boundary (e.g. via `../` traversal or symlink).
#[allow(dead_code)]
fn validate_workspace_boundary(resolved: &Path, workspace_root: &Path) -> io::Result<()> {
    if !resolved.starts_with(workspace_root) {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            format!(
                "path {} escapes workspace boundary {}",
                resolved.display(),
                workspace_root.display()
            ),
        ));
    }
    Ok(())
}

/// Text payload returned by file-reading operations.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TextFilePayload {
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub content: String,
    #[serde(rename = "numLines")]
    pub num_lines: usize,
    #[serde(rename = "startLine")]
    pub start_line: usize,
    #[serde(rename = "totalLines")]
    pub total_lines: usize,
}

/// Output envelope for the `read_file` tool.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReadFileOutput {
    #[serde(rename = "type")]
    pub kind: String,
    pub file: TextFilePayload,
}

/// Structured patch hunk emitted by write and edit operations.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StructuredPatchHunk {
    #[serde(rename = "oldStart")]
    pub old_start: usize,
    #[serde(rename = "oldLines")]
    pub old_lines: usize,
    #[serde(rename = "newStart")]
    pub new_start: usize,
    #[serde(rename = "newLines")]
    pub new_lines: usize,
    pub lines: Vec<String>,
}

/// Output envelope for full-file write operations.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WriteFileOutput {
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub content: String,
    #[serde(rename = "structuredPatch")]
    pub structured_patch: Vec<StructuredPatchHunk>,
    #[serde(rename = "originalFile")]
    pub original_file: Option<String>,
    #[serde(rename = "gitDiff")]
    pub git_diff: Option<serde_json::Value>,
}

/// Output envelope for targeted string-replacement edits.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EditFileOutput {
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "oldString")]
    pub old_string: String,
    #[serde(rename = "newString")]
    pub new_string: String,
    #[serde(rename = "originalFile")]
    pub original_file: String,
    #[serde(rename = "structuredPatch")]
    pub structured_patch: Vec<StructuredPatchHunk>,
    #[serde(rename = "userModified")]
    pub user_modified: bool,
    #[serde(rename = "replaceAll")]
    pub replace_all: bool,
    #[serde(rename = "gitDiff")]
    pub git_diff: Option<serde_json::Value>,
}

/// Metadata for tracking file read state
#[derive(Debug, Clone)]
pub struct FileReadState {
    pub content: String,
    pub timestamp: SystemTime,
    pub is_partial_view: bool,
}

/// Result of a glob-based filename search.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GlobSearchOutput {
    #[serde(rename = "durationMs")]
    pub duration_ms: u128,
    #[serde(rename = "numFiles")]
    pub num_files: usize,
    pub filenames: Vec<String>,
    pub truncated: bool,
}

/// Parameters accepted by the grep-style search tool.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GrepSearchInput {
    pub pattern: String,
    pub path: Option<String>,
    pub glob: Option<String>,
    #[serde(rename = "output_mode")]
    pub output_mode: Option<String>,
    #[serde(rename = "-B")]
    pub before: Option<usize>,
    #[serde(rename = "-A")]
    pub after: Option<usize>,
    #[serde(rename = "-C")]
    pub context_short: Option<usize>,
    pub context: Option<usize>,
    #[serde(rename = "-n")]
    pub line_numbers: Option<bool>,
    #[serde(rename = "-i")]
    pub case_insensitive: Option<bool>,
    #[serde(rename = "type")]
    pub file_type: Option<String>,
    pub head_limit: Option<usize>,
    pub offset: Option<usize>,
    pub multiline: Option<bool>,
}

/// Result payload returned by the grep-style search tool.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GrepSearchOutput {
    pub mode: Option<String>,
    #[serde(rename = "numFiles")]
    pub num_files: usize,
    pub filenames: Vec<String>,
    pub content: Option<String>,
    #[serde(rename = "numLines")]
    pub num_lines: Option<usize>,
    #[serde(rename = "numMatches")]
    pub num_matches: Option<usize>,
    #[serde(rename = "appliedLimit")]
    pub applied_limit: Option<usize>,
    #[serde(rename = "appliedOffset")]
    pub applied_offset: Option<usize>,
}

/// Single entry in a directory listing.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DirectoryEntry {
    pub name: String,
    #[serde(rename = "type")]
    pub entry_type: String, // "file" | "dir"
    pub size: Option<u64>,
    pub modified: Option<String>,
}

/// Output envelope for directory listing.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ListDirectoryOutput {
    #[serde(rename = "type")]
    pub kind: String,
    pub path: String,
    pub entries: Vec<DirectoryEntry>,
    pub total: usize,
}

/// Reads a text file and returns a line-windowed payload.
pub fn read_file(
    path: &str,
    offset: Option<usize>,
    limit: Option<usize>,
) -> io::Result<ReadFileOutput> {
    let absolute_path = normalize_path(path)?;

    // Check file size before reading
    let metadata = fs::metadata(&absolute_path)?;
    if metadata.len() > MAX_READ_SIZE {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!(
                "file is too large ({} bytes, max {} bytes)",
                metadata.len(),
                MAX_READ_SIZE
            ),
        ));
    }

    // Detect binary files
    if is_binary_file(&absolute_path)? {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "file appears to be binary",
        ));
    }

    let content = fs::read_to_string(&absolute_path)?;
    let lines: Vec<&str> = content.lines().collect();
    let start_index = offset.unwrap_or(0).min(lines.len());
    let end_index = limit.map_or(lines.len(), |limit| {
        start_index.saturating_add(limit).min(lines.len())
    });
    let selected = lines[start_index..end_index].join("\n");

    Ok(ReadFileOutput {
        kind: String::from("text"),
        file: TextFilePayload {
            file_path: absolute_path.to_string_lossy().into_owned(),
            content: selected,
            num_lines: end_index.saturating_sub(start_index),
            start_line: start_index.saturating_add(1),
            total_lines: lines.len(),
        },
    })
}

/// Replaces a file's contents and returns patch metadata.
pub fn write_file(path: &str, content: &str) -> io::Result<WriteFileOutput> {
    if content.len() > MAX_WRITE_SIZE {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!(
                "content is too large ({} bytes, max {} bytes)",
                content.len(),
                MAX_WRITE_SIZE
            ),
        ));
    }

    let absolute_path = normalize_path_allow_missing(path)?;
    let original_file = fs::read_to_string(&absolute_path).ok();
    if let Some(parent) = absolute_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&absolute_path, content)?;

    Ok(WriteFileOutput {
        kind: if original_file.is_some() {
            String::from("update")
        } else {
            String::from("create")
        },
        file_path: absolute_path.to_string_lossy().into_owned(),
        content: content.to_owned(),
        structured_patch: make_patch(original_file.as_deref().unwrap_or(""), content),
        original_file,
        git_diff: None,
    })
}

/// Performs an in-file string replacement and returns patch metadata.
pub fn edit_file(
    path: &str,
    old_string: &str,
    new_string: &str,
    replace_all: bool,
) -> io::Result<EditFileOutput> {
    edit_file_with_validation(path, old_string, new_string, replace_all, None)
}

/// Performs an in-file string replacement with optional read state validation.
/// This prevents race conditions where the file is modified between read and write.
pub fn edit_file_with_validation(
    path: &str,
    old_string: &str,
    new_string: &str,
    replace_all: bool,
    last_read_state: Option<&FileReadState>,
) -> io::Result<EditFileOutput> {
    let absolute_path = normalize_path(path)?;
    
    // Check file size before reading (prevent OOM on multi-GB files)
    let metadata = fs::metadata(&absolute_path)?;
    if metadata.len() > MAX_EDIT_FILE_SIZE {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!(
                "File is too large to edit ({} bytes). Maximum editable file size is {} bytes.",
                metadata.len(),
                MAX_EDIT_FILE_SIZE
            ),
        ));
    }
    
    let original_file = fs::read_to_string(&absolute_path)?;
    
    // Validate file hasn't been modified since last read
    if let Some(read_state) = last_read_state {
        let current_modified = metadata.modified()?;
        if current_modified > read_state.timestamp {
            // On Windows, timestamps can change without content changes
            // Compare content as fallback to avoid false positives
            if !read_state.is_partial_view && original_file == read_state.content {
                // Content unchanged, safe to proceed
            } else {
                return Err(io::Error::new(
                    io::ErrorKind::Other,
                    "File has been modified since read, either by the user or by a linter. Read it again before attempting to write it.",
                ));
            }
        }
    }
    
    // Note: We don't check old_string == new_string here because:
    // 1. Smart replacers may match differently than exact string
    // 2. The actual matched text might differ from old_string
    // 3. We'll check if actual changes are needed after matching
    
    // Try smart replacers in order from strict to relaxed
    let replacers = get_replacers();
    let mut all_matches: Vec<ReplacementMatch> = Vec::new();
    let mut used_replacer_name = "";
    
    for replacer in replacers.iter() {
        let matches = replacer.find_matches(&original_file, old_string);
        if !matches.is_empty() {
            all_matches = matches;
            used_replacer_name = replacer.name();
            break;
        }
    }
    
    // No matches found with any replacer
    if all_matches.is_empty() {
        let suggestion = find_similar_string(&original_file, old_string);
        let mut error_msg = format!(
            "Could not find oldString in the file. It must match exactly, including whitespace, indentation, and line endings.\n\nString to find:\n{}", 
            old_string
        );
        if let Some(similar) = suggestion {
            error_msg.push_str(&format!("\n\nDid you mean:\n{}", similar));
            error_msg.push_str("\n\nHint: The string was found but may have different whitespace, indentation, or line endings. Try using the exact text from the file.");
        } else {
            error_msg.push_str("\n\nHint: No similar text found. Make sure you're editing the correct file and the text hasn't been modified.");
        }
        return Err(io::Error::new(io::ErrorKind::NotFound, error_msg));
    }
    
    // Check for multiple occurrences
    if all_matches.len() > 1 && !replace_all {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!(
                "Found {} matches for oldString. Provide more surrounding context to make the match unique, or set replace_all to true.\n\nMatched using: {}\nString: {}",
                all_matches.len(),
                used_replacer_name,
                old_string
            ),
        ));
    }
    
    // Preserve curly quotes in new_string when file uses them
    let actual_old_string = &all_matches[0].matched_text;
    let actual_new_string = preserve_quote_style(old_string, actual_old_string, new_string);
    
    // Strip trailing whitespace from new_string (except for Markdown files)
    let final_new_string = if should_strip_trailing_whitespace(path) {
        strip_trailing_whitespace(&actual_new_string)
    } else {
        actual_new_string
    };
    
    // Check if there are actual changes to make
    if replace_all {
        // For replace_all, check if any match differs from new_string
        let has_changes = all_matches.iter().any(|m| m.matched_text != final_new_string);
        if !has_changes {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "No changes to make: all matched strings are already identical to new_string.",
            ));
        }
    } else {
        // For single replace, check if the matched text differs from new_string
        if all_matches[0].matched_text == final_new_string {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "No changes to make: matched string is already identical to new_string.",
            ));
        }
    }

    // Apply replacements - use safe string replacement to avoid panic on invalid byte indices
    let updated = if replace_all {
        // Replace all matches in reverse order to maintain positions
        let mut result = original_file.clone();
        for m in all_matches.iter().rev() {
            // Validate byte indices are on char boundaries
            if !result.is_char_boundary(m.start) || !result.is_char_boundary(m.end) {
                return Err(io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!(
                        "Internal error: Invalid byte indices for replacement (start={}, end={}). This is a bug in the replacer.",
                        m.start, m.end
                    ),
                ));
            }
            result.replace_range(m.start..m.end, &final_new_string);
        }
        result
    } else {
        // Replace only the first match
        let m = &all_matches[0];
        let mut result = original_file.clone();
        
        // Validate byte indices are on char boundaries
        if !result.is_char_boundary(m.start) || !result.is_char_boundary(m.end) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!(
                    "Internal error: Invalid byte indices for replacement (start={}, end={}). This is a bug in the replacer.",
                    m.start, m.end
                ),
            ));
        }
        
        result.replace_range(m.start..m.end, &final_new_string);
        result
    };
    
    fs::write(&absolute_path, &updated)?;

    Ok(EditFileOutput {
        file_path: absolute_path.to_string_lossy().into_owned(),
        old_string: all_matches[0].matched_text.clone(),
        new_string: new_string.to_owned(),
        original_file: original_file.clone(),
        structured_patch: make_patch(&original_file, &updated),
        user_modified: false,
        replace_all,
        git_diff: None,
    })
}

/// Normalizes quotes by converting curly quotes to straight quotes
fn normalize_quotes(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            LEFT_SINGLE_CURLY | RIGHT_SINGLE_CURLY => '\'',
            LEFT_DOUBLE_CURLY | RIGHT_DOUBLE_CURLY => '"',
            _ => c,
        })
        .collect()
}

/// Strips trailing whitespace from each line while preserving line endings
fn strip_trailing_whitespace(s: &str) -> String {
    s.lines()
        .map(|line| line.trim_end())
        .collect::<Vec<_>>()
        .join("\n")
}

/// Checks if trailing whitespace should be stripped for this file type
fn should_strip_trailing_whitespace(path: &str) -> bool {
    // Markdown uses two trailing spaces as hard line break - don't strip
    !path.ends_with(".md") && !path.ends_with(".mdx")
}

/// Normalizes line endings to \n
fn normalize_line_endings(s: &str) -> String {
    s.replace("\r\n", "\n").replace('\r', "\n")
}

/// Finds the actual string in file content, accounting for quote normalization and line endings
fn find_actual_string<'a>(file_content: &'a str, search_string: &str) -> Option<&'a str> {
    // First try exact match
    if let Some(pos) = file_content.find(search_string) {
        return Some(&file_content[pos..pos + search_string.len()]);
    }
    
    // Try with normalized quotes
    let normalized_search = normalize_quotes(search_string);
    let normalized_file = normalize_quotes(file_content);
    
    if let Some(pos) = normalized_file.find(&normalized_search) {
        // Find the actual string in the original file
        return Some(&file_content[pos..pos + search_string.len()]);
    }
    
    // Try with normalized line endings (Windows \r\n vs Unix \n)
    let search_normalized_lines = normalize_line_endings(search_string);
    let file_normalized_lines = normalize_line_endings(file_content);
    
    if let Some(pos) = file_normalized_lines.find(&search_normalized_lines) {
        // Calculate position in original file accounting for \r\n
        let actual_pos = calculate_original_position(file_content, pos);
        let actual_len = calculate_original_length(file_content, actual_pos, search_normalized_lines.len());
        return Some(&file_content[actual_pos..actual_pos + actual_len]);
    }
    
    // Try with both normalizations
    let search_fully_normalized = normalize_line_endings(&normalize_quotes(search_string));
    let file_fully_normalized = normalize_line_endings(&normalize_quotes(file_content));
    
    if let Some(pos) = file_fully_normalized.find(&search_fully_normalized) {
        let actual_pos = calculate_original_position(file_content, pos);
        let actual_len = calculate_original_length(file_content, actual_pos, search_fully_normalized.len());
        return Some(&file_content[actual_pos..actual_pos + actual_len]);
    }
    
    None
}

/// Calculates the position in original string accounting for \r\n line endings
fn calculate_original_position(original: &str, normalized_pos: usize) -> usize {
    let mut original_pos = 0;
    let mut normalized_count = 0;
    
    let chars: Vec<char> = original.chars().collect();
    let mut i = 0;
    
    while i < chars.len() && normalized_count < normalized_pos {
        if i + 1 < chars.len() && chars[i] == '\r' && chars[i + 1] == '\n' {
            // \r\n counts as 1 in normalized, but 2 in original
            original_pos += 2;
            normalized_count += 1;
            i += 2;
        } else {
            original_pos += chars[i].len_utf8();
            normalized_count += 1;
            i += 1;
        }
    }
    
    original_pos
}

/// Calculates the length in original string accounting for \r\n line endings
fn calculate_original_length(original: &str, start_pos: usize, normalized_len: usize) -> usize {
    let substring = &original[start_pos..];
    let mut original_len = 0;
    let mut normalized_count = 0;
    
    let chars: Vec<char> = substring.chars().collect();
    let mut i = 0;
    
    while i < chars.len() && normalized_count < normalized_len {
        if i + 1 < chars.len() && chars[i] == '\r' && chars[i + 1] == '\n' {
            original_len += 2;
            normalized_count += 1;
            i += 2;
        } else {
            original_len += chars[i].len_utf8();
            normalized_count += 1;
            i += 1;
        }
    }
    
    original_len
}

/// Preserves the quote style from the original file when applying edits
fn preserve_quote_style(old_string: &str, actual_old_string: &str, new_string: &str) -> String {
    // If they're the same, no normalization happened
    if old_string == actual_old_string {
        return new_string.to_owned();
    }
    
    // Detect which curly quote types were in the file
    let has_double_quotes = actual_old_string.contains(LEFT_DOUBLE_CURLY) 
        || actual_old_string.contains(RIGHT_DOUBLE_CURLY);
    let has_single_quotes = actual_old_string.contains(LEFT_SINGLE_CURLY) 
        || actual_old_string.contains(RIGHT_SINGLE_CURLY);
    
    if !has_double_quotes && !has_single_quotes {
        return new_string.to_owned();
    }
    
    let mut result = new_string.to_owned();
    
    if has_double_quotes {
        result = apply_curly_double_quotes(&result);
    }
    if has_single_quotes {
        result = apply_curly_single_quotes(&result);
    }
    
    result
}

/// Applies curly double quotes to straight quotes
fn apply_curly_double_quotes(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    let mut result = String::new();
    
    for (i, &ch) in chars.iter().enumerate() {
        if ch == '"' {
            if is_opening_context(&chars, i) {
                result.push(LEFT_DOUBLE_CURLY);
            } else {
                result.push(RIGHT_DOUBLE_CURLY);
            }
        } else {
            result.push(ch);
        }
    }
    
    result
}

/// Applies curly single quotes to straight quotes (avoiding contractions)
fn apply_curly_single_quotes(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    let mut result = String::new();
    
    for (i, &ch) in chars.iter().enumerate() {
        if ch == '\'' {
            // Don't convert apostrophes in contractions (e.g., "don't", "it's")
            let prev = if i > 0 { Some(chars[i - 1]) } else { None };
            let next = if i < chars.len() - 1 { Some(chars[i + 1]) } else { None };
            
            let prev_is_letter = prev.map_or(false, |c| c.is_alphabetic());
            let next_is_letter = next.map_or(false, |c| c.is_alphabetic());
            
            if prev_is_letter && next_is_letter {
                // Apostrophe in contraction - use right single curly
                result.push(RIGHT_SINGLE_CURLY);
            } else if is_opening_context(&chars, i) {
                result.push(LEFT_SINGLE_CURLY);
            } else {
                result.push(RIGHT_SINGLE_CURLY);
            }
        } else {
            result.push(ch);
        }
    }
    
    result
}

/// Determines if a quote at position is in an opening context
fn is_opening_context(chars: &[char], index: usize) -> bool {
    if index == 0 {
        return true;
    }
    
    let prev = chars[index - 1];
    matches!(prev, ' ' | '\t' | '\n' | '\r' | '(' | '[' | '{' | '—' | '–')
}

/// Finds a similar string in the file content (for error suggestions)
fn find_similar_string(file_content: &str, search_string: &str) -> Option<String> {
    // Extract first meaningful line from search string (skip empty lines)
    let search_first_line = search_string
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("");
    
    if search_first_line.is_empty() {
        return None;
    }
    
    // Try to find a line that starts similarly
    let search_start = search_first_line.trim().chars().take(20).collect::<String>();
    
    for line in file_content.lines() {
        let line_start = line.trim().chars().take(20).collect::<String>();
        if line_start == search_start {
            // Found a line with same start - return a few lines of context
            let line_index = file_content.lines().position(|l| l == line)?;
            let context_lines: Vec<&str> = file_content
                .lines()
                .skip(line_index)
                .take(3)
                .collect();
            return Some(context_lines.join("\n"));
        }
    }
    
    // Fallback: find lines containing key words
    let search_words: Vec<&str> = search_string
        .split_whitespace()
        .filter(|w| w.len() > 3) // Only meaningful words
        .take(5)
        .collect();
    
    if search_words.is_empty() {
        return None;
    }
    
    let mut best_match: Option<(usize, &str)> = None;
    let mut best_score = 0;
    
    for line in file_content.lines() {
        let score = search_words.iter().filter(|&&word| line.contains(word)).count();
        if score > best_score {
            best_score = score;
            best_match = Some((score, line));
        }
    }
    
    if let Some((score, line)) = best_match {
        if score >= search_words.len().min(2) {
            return Some(line.trim().to_owned());
        }
    }
    
    None
}

/// Expands a glob pattern and returns matching filenames.
pub fn glob_search(pattern: &str, path: Option<&str>) -> io::Result<GlobSearchOutput> {
    let started = Instant::now();
    let base_dir = path
        .map(normalize_path)
        .transpose()?
        .unwrap_or(std::env::current_dir()?);
    let search_pattern = if Path::new(pattern).is_absolute() {
        pattern.to_owned()
    } else {
        base_dir.join(pattern).to_string_lossy().into_owned()
    };

    let mut matches = Vec::new();
    let entries = glob::glob(&search_pattern)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, error.to_string()))?;
    for entry in entries.flatten() {
        if entry.is_file() {
            matches.push(entry);
        }
    }

    matches.sort_by_key(|path| {
        fs::metadata(path)
            .and_then(|metadata| metadata.modified())
            .ok()
            .map(Reverse)
    });

    let truncated = matches.len() > 100;
    let filenames = matches
        .into_iter()
        .take(100)
        .map(|path| path.to_string_lossy().into_owned())
        .collect::<Vec<_>>();

    Ok(GlobSearchOutput {
        duration_ms: started.elapsed().as_millis(),
        num_files: filenames.len(),
        filenames,
        truncated,
    })
}

/// Runs a regex search over workspace files with optional context lines.
pub fn grep_search(input: &GrepSearchInput) -> io::Result<GrepSearchOutput> {
    let base_path = input
        .path
        .as_deref()
        .map(normalize_path)
        .transpose()?
        .unwrap_or(std::env::current_dir()?);

    let regex = RegexBuilder::new(&input.pattern)
        .case_insensitive(input.case_insensitive.unwrap_or(false))
        .dot_matches_new_line(input.multiline.unwrap_or(false))
        .build()
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, error.to_string()))?;

    let glob_filter = input
        .glob
        .as_deref()
        .map(Pattern::new)
        .transpose()
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidInput, error.to_string()))?;
    let file_type = input.file_type.as_deref();
    let output_mode = input
        .output_mode
        .clone()
        .unwrap_or_else(|| String::from("files_with_matches"));
    let context = input.context.or(input.context_short).unwrap_or(0);

    let mut filenames = Vec::new();
    let mut content_lines = Vec::new();
    let mut total_matches = 0usize;

    for file_path in collect_search_files(&base_path)? {
        if !matches_optional_filters(&file_path, glob_filter.as_ref(), file_type) {
            continue;
        }

        let Ok(file_contents) = fs::read_to_string(&file_path) else {
            continue;
        };

        if output_mode == "count" {
            let count = regex.find_iter(&file_contents).count();
            if count > 0 {
                filenames.push(file_path.to_string_lossy().into_owned());
                total_matches += count;
            }
            continue;
        }

        let lines: Vec<&str> = file_contents.lines().collect();
        let mut matched_lines = Vec::new();
        for (index, line) in lines.iter().enumerate() {
            if regex.is_match(line) {
                total_matches += 1;
                matched_lines.push(index);
            }
        }

        if matched_lines.is_empty() {
            continue;
        }

        filenames.push(file_path.to_string_lossy().into_owned());
        if output_mode == "content" {
            for index in matched_lines {
                let start = index.saturating_sub(input.before.unwrap_or(context));
                let end = (index + input.after.unwrap_or(context) + 1).min(lines.len());
                for (current, line) in lines.iter().enumerate().take(end).skip(start) {
                    let prefix = if input.line_numbers.unwrap_or(true) {
                        format!("{}:{}:", file_path.to_string_lossy(), current + 1)
                    } else {
                        format!("{}:", file_path.to_string_lossy())
                    };
                    content_lines.push(format!("{prefix}{line}"));
                }
            }
        }
    }

    let (filenames, applied_limit, applied_offset) =
        apply_limit(filenames, input.head_limit, input.offset);
    let content_output = if output_mode == "content" {
        let (lines, limit, offset) = apply_limit(content_lines, input.head_limit, input.offset);
        return Ok(GrepSearchOutput {
            mode: Some(output_mode),
            num_files: filenames.len(),
            filenames,
            num_lines: Some(lines.len()),
            content: Some(lines.join("\n")),
            num_matches: None,
            applied_limit: limit,
            applied_offset: offset,
        });
    } else {
        None
    };

    Ok(GrepSearchOutput {
        mode: Some(output_mode.clone()),
        num_files: filenames.len(),
        filenames,
        content: content_output,
        num_lines: None,
        num_matches: (output_mode == "count").then_some(total_matches),
        applied_limit,
        applied_offset,
    })
}

/// Lists files and directories in a given path (non-recursive, direct children only).
pub fn list_directory(path: &str) -> io::Result<ListDirectoryOutput> {
    let absolute_path = normalize_path(path)?;
    
    if !absolute_path.is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            format!("Path is not a directory: {}", path),
        ));
    }

    let mut entries = Vec::new();
    
    for entry in fs::read_dir(&absolute_path)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        let name = entry.file_name().to_string_lossy().into_owned();
        
        let entry_type = if metadata.is_dir() {
            "dir".to_string()
        } else {
            "file".to_string()
        };
        
        let size = if metadata.is_file() {
            Some(metadata.len())
        } else {
            None
        };
        
        let modified = metadata
            .modified()
            .ok()
            .and_then(|time| {
                time.duration_since(std::time::UNIX_EPOCH)
                    .ok()
                    .map(|d| d.as_secs())
            })
            .map(|timestamp| {
                // Format as ISO 8601
                use std::time::UNIX_EPOCH;
                let datetime = UNIX_EPOCH + std::time::Duration::from_secs(timestamp);
                format!("{:?}", datetime) // Simple format, can be improved
            });
        
        entries.push(DirectoryEntry {
            name,
            entry_type,
            size,
            modified,
        });
    }
    
    // Sort: directories first, then files, alphabetically
    entries.sort_by(|a, b| {
        match (&a.entry_type[..], &b.entry_type[..]) {
            ("dir", "file") => std::cmp::Ordering::Less,
            ("file", "dir") => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    let total = entries.len();
    
    Ok(ListDirectoryOutput {
        kind: "directory".to_string(),
        path: absolute_path.to_string_lossy().into_owned(),
        entries,
        total,
    })
}

fn collect_search_files(base_path: &Path) -> io::Result<Vec<PathBuf>> {
    if base_path.is_file() {
        return Ok(vec![base_path.to_path_buf()]);
    }

    let mut files = Vec::new();
    for entry in WalkDir::new(base_path) {
        let entry = entry.map_err(|error| io::Error::other(error.to_string()))?;
        if entry.file_type().is_file() {
            files.push(entry.path().to_path_buf());
        }
    }
    Ok(files)
}

fn matches_optional_filters(
    path: &Path,
    glob_filter: Option<&Pattern>,
    file_type: Option<&str>,
) -> bool {
    if let Some(glob_filter) = glob_filter {
        let path_string = path.to_string_lossy();
        if !glob_filter.matches(&path_string) && !glob_filter.matches_path(path) {
            return false;
        }
    }

    if let Some(file_type) = file_type {
        let extension = path.extension().and_then(|extension| extension.to_str());
        if extension != Some(file_type) {
            return false;
        }
    }

    true
}

fn apply_limit<T>(
    items: Vec<T>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> (Vec<T>, Option<usize>, Option<usize>) {
    let offset_value = offset.unwrap_or(0);
    let mut items = items.into_iter().skip(offset_value).collect::<Vec<_>>();
    let explicit_limit = limit.unwrap_or(250);
    if explicit_limit == 0 {
        return (items, None, (offset_value > 0).then_some(offset_value));
    }

    let truncated = items.len() > explicit_limit;
    items.truncate(explicit_limit);
    (
        items,
        truncated.then_some(explicit_limit),
        (offset_value > 0).then_some(offset_value),
    )
}

fn make_patch(original: &str, updated: &str) -> Vec<StructuredPatchHunk> {
    let mut lines = Vec::new();
    for line in original.lines() {
        lines.push(format!("-{line}"));
    }
    for line in updated.lines() {
        lines.push(format!("+{line}"));
    }

    vec![StructuredPatchHunk {
        old_start: 1,
        old_lines: original.lines().count(),
        new_start: 1,
        new_lines: updated.lines().count(),
        lines,
    }]
}

fn normalize_path(path: &str) -> io::Result<PathBuf> {
    let candidate = if Path::new(path).is_absolute() {
        PathBuf::from(path)
    } else {
        std::env::current_dir()?.join(path)
    };
    candidate.canonicalize()
}

fn normalize_path_allow_missing(path: &str) -> io::Result<PathBuf> {
    let candidate = if Path::new(path).is_absolute() {
        PathBuf::from(path)
    } else {
        std::env::current_dir()?.join(path)
    };

    if let Ok(canonical) = candidate.canonicalize() {
        return Ok(canonical);
    }

    if let Some(parent) = candidate.parent() {
        let canonical_parent = parent
            .canonicalize()
            .unwrap_or_else(|_| parent.to_path_buf());
        if let Some(name) = candidate.file_name() {
            return Ok(canonical_parent.join(name));
        }
    }

    Ok(candidate)
}

/// Read a file with workspace boundary enforcement.
#[allow(dead_code)]
pub fn read_file_in_workspace(
    path: &str,
    offset: Option<usize>,
    limit: Option<usize>,
    workspace_root: &Path,
) -> io::Result<ReadFileOutput> {
    let absolute_path = normalize_path(path)?;
    let canonical_root = workspace_root
        .canonicalize()
        .unwrap_or_else(|_| workspace_root.to_path_buf());
    validate_workspace_boundary(&absolute_path, &canonical_root)?;
    read_file(path, offset, limit)
}

/// Write a file with workspace boundary enforcement.
#[allow(dead_code)]
pub fn write_file_in_workspace(
    path: &str,
    content: &str,
    workspace_root: &Path,
) -> io::Result<WriteFileOutput> {
    let absolute_path = normalize_path_allow_missing(path)?;
    let canonical_root = workspace_root
        .canonicalize()
        .unwrap_or_else(|_| workspace_root.to_path_buf());
    validate_workspace_boundary(&absolute_path, &canonical_root)?;
    write_file(path, content)
}

/// Edit a file with workspace boundary enforcement.
#[allow(dead_code)]
pub fn edit_file_in_workspace(
    path: &str,
    old_string: &str,
    new_string: &str,
    replace_all: bool,
    workspace_root: &Path,
) -> io::Result<EditFileOutput> {
    edit_file_in_workspace_with_validation(path, old_string, new_string, replace_all, workspace_root, None)
}

/// Edit a file with workspace boundary enforcement and read state validation.
#[allow(dead_code)]
pub fn edit_file_in_workspace_with_validation(
    path: &str,
    old_string: &str,
    new_string: &str,
    replace_all: bool,
    workspace_root: &Path,
    last_read_state: Option<&FileReadState>,
) -> io::Result<EditFileOutput> {
    let absolute_path = normalize_path(path)?;
    let canonical_root = workspace_root
        .canonicalize()
        .unwrap_or_else(|_| workspace_root.to_path_buf());
    validate_workspace_boundary(&absolute_path, &canonical_root)?;
    edit_file_with_validation(path, old_string, new_string, replace_all, last_read_state)
}

/// Check whether a path is a symlink that resolves outside the workspace.
#[allow(dead_code)]
pub fn is_symlink_escape(path: &Path, workspace_root: &Path) -> io::Result<bool> {
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.is_symlink() {
        return Ok(false);
    }
    let resolved = path.canonicalize()?;
    let canonical_root = workspace_root
        .canonicalize()
        .unwrap_or_else(|_| workspace_root.to_path_buf());
    Ok(!resolved.starts_with(&canonical_root))
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{
        edit_file, glob_search, grep_search, is_symlink_escape, read_file, read_file_in_workspace,
        write_file, GrepSearchInput, MAX_WRITE_SIZE,
    };

    fn temp_path(name: &str) -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time should move forward")
            .as_nanos();
        std::env::temp_dir().join(format!("clawd-native-{name}-{unique}"))
    }

    #[test]
    fn reads_and_writes_files() {
        let path = temp_path("read-write.txt");
        let write_output = write_file(path.to_string_lossy().as_ref(), "one\ntwo\nthree")
            .expect("write should succeed");
        assert_eq!(write_output.kind, "create");

        let read_output = read_file(path.to_string_lossy().as_ref(), Some(1), Some(1))
            .expect("read should succeed");
        assert_eq!(read_output.file.content, "two");
    }

    #[test]
    fn edits_file_contents() {
        let path = temp_path("edit.txt");
        write_file(path.to_string_lossy().as_ref(), "alpha beta alpha")
            .expect("initial write should succeed");
        let output = edit_file(path.to_string_lossy().as_ref(), "alpha", "omega", true)
            .expect("edit should succeed");
        assert!(output.replace_all);
        assert_eq!(output.new_string, "omega");
    }

    #[test]
    fn detects_multiple_occurrences() {
        let path = temp_path("multi-match.txt");
        write_file(path.to_string_lossy().as_ref(), "foo bar foo baz foo")
            .expect("initial write should succeed");
        
        // Should fail when replace_all is false and multiple matches exist
        let result = edit_file(path.to_string_lossy().as_ref(), "foo", "qux", false);
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(error.to_string().contains("Found 3 matches"));
        
        // Should succeed with replace_all = true
        let output = edit_file(path.to_string_lossy().as_ref(), "foo", "qux", true)
            .expect("edit with replace_all should succeed");
        assert!(output.replace_all);
    }

    #[test]
    fn normalizes_curly_quotes() {
        let path = temp_path("quotes.txt");
        // File contains curly quotes (using Unicode escapes)
        let content_with_curly = "He said \u{201C}hello\u{201D} and \u{2018}goodbye\u{2019}";
        write_file(path.to_string_lossy().as_ref(), content_with_curly)
            .expect("initial write should succeed");
        
        // Search with straight quotes should still find the text
        let output = edit_file(
            path.to_string_lossy().as_ref(),
            "\"hello\"",
            "\"hi\"",
            false
        ).expect("edit should succeed despite quote mismatch");
        
        // The actual old string should contain curly quotes
        assert!(output.old_string.contains('\u{201C}') || output.old_string.contains('\u{201D}'));
    }

    #[test]
    fn strips_trailing_whitespace() {
        let path = temp_path("whitespace.txt");
        write_file(path.to_string_lossy().as_ref(), "line1\nline2")
            .expect("initial write should succeed");
        
        // New string has trailing spaces
        let _output = edit_file(
            path.to_string_lossy().as_ref(),
            "line2",
            "line2   ",
            false
        ).expect("edit should succeed");
        
        // Read back and verify trailing whitespace was stripped
        let content = std::fs::read_to_string(&path).expect("read should succeed");
        assert!(!content.contains("   "));
    }

    #[test]
    fn preserves_markdown_trailing_whitespace() {
        let path = temp_path("test.md");
        write_file(path.to_string_lossy().as_ref(), "line1\nline2")
            .expect("initial write should succeed");
        
        // Markdown files should preserve trailing spaces (hard line break)
        let _output = edit_file(
            path.to_string_lossy().as_ref(),
            "line2",
            "line2  ",
            false
        ).expect("edit should succeed");
        
        // Read back and verify trailing whitespace was preserved
        let content = std::fs::read_to_string(&path).expect("read should succeed");
        assert!(content.ends_with("  "));
    }

    #[test]
    fn rejects_oversized_edits() {
        let path = temp_path("huge-edit.txt");
        // Create a file just under the limit
        let content = "x".repeat((MAX_EDIT_FILE_SIZE - 100) as usize);
        std::fs::write(&path, &content).expect("write should succeed");
        
        // Try to edit - should fail due to size
        let result = edit_file(path.to_string_lossy().as_ref(), "x", "y", false);
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(error.to_string().contains("too large"));
    }

    #[test]
    fn validates_file_modification_timestamp() {
        let path = temp_path("timestamp-check.txt");
        write_file(path.to_string_lossy().as_ref(), "original content")
            .expect("initial write should succeed");
        
        // Simulate a read state from the past
        let old_timestamp = SystemTime::now() - std::time::Duration::from_secs(10);
        let read_state = FileReadState {
            content: "original content".to_owned(),
            timestamp: old_timestamp,
            is_partial_view: false,
        };
        
        // Modify the file
        std::fs::write(&path, "modified content").expect("modification should succeed");
        
        // Try to edit with old read state - should fail
        let result = edit_file_with_validation(
            path.to_string_lossy().as_ref(),
            "original",
            "new",
            false,
            Some(&read_state)
        );
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert!(error.to_string().contains("modified since read"));
    }

    #[test]
    fn rejects_binary_files() {
        let path = temp_path("binary-test.bin");
        std::fs::write(&path, b"\x00\x01\x02\x03binary content").expect("write should succeed");
        let result = read_file(path.to_string_lossy().as_ref(), None, None);
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.kind(), std::io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("binary"));
    }

    #[test]
    fn rejects_oversized_writes() {
        let path = temp_path("oversize-write.txt");
        let huge = "x".repeat(MAX_WRITE_SIZE + 1);
        let result = write_file(path.to_string_lossy().as_ref(), &huge);
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.kind(), std::io::ErrorKind::InvalidData);
        assert!(error.to_string().contains("too large"));
    }

    #[test]
    fn enforces_workspace_boundary() {
        let workspace = temp_path("workspace-boundary");
        std::fs::create_dir_all(&workspace).expect("workspace dir should be created");
        let inside = workspace.join("inside.txt");
        write_file(inside.to_string_lossy().as_ref(), "safe content")
            .expect("write inside workspace should succeed");

        // Reading inside workspace should succeed
        let result =
            read_file_in_workspace(inside.to_string_lossy().as_ref(), None, None, &workspace);
        assert!(result.is_ok());

        // Reading outside workspace should fail
        let outside = temp_path("outside-boundary.txt");
        write_file(outside.to_string_lossy().as_ref(), "unsafe content")
            .expect("write outside should succeed");
        let result =
            read_file_in_workspace(outside.to_string_lossy().as_ref(), None, None, &workspace);
        assert!(result.is_err());
        let error = result.unwrap_err();
        assert_eq!(error.kind(), std::io::ErrorKind::PermissionDenied);
        assert!(error.to_string().contains("escapes workspace"));
    }

    #[test]
    fn detects_symlink_escape() {
        let workspace = temp_path("symlink-workspace");
        std::fs::create_dir_all(&workspace).expect("workspace dir should be created");
        let outside = temp_path("symlink-target.txt");
        std::fs::write(&outside, "target content").expect("target should write");

        #[cfg(unix)]
        {
            let _link_path = workspace.join("escape-link.txt");
            std::os::unix::fs::symlink(&outside, &_link_path).expect("symlink should create");
            assert!(is_symlink_escape(&_link_path, &workspace).expect("check should succeed"));
        }

        // Non-symlink file should not be an escape
        let normal = workspace.join("normal.txt");
        std::fs::write(&normal, "normal content").expect("normal file should write");
        assert!(!is_symlink_escape(&normal, &workspace).expect("check should succeed"));
    }

    #[test]
    fn globs_and_greps_directory() {
        let dir = temp_path("search-dir");
        std::fs::create_dir_all(&dir).expect("directory should be created");
        let file = dir.join("demo.rs");
        write_file(
            file.to_string_lossy().as_ref(),
            "fn main() {\n println!(\"hello\");\n}\n",
        )
        .expect("file write should succeed");

        let globbed = glob_search("**/*.rs", Some(dir.to_string_lossy().as_ref()))
            .expect("glob should succeed");
        assert_eq!(globbed.num_files, 1);

        let grep_output = grep_search(&GrepSearchInput {
            pattern: String::from("hello"),
            path: Some(dir.to_string_lossy().into_owned()),
            glob: Some(String::from("**/*.rs")),
            output_mode: Some(String::from("content")),
            before: None,
            after: None,
            context_short: None,
            context: None,
            line_numbers: Some(true),
            case_insensitive: Some(false),
            file_type: None,
            head_limit: Some(10),
            offset: Some(0),
            multiline: Some(false),
        })
        .expect("grep should succeed");
        assert!(grep_output.content.unwrap_or_default().contains("hello"));
    }
}
