/// Smart string replacement strategies for edit operations.
/// Inspired by Kilocode's AI-native tooling approach.

use std::cmp::min;

/// Similarity thresholds for block anchor fallback matching
const SINGLE_CANDIDATE_SIMILARITY_THRESHOLD: f64 = 0.0;
const MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD: f64 = 0.3;

/// Result of a replacement attempt
#[derive(Debug, Clone)]
pub struct ReplacementMatch {
    pub start: usize,
    pub end: usize,
    pub matched_text: String,
}

/// Trait for different replacement strategies
pub trait Replacer {
    fn name(&self) -> &'static str;
    fn find_matches(&self, content: &str, search: &str) -> Vec<ReplacementMatch>;
}

/// Simple exact string matching
pub struct SimpleReplacer;

impl Replacer for SimpleReplacer {
    fn name(&self) -> &'static str {
        "SimpleReplacer"
    }

    fn find_matches(&self, content: &str, search: &str) -> Vec<ReplacementMatch> {
        let mut matches = Vec::new();
        let mut start = 0;
        
        while let Some(pos) = content[start..].find(search) {
            let absolute_pos = start + pos;
            matches.push(ReplacementMatch {
                start: absolute_pos,
                end: absolute_pos + search.len(),
                matched_text: search.to_string(),
            });
            start = absolute_pos + search.len();
        }
        
        matches
    }
}

/// Line-trimmed matching - ignores leading/trailing whitespace per line
pub struct LineTrimmedReplacer;

impl LineTrimmedReplacer {
    /// Calculate byte position of a line in the original content
    fn calculate_line_byte_position(content: &str, line_index: usize) -> usize {
        let mut byte_pos = 0;
        let mut current_line = 0;
        
        for (i, _) in content.char_indices() {
            if current_line >= line_index {
                return byte_pos;
            }
            if content[i..].starts_with('\n') {
                current_line += 1;
                byte_pos = i + 1; // Position after \n
            }
        }
        
        byte_pos
    }
    
    /// Extract the actual text span from content between two line indices
    fn extract_line_span(content: &str, start_line: usize, end_line: usize) -> (usize, usize, String) {
        let _lines: Vec<&str> = content.lines().collect();
        
        // Find byte position of start line
        let mut byte_pos = 0;
        let mut current_line = 0;
        let mut start_byte = 0;
        
        for (i, ch) in content.char_indices() {
            if current_line == start_line {
                start_byte = byte_pos;
                break;
            }
            if ch == '\n' {
                current_line += 1;
                byte_pos = i + 1;
            }
        }
        
        // Find byte position of end line (inclusive)
        let mut end_byte = content.len();
        current_line = 0;
        
        for (i, ch) in content.char_indices() {
            if current_line == end_line {
                // Find end of this line
                if let Some(newline_pos) = content[i..].find('\n') {
                    end_byte = i + newline_pos;
                } else {
                    end_byte = content.len();
                }
                break;
            }
            if ch == '\n' {
                current_line += 1;
            }
        }
        
        let matched_text = content[start_byte..end_byte].to_string();
        (start_byte, end_byte, matched_text)
    }
}

impl Replacer for LineTrimmedReplacer {
    fn name(&self) -> &'static str {
        "LineTrimmedReplacer"
    }

    fn find_matches(&self, content: &str, search: &str) -> Vec<ReplacementMatch> {
        let mut matches = Vec::new();
        let content_lines: Vec<&str> = content.lines().collect();
        let mut search_lines: Vec<&str> = search.lines().collect();
        
        // Remove trailing empty line if present
        if search_lines.last().map_or(false, |l| l.is_empty()) {
            search_lines.pop();
        }
        
        if search_lines.is_empty() {
            return matches;
        }
        
        for i in 0..=content_lines.len().saturating_sub(search_lines.len()) {
            let mut all_match = true;
            
            for j in 0..search_lines.len() {
                if content_lines[i + j].trim() != search_lines[j].trim() {
                    all_match = false;
                    break;
                }
            }
            
            if all_match {
                // Calculate byte positions correctly
                let end_line = i + search_lines.len() - 1;
                let (start, end, matched_text) = Self::extract_line_span(content, i, end_line);
                
                matches.push(ReplacementMatch {
                    start,
                    end,
                    matched_text,
                });
            }
        }
        
        matches
    }
}

/// Block anchor matching - uses first/last lines as anchors with fuzzy middle
pub struct BlockAnchorReplacer;

impl BlockAnchorReplacer {
    /// Levenshtein distance algorithm
    fn levenshtein(a: &str, b: &str) -> usize {
        if a.is_empty() {
            return b.len();
        }
        if b.is_empty() {
            return a.len();
        }
        
        let a_chars: Vec<char> = a.chars().collect();
        let b_chars: Vec<char> = b.chars().collect();
        let a_len = a_chars.len();
        let b_len = b_chars.len();
        
        let mut matrix = vec![vec![0; b_len + 1]; a_len + 1];
        
        for i in 0..=a_len {
            matrix[i][0] = i;
        }
        for j in 0..=b_len {
            matrix[0][j] = j;
        }
        
        for i in 1..=a_len {
            for j in 1..=b_len {
                let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
                matrix[i][j] = min(
                    min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1),
                    matrix[i - 1][j - 1] + cost,
                );
            }
        }
        
        matrix[a_len][b_len]
    }
    
    fn calculate_similarity(original: &str, search: &str) -> f64 {
        let max_len = original.len().max(search.len());
        if max_len == 0 {
            return 1.0;
        }
        let distance = Self::levenshtein(original, search);
        1.0 - (distance as f64 / max_len as f64)
    }
}

impl Replacer for BlockAnchorReplacer {
    fn name(&self) -> &'static str {
        "BlockAnchorReplacer"
    }

    fn find_matches(&self, content: &str, search: &str) -> Vec<ReplacementMatch> {
        let mut matches = Vec::new();
        let content_lines: Vec<&str> = content.lines().collect();
        let mut search_lines: Vec<&str> = search.lines().collect();
        
        // Need at least 3 lines for block anchor
        if search_lines.len() < 3 {
            return matches;
        }
        
        if search_lines.last().map_or(false, |l| l.is_empty()) {
            search_lines.pop();
        }
        
        let first_line = search_lines[0].trim();
        let last_line = search_lines[search_lines.len() - 1].trim();
        
        // Find all candidates with matching first and last lines
        let mut candidates = Vec::new();
        
        for i in 0..content_lines.len() {
            if content_lines[i].trim() != first_line {
                continue;
            }
            
            // Look for matching last line
            for j in (i + 2)..content_lines.len() {
                if content_lines[j].trim() == last_line {
                    candidates.push((i, j));
                    break;
                }
            }
        }
        
        if candidates.is_empty() {
            return matches;
        }
        
        // Single candidate - use relaxed threshold
        if candidates.len() == 1 {
            let (start_line, end_line) = candidates[0];
            let actual_block_size = end_line - start_line + 1;
            let lines_to_check = min(search_lines.len() - 2, actual_block_size - 2);
            
            let mut similarity = 0.0;
            if lines_to_check > 0 {
                for j in 1..min(search_lines.len() - 1, actual_block_size - 1) {
                    let original_line = content_lines[start_line + j].trim();
                    let search_line = search_lines[j].trim();
                    similarity += Self::calculate_similarity(original_line, search_line);
                    
                    // Early exit if threshold reached
                    if similarity / lines_to_check as f64 >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD {
                        break;
                    }
                }
                similarity /= lines_to_check as f64;
            } else {
                similarity = 1.0; // No middle lines, accept based on anchors
            }
            
            if similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD {
                // Use helper to extract correct byte positions
                let (start, end, matched_text) = LineTrimmedReplacer::extract_line_span(content, start_line, end_line);
                
                matches.push(ReplacementMatch {
                    start,
                    end,
                    matched_text,
                });
            }
            
            return matches;
        }
        
        // Multiple candidates - find best match
        let mut best_match: Option<(usize, usize, f64)> = None;
        
        for &(start_line, end_line) in &candidates {
            let actual_block_size = end_line - start_line + 1;
            let lines_to_check = min(search_lines.len() - 2, actual_block_size - 2);
            
            let mut similarity = 0.0;
            if lines_to_check > 0 {
                for j in 1..min(search_lines.len() - 1, actual_block_size - 1) {
                    let original_line = content_lines[start_line + j].trim();
                    let search_line = search_lines[j].trim();
                    similarity += Self::calculate_similarity(original_line, search_line);
                }
                similarity /= lines_to_check as f64;
            } else {
                similarity = 1.0;
            }
            
            if let Some((_, _, max_sim)) = best_match {
                if similarity > max_sim {
                    best_match = Some((start_line, end_line, similarity));
                }
            } else {
                best_match = Some((start_line, end_line, similarity));
            }
        }
        
        if let Some((start_line, end_line, similarity)) = best_match {
            if similarity >= MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD {
                // Use helper to extract correct byte positions
                let (start, end, matched_text) = LineTrimmedReplacer::extract_line_span(content, start_line, end_line);
                
                matches.push(ReplacementMatch {
                    start,
                    end,
                    matched_text,
                });
            }
        }
        
        matches
    }
}

/// Whitespace-normalized matching - treats all whitespace as equivalent
pub struct WhitespaceNormalizedReplacer;

impl WhitespaceNormalizedReplacer {
    fn normalize_whitespace(text: &str) -> String {
        text.split_whitespace().collect::<Vec<_>>().join(" ")
    }
}

impl Replacer for WhitespaceNormalizedReplacer {
    fn name(&self) -> &'static str {
        "WhitespaceNormalizedReplacer"
    }

    fn find_matches(&self, content: &str, search: &str) -> Vec<ReplacementMatch> {
        let mut matches = Vec::new();
        let normalized_search = Self::normalize_whitespace(search);
        
        // Try single-line matches
        let content_lines: Vec<&str> = content.lines().collect();
        for (line_idx, line) in content_lines.iter().enumerate() {
            if Self::normalize_whitespace(line) == normalized_search {
                let (start, end, matched_text) = LineTrimmedReplacer::extract_line_span(content, line_idx, line_idx);
                matches.push(ReplacementMatch {
                    start,
                    end,
                    matched_text,
                });
            }
        }
        
        // Try multi-line matches
        let search_lines: Vec<&str> = search.lines().collect();
        if search_lines.len() > 1 {
            for i in 0..=content_lines.len().saturating_sub(search_lines.len()) {
                let block = content_lines[i..i + search_lines.len()].join("\n");
                if Self::normalize_whitespace(&block) == normalized_search {
                    let end_line = i + search_lines.len() - 1;
                    let (start, end, matched_text) = LineTrimmedReplacer::extract_line_span(content, i, end_line);
                    
                    matches.push(ReplacementMatch {
                        start,
                        end,
                        matched_text,
                    });
                }
            }
        }
        
        matches
    }
}

/// Indentation-flexible matching - ignores absolute indentation levels
pub struct IndentationFlexibleReplacer;

impl IndentationFlexibleReplacer {
    fn remove_indentation(text: &str) -> String {
        let lines: Vec<&str> = text.lines().collect();
        let non_empty: Vec<&str> = lines.iter().copied().filter(|l| !l.trim().is_empty()).collect();
        
        if non_empty.is_empty() {
            return text.to_string();
        }
        
        let min_indent = non_empty
            .iter()
            .map(|line| line.len() - line.trim_start().len())
            .min()
            .unwrap_or(0);
        
        lines
            .iter()
            .map(|line| {
                if line.trim().is_empty() {
                    *line
                } else {
                    &line[min_indent.min(line.len())..]
                }
            })
            .collect::<Vec<_>>()
            .join("\n")
    }
}

impl Replacer for IndentationFlexibleReplacer {
    fn name(&self) -> &'static str {
        "IndentationFlexibleReplacer"
    }

    fn find_matches(&self, content: &str, search: &str) -> Vec<ReplacementMatch> {
        let mut matches = Vec::new();
        let normalized_search = Self::remove_indentation(search);
        let content_lines: Vec<&str> = content.lines().collect();
        let search_lines: Vec<&str> = search.lines().collect();
        
        for i in 0..=content_lines.len().saturating_sub(search_lines.len()) {
            let block = content_lines[i..i + search_lines.len()].join("\n");
            if Self::remove_indentation(&block) == normalized_search {
                let end_line = i + search_lines.len() - 1;
                let (start, end, matched_text) = LineTrimmedReplacer::extract_line_span(content, i, end_line);
                
                matches.push(ReplacementMatch {
                    start,
                    end,
                    matched_text,
                });
            }
        }
        
        matches
    }
}

/// Get all replacers in order from strict to relaxed
pub fn get_replacers() -> Vec<Box<dyn Replacer>> {
    vec![
        Box::new(SimpleReplacer),
        Box::new(LineTrimmedReplacer),
        Box::new(BlockAnchorReplacer),
        Box::new(WhitespaceNormalizedReplacer),
        Box::new(IndentationFlexibleReplacer),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_replacer_finds_exact_match() {
        let replacer = SimpleReplacer;
        let content = "hello world\nhello rust";
        let matches = replacer.find_matches(content, "hello");
        assert_eq!(matches.len(), 2);
    }

    #[test]
    fn line_trimmed_handles_whitespace() {
        let replacer = LineTrimmedReplacer;
        let content = "  hello  \n  world  ";
        let matches = replacer.find_matches(content, "hello\nworld");
        assert_eq!(matches.len(), 1);
    }

    #[test]
    fn block_anchor_fuzzy_match() {
        let replacer = BlockAnchorReplacer;
        let content = "start\nmiddle line\nend";
        let matches = replacer.find_matches(content, "start\nmiddle\nend");
        // Should find match despite "middle line" vs "middle" difference
        assert!(!matches.is_empty());
    }

    #[test]
    fn whitespace_normalized_matches() {
        let replacer = WhitespaceNormalizedReplacer;
        let content = "hello    world";
        let matches = replacer.find_matches(content, "hello world");
        assert_eq!(matches.len(), 1);
    }

    #[test]
    fn indentation_flexible_matches() {
        let replacer = IndentationFlexibleReplacer;
        let content = "    fn test() {\n        println!(\"hi\");\n    }";
        let matches = replacer.find_matches(content, "fn test() {\n    println!(\"hi\");\n}");
        assert_eq!(matches.len(), 1);
    }
}
