use crate::models::Manifest;
use lru::LruCache;
use serde::{Deserialize, Serialize};
use std::num::NonZeroUsize;
use std::sync::Arc;
use tokio::sync::RwLock;

const MANIFEST_CACHE_SIZE: usize = 50; // Cache up to 50 manifests

/// Cache statistics for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub manifest_cache_size: usize,
    pub manifest_cache_capacity: usize,
    pub manifest_hits: u64,
    pub manifest_misses: u64,
}

/// Global cache manager for server-wide caching
pub struct CacheManager {
    manifests: Arc<RwLock<LruCache<String, Arc<Manifest>>>>,
    manifest_hits: Arc<RwLock<u64>>,
    manifest_misses: Arc<RwLock<u64>>,
}

impl CacheManager {
    /// Create a new cache manager with default sizes
    pub fn new() -> Self {
        Self {
            manifests: Arc::new(RwLock::new(LruCache::new(
                NonZeroUsize::new(MANIFEST_CACHE_SIZE).unwrap(),
            ))),
            manifest_hits: Arc::new(RwLock::new(0)),
            manifest_misses: Arc::new(RwLock::new(0)),
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

    /// Clear all caches
    pub async fn clear_all(&self) {
        let mut manifest_cache = self.manifests.write().await;
        manifest_cache.clear();

        // Reset statistics
        *self.manifest_hits.write().await = 0;
        *self.manifest_misses.write().await = 0;

        tracing::info!("Cleared all caches");
    }

    /// Clear only manifest cache
    pub async fn clear_manifests(&self) {
        let mut cache = self.manifests.write().await;
        cache.clear();
        tracing::info!("Cleared manifest cache");
    }

    /// Clear JAR metadata cache (no-op: JAR caching removed)
    pub async fn clear_jar_metadata(&self) {
        tracing::info!("JAR metadata cache clearing requested (no-op: feature removed)");
    }

    /// Get cache statistics
    pub async fn get_stats(&self) -> CacheStats {
        let manifest_cache = self.manifests.read().await;

        CacheStats {
            manifest_cache_size: manifest_cache.len(),
            manifest_cache_capacity: manifest_cache.cap().get(),
            manifest_hits: *self.manifest_hits.read().await,
            manifest_misses: *self.manifest_misses.read().await,
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
            manifest_hits: Arc::clone(&self.manifest_hits),
            manifest_misses: Arc::clone(&self.manifest_misses),
        }
    }
}
