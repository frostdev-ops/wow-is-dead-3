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
            "natives/**".to_string(),
            ".mixin.out/**".to_string(),
            "logs/**".to_string(),
            "screenshots/**".to_string(),
            "server-resource-packs/**".to_string(),
            "assets/**".to_string(),
            "Xaero*".to_string(),
            "libraries/**".to_string(),
            "versions/**".to_string(),
            "modernfix/**".to_string(),
            "saves/**".to_string(),
            "xaero/**".to_string(),
            "*cache/**".to_string(),
            "data/**".to_string(),
            "ModTranslations/**".to_string(),
            "moddata/**".to_string(),
            "pfm/**".to_string(),
            "patchouli_books/**".to_string(),
            "local/**".to_string(),
            "emotes/**".to_string(),
            "schematics/**".to_string(),
            "defaultconfigs/**".to_string(),
            ".fabric/**".to_string(),
            ".cache/**".to_string(),
            "options.txt".to_string(),
            "emi.json".to_string(),
            "server.dat".to_string(),
            "iris*".to_string(),
            "user*".to_string(),
            "patchouli*".to_string(),
            "rhino*".to_string(),
            // User-customizable mod config files (case-sensitive variants)
            "config/xaerominimap*.txt".to_string(),      // Xaero's Minimap settings
            "config/xaeroworldmap*.txt".to_string(),     // Xaero's World Map settings
            "config/xaerominimap_entities.json".to_string(), // Minimap entity settings
            "config/xaeropatreon.txt".to_string(),       // Patreon settings
            "config/sodium-options.json".to_string(),    // Sodium video settings
            "config/fancymenu/options.txt".to_string(),  // FancyMenu settings
            "config/drippyloadingscreen/options.txt".to_string(), // Loading screen settings
            "config/ribbits-options.json".to_string(),   // Ribbits mod settings
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
