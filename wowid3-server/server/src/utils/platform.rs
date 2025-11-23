use axum::http::HeaderMap;

/// Detect platform from User-Agent header
pub fn detect_platform_from_user_agent(headers: &HeaderMap) -> Option<String> {
    let user_agent = headers
        .get(axum::http::header::USER_AGENT)?
        .to_str()
        .ok()?;

    if user_agent.contains("Windows") {
        Some("windows".to_string())
    } else if user_agent.contains("Linux") || user_agent.contains("X11") {
        Some("linux".to_string())
    } else if user_agent.contains("Macintosh") || user_agent.contains("Mac OS") {
        Some("macos".to_string())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderValue};

    #[test]
    fn test_detect_windows() {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::USER_AGENT,
            HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        );
        assert_eq!(detect_platform_from_user_agent(&headers), Some("windows".to_string()));
    }

    #[test]
    fn test_detect_linux() {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::USER_AGENT,
            HeaderValue::from_static("Mozilla/5.0 (X11; Linux x86_64)")
        );
        assert_eq!(detect_platform_from_user_agent(&headers), Some("linux".to_string()));
    }

    #[test]
    fn test_detect_macos() {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::USER_AGENT,
            HeaderValue::from_static("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
        );
        assert_eq!(detect_platform_from_user_agent(&headers), Some("macos".to_string()));
    }

    #[test]
    fn test_detect_unknown() {
        let mut headers = HeaderMap::new();
        headers.insert(
            axum::http::header::USER_AGENT,
            HeaderValue::from_static("Unknown/1.0")
        );
        assert_eq!(detect_platform_from_user_agent(&headers), None);
    }
}
