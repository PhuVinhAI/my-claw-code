// Context Generator Tool for AI
// Adapted from MasterContext project
use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::fmt::Write as FmtWrite;
use std::fs;
use std::path::Path;

lazy_static! {
    static ref HASH_COMMENT: Regex = Regex::new(r"#.*").unwrap();
    static ref HTML_XML_COMMENT: Regex = Regex::new(r"(?s)<!--.*?-->").unwrap();
    static ref SQL_LUA_COMMENT: Regex = Regex::new(r"--.*").unwrap();
    static ref VBNET_COMMENT: Regex = Regex::new(r"'.*").unwrap();
    static ref LISP_COMMENT: Regex = Regex::new(r";.*").unwrap();
    static ref ERLANG_COMMENT: Regex = Regex::new(r"%.*").unwrap();

    // Regex to find common debug log statements across multiple languages
    static ref DEBUG_LOG_REGEX: Regex = Regex::new(concat!(
        r"(?im)^\s*(?:",
        r"console\.(?:log|warn|error|info|debug|trace|assert|dir|dirxml|table|time(?:End|Log)?|count(?:Reset)?|group(?:End|Collapsed)?|clear|profile(?:End)?)\s*\(.*\);?", // JS/TS
        r"|println!\s*\(.*\);?|dbg!\s*\(.*\);?", // Rust
        r"|print\s*\(.*\)", // Python, Swift
        r"|(?:var_dump|print_r)\s*\(.*\);?", // PHP
        r"|System\.out\.println\s*\(.*\);?", // Java
        r"|Console\.WriteLine\s*\(.*\);?", // C#
        r"|fmt\.Println\s*\(.*\)", // Go
        r"|(?:puts|p|pp)\s+.*", // Ruby
        r")\s*\r?\n?"
    )).unwrap();
}

fn remove_c_style_comments(content: &str) -> String {
    let mut result = String::with_capacity(content.len());
    let chars: Vec<char> = content.chars().collect();
    let len = chars.len();
    let mut i = 0;
    let mut in_string = false;
    let mut string_char = ' ';
    let mut in_single_comment = false;
    let mut in_multi_comment = false;
    let mut escape = false;

    while i < len {
        let c = chars[i];
        let next_c = if i + 1 < len { chars[i + 1] } else { '\0' };

        if in_single_comment {
            if c == '\n' {
                in_single_comment = false;
                result.push(c);
            }
            i += 1;
            continue;
        }

        if in_multi_comment {
            if c == '*' && next_c == '/' {
                in_multi_comment = false;
                i += 2;
            } else {
                i += 1;
            }
            continue;
        }

        if escape {
            result.push(c);
            escape = false;
            i += 1;
            continue;
        }

        if c == '\\' && in_string {
            escape = true;
            result.push(c);
            i += 1;
            continue;
        }

        if c == '"' || c == '\'' || c == '`' {
            if !in_string {
                in_string = true;
                string_char = c;
            } else if c == string_char {
                in_string = false;
            }
            result.push(c);
            i += 1;
            continue;
        }

        if c == '/' && !in_string {
            if next_c == '/' {
                in_single_comment = true;
                i += 2;
                continue;
            } else if next_c == '*' {
                in_multi_comment = true;
                i += 2;
                continue;
            }
        }

        result.push(c);
        i += 1;
    }
    result
}

fn remove_comments_from_content(content: &str, file_rel_path: &str) -> String {
    let extension = Path::new(file_rel_path)
        .extension()
        .and_then(std::ffi::OsStr::to_str)
        .unwrap_or("");

    let processed_content = match extension {
        // Chú thích kiểu C (// và /* */) được xử lý bằng State Machine
        "js" | "jsx" | "ts" | "tsx" | "rs" | "go" | "c" | "cpp" | "h" | "java" | "cs" | "swift"
        | "kt" | "css" | "scss" | "less" | "jsonc" | "glsl" | "dart" | "gd" => {
            remove_c_style_comments(content)
        }
        // Chú thích bằng dấu thăng (#)
        "py" | "rb" | "sh" | "yml" | "yaml" | "toml" | "dockerfile" | "gitignore" | "r" | "pl"
        | "pm" | "ps1" | "el" => HASH_COMMENT.replace_all(content, "").to_string(),
        // Chú thích kiểu HTML/XML (<!-- -->)
        "html" | "xml" | "svg" | "md" => HTML_XML_COMMENT.replace_all(content, "").to_string(),
        // Chú thích kiểu SQL/Lua (--)
        "sql" | "lua" | "hs" | "ada" => SQL_LUA_COMMENT.replace_all(content, "").to_string(),
        // Chú thích kiểu Lisp (;)
        "lisp" | "cl" | "scm" => LISP_COMMENT.replace_all(content, "").to_string(),
        // Chú thích kiểu Erlang (%)
        "erl" | "hrl" => ERLANG_COMMENT.replace_all(content, "").to_string(),
        // Chú thích kiểu VB (')
        "vb" | "vbs" => VBNET_COMMENT.replace_all(content, "").to_string(),
        // Ngôn ngữ hỗn hợp
        "php" => {
            let temp = remove_c_style_comments(content);
            HASH_COMMENT.replace_all(&temp, "").to_string()
        }
        "vue" | "astro" => {
            let temp = HTML_XML_COMMENT.replace_all(content, "");
            remove_c_style_comments(&temp)
        }
        _ => content.to_string(),
    };

    // Loại bỏ các dòng trống được tạo ra sau khi xóa comment
    processed_content
        .lines()
        .filter(|line| !line.trim().is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn remove_debug_logs_from_content(content: &str) -> String {
    // Replace found debug logs with an empty string
    DEBUG_LOG_REGEX.replace_all(content, "").to_string()
}

fn format_tree(tree: &BTreeMap<String, FsEntry>, prefix: &str, output: &mut String) {
    let mut entries = tree.iter().peekable();
    while let Some((name, entry)) = entries.next() {
        let is_last = entries.peek().is_none();
        let connector = if is_last { "└── " } else { "├── " };
        match entry {
            FsEntry::File => {
                let _ = writeln!(output, "{}{}{}", prefix, connector, name);
            }
            FsEntry::Directory(children) => {
                let _ = writeln!(output, "{}{}{}/", prefix, connector, name);
                let new_prefix = format!("{}{}", prefix, if is_last { "    " } else { "│   " });
                format_tree(children, &new_prefix, output);
            }
        }
    }
}

// Simple structs for context generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FsEntry {
    File,
    Directory(BTreeMap<String, FsEntry>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextOptions {
    pub with_line_numbers: bool,
    pub without_comments: bool,
    pub remove_debug_logs: bool,
    pub exclude_extensions: Vec<String>,
}

impl Default for ContextOptions {
    fn default() -> Self {
        Self {
            with_line_numbers: false,
            without_comments: false,
            remove_debug_logs: false,
            exclude_extensions: vec![],
        }
    }
}

// Main function to generate context from files
pub fn generate_context_from_files(
    root_path_str: &str,
    file_paths: &[String],
    options: &ContextOptions,
) -> Result<String, String> {
    let root_path = Path::new(root_path_str);
    let mut tree_builder_root = BTreeMap::new();

    // Build minimal directory tree from file paths
    for rel_path_str in file_paths {
        let rel_path = Path::new(rel_path_str);
        let mut current_level = &mut tree_builder_root;
        
        if let Some(components) = rel_path.parent() {
            for component in components.components() {
                let component_str = component.as_os_str().to_string_lossy().into_owned();
                current_level = match current_level
                    .entry(component_str)
                    .or_insert(FsEntry::Directory(BTreeMap::new()))
                {
                    FsEntry::Directory(children) => children,
                    _ => unreachable!(),
                };
            }
        }
        
        if let Some(file_name) = rel_path.file_name() {
            let file_name_str = file_name.to_string_lossy().into_owned();
            current_level.insert(file_name_str, FsEntry::File);
        }
    }

    let exclude_set: HashSet<_> = options
        .exclude_extensions
        .iter()
        .map(|s| s.as_str())
        .collect();

    // Format directory tree
    let mut directory_structure = String::new();
    format_tree(&tree_builder_root, "", &mut directory_structure);

    // Generate file contents and calculate token count
    let mut file_contents_string = String::new();
    let mut sorted_files = file_paths.to_vec();
    sorted_files.sort();
    let mut total_token_count = 0;

    let final_files: Vec<_> = sorted_files
        .into_iter()
        .filter(|file_rel_path| {
            let extension = Path::new(file_rel_path)
                .extension()
                .and_then(std::ffi::OsStr::to_str)
                .unwrap_or("");
            !exclude_set.contains(extension)
        })
        .collect();

    for file_rel_path in final_files {
        let file_path = root_path.join(&file_rel_path);
        if let Ok(content) = fs::read_to_string(&file_path) {
            let mut processed_content = content;

            if options.without_comments {
                processed_content =
                    remove_comments_from_content(&processed_content, &file_rel_path);
            }

            if options.remove_debug_logs {
                processed_content = remove_debug_logs_from_content(&processed_content);
            }

            let header = format!(
                "================================================\nFILE: {}\n================================================\n",
                file_rel_path.replace("\\", "/")
            );
            file_contents_string.push_str(&header);
            
            if options.with_line_numbers {
                for (i, line) in processed_content.lines().enumerate() {
                    let _ = writeln!(file_contents_string, "{}: {}", i + 1, line);
                }
            } else {
                file_contents_string.push_str(&processed_content);
            }
            file_contents_string.push_str("\n\n");
            
            // Calculate token count (char_count / 4.0)
            let char_count = processed_content.chars().count();
            let token_count = (char_count as f64 / 4.0).ceil() as usize;
            total_token_count += token_count;
        }
    }

    let final_context = format!(
        "Directory structure:\n{}\n\n{}",
        directory_structure, file_contents_string
    );

    Ok(final_context)
}
