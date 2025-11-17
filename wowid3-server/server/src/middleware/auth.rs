use axum::{
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;

pub struct AdminState {
    pub admin_password: Arc<String>,
}

/// Middleware to validate Bearer token authentication
pub async fn auth_middleware(
    mut request: Request,
    next: Next,
) -> Result<Response, (StatusCode, String)> {
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    match auth_header {
        Some(auth) if auth.starts_with("Bearer ") => {
            let token = auth[7..].to_string(); // Remove "Bearer " prefix
            request.extensions_mut().insert(AdminToken(token));
            Ok(next.run(request).await)
        }
        _ => Err((
            StatusCode::UNAUTHORIZED,
            "Missing or invalid Authorization header".to_string(),
        )),
    }
}

#[derive(Clone)]
pub struct AdminToken(pub String);
