use crate::config::Config;
use globset::{GlobBuilder, GlobSet, GlobSetBuilder};
use tokio::fs;

/// Load blacklist patterns from config file
pub async fn load_blacklist_patterns(config: &Config) -> anyhow::Result<Vec<String>> {
    let blacklist_path = config.blacklist_path();

    let patterns = if blacklist_path.exists() {
        let content = fs::read_to_string(&blacklist_path).await?;
        content
            .lines()
            .filter(|line| !line.trim().is_empty() && !line.trim().starts_with('#'))
            .map(|line| line.trim().to_string())
            .collect()
    } else {
        // Return default blacklist if file doesn't exist
        vec![
            "optifine.txt".to_string(),
            "options.txt".to_string(),
            "optionsof.txt".to_string(),
            "journeymap/**".to_string(),
            "xaerominimap/**".to_string(),
            "xyzmaps/**".to_string(),
        ]
    };

    Ok(patterns)
}

/// Compile glob patterns into a GlobSet for efficient matching
pub fn compile_patterns(patterns: &[String]) -> anyhow::Result<GlobSet> {
    let mut builder = GlobSetBuilder::new();

    for pattern in patterns {
        // Build glob pattern (case-insensitive on Windows, case-sensitive on Unix)
        let glob = GlobBuilder::new(pattern)
            .build()
            .map_err(|e| anyhow::anyhow!("Invalid glob pattern '{}': {}", pattern, e))?;

        builder.add(glob);
    }

    Ok(builder.build()?)
}

/// Check if a file path matches any blacklist pattern
pub fn is_blacklisted(path: &str, glob_set: &GlobSet) -> bool {
    glob_set.is_match(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pattern_matching() {
        let patterns = vec!["optifine.txt".to_string(), "journeymap/**".to_string()];
        let glob_set = compile_patterns(&patterns).unwrap();

        assert!(is_blacklisted("optifine.txt", &glob_set));
        assert!(is_blacklisted("journeymap/map.dat", &glob_set));
        assert!(is_blacklisted("journeymap/nested/file.txt", &glob_set));
        assert!(!is_blacklisted("mods/optifine.jar", &glob_set));
    }
}
