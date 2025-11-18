use crate::models::{Manifest, ModInfo};
use lru::LruCache;
use serde::{Deserialize, Serialize};
use std::num::NonZeroUsize;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

const MANIFEST_CACHE_SIZE: usize = 50; // Cache up to 50 manifests
const JAR_METADATA_CACHE_SIZE: usize = 500; // Cache up to 500 JAR metadata entries

/// Cache statistics for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub manifest_cache_size: usize,
    pub manifest_cache_capacity: usize,
    pub manifest_hits: u64,
    pub manifest_misses: u64,
    pub jar_cache_size: usize,
    pub jar_cache_capacity: usize,
    pub jar_hits: u64,
    pub jar_misses: u64,
}

/// Global cache manager for server-wide caching
pub struct CacheManager {
    manifests: Arc<RwLock<LruCache<String, Arc<Manifest>>>>,
    jar_metadata: Arc<RwLock<LruCache<PathBuf, Arc<ModInfo>>>>,
    manifest_hits: Arc<RwLock<u64>>,
    manifest_misses: Arc<RwLock<u64>>,
    jar_hits: Arc<RwLock<u64>>,
    jar_misses: Arc<RwLock<u64>>,
}

impl CacheManager {
    /// Create a new cache manager with default sizes
    pub fn new() -> Self {
        Self {
            manifests: Arc::new(RwLock::new(LruCache::new(
                NonZeroUsize::new(MANIFEST_CACHE_SIZE).unwrap(),
            ))),
            jar_metadata: Arc::new(RwLock::new(LruCache::new(
                NonZeroUsize::new(JAR_METADATA_CACHE_SIZE).unwrap(),
            ))),
            manifest_hits: Arc::new(RwLock::new(0)),
            manifest_misses: Arc::new(RwLock::new(0)),
            jar_hits: Arc::new(RwLock::new(0)),
            jar_misses: Arc::new(RwLock::new(0)),
        }
    }

    /// Get manifest from cache
    pub async fn get_manifest(&self, key: &str) -> Option<Arc<Manifest>> {
        let mut cache = self.manifests.write().await;
        if let Some(manifest) = cache.get(key) {
            *self.manifest_hits.write().await += 1;
            tracing::debug!("Manifest cache HIT for key: {}", key);
            Some(Arc::clone(manifest))
        } else {
            *self.manifest_misses.write().await += 1;
            tracing::debug!("Manifest cache MISS for key: {}", key);
            None
        }
    }

    /// Put manifest into cache
    pub async fn put_manifest(&self, key: String, manifest: Manifest) {
        let mut cache = self.manifests.write().await;
        cache.put(key.clone(), Arc::new(manifest));
        tracing::debug!("Cached manifest for key: {}", key);
    }

    /// Invalidate a specific manifest cache entry
    pub async fn invalidate_manifest(&self, key: &str) {
        let mut cache = self.manifests.write().await;
        cache.pop(key);
        tracing::debug!("Invalidated manifest cache for key: {}", key);
    }

    /// Get JAR metadata from cache
    pub async fn get_jar_metadata(&self, path: &PathBuf) -> Option<Arc<ModInfo>> {
        let mut cache = self.jar_metadata.write().await;
        if let Some(metadata) = cache.get(path) {
            *self.jar_hits.write().await += 1;
            tracing::debug!("JAR metadata cache HIT for: {}", path.display());
            Some(Arc::clone(metadata))
        } else {
            *self.jar_misses.write().await += 1;
            tracing::debug!("JAR metadata cache MISS for: {}", path.display());
            None
        }
    }

    /// Put JAR metadata into cache
    pub async fn put_jar_metadata(&self, path: PathBuf, metadata: ModInfo) {
        let mut cache = self.jar_metadata.write().await;
        cache.put(path.clone(), Arc::new(metadata));
        tracing::debug!("Cached JAR metadata for: {}", path.display());
    }

    /// Clear all caches
    pub async fn clear_all(&self) {
        let mut manifest_cache = self.manifests.write().await;
        let mut jar_cache = self.jar_metadata.write().await;

        manifest_cache.clear();
        jar_cache.clear();

        // Reset statistics
        *self.manifest_hits.write().await = 0;
        *self.manifest_misses.write().await = 0;
        *self.jar_hits.write().await = 0;
        *self.jar_misses.write().await = 0;

        tracing::info!("Cleared all caches");
    }

    /// Clear only manifest cache
    pub async fn clear_manifests(&self) {
        let mut cache = self.manifests.write().await;
        cache.clear();
        tracing::info!("Cleared manifest cache");
    }

    /// Clear only JAR metadata cache
    pub async fn clear_jar_metadata(&self) {
        let mut cache = self.jar_metadata.write().await;
        cache.clear();
        tracing::info!("Cleared JAR metadata cache");
    }

    /// Get cache statistics
    pub async fn get_stats(&self) -> CacheStats {
        let manifest_cache = self.manifests.read().await;
        let jar_cache = self.jar_metadata.read().await;

        CacheStats {
            manifest_cache_size: manifest_cache.len(),
            manifest_cache_capacity: manifest_cache.cap().get(),
            manifest_hits: *self.manifest_hits.read().await,
            manifest_misses: *self.manifest_misses.read().await,
            jar_cache_size: jar_cache.len(),
            jar_cache_capacity: jar_cache.cap().get(),
            jar_hits: *self.jar_hits.read().await,
            jar_misses: *self.jar_misses.read().await,
        }
    }

    /// Get hit rate for manifests
    pub async fn manifest_hit_rate(&self) -> f64 {
        let hits = *self.manifest_hits.read().await;
        let misses = *self.manifest_misses.read().await;
        let total = hits + misses;

        if total == 0 {
            0.0
        } else {
            (hits as f64 / total as f64) * 100.0
        }
    }

    /// Get hit rate for JAR metadata
    pub async fn jar_hit_rate(&self) -> f64 {
        let hits = *self.jar_hits.read().await;
        let misses = *self.jar_misses.read().await;
        let total = hits + misses;

        if total == 0 {
            0.0
        } else {
            (hits as f64 / total as f64) * 100.0
        }
    }
}

impl Default for CacheManager {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for CacheManager {
    fn clone(&self) -> Self {
        Self {
            manifests: Arc::clone(&self.manifests),
            jar_metadata: Arc::clone(&self.jar_metadata),
            manifest_hits: Arc::clone(&self.manifest_hits),
            manifest_misses: Arc::clone(&self.manifest_misses),
            jar_hits: Arc::clone(&self.jar_hits),
            jar_misses: Arc::clone(&self.jar_misses),
        }
    }
}
