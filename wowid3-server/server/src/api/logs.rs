use axum::{
    extract::{Query, State},
    response::{sse::Event, IntoResponse, Sse},
    routing::get,
    Router,
};
use serde::Deserialize;
use std::convert::Infallible;
use std::sync::Arc;
use tokio_stream::{Stream, StreamExt};

use crate::modules::server_manager::ServerManager;

#[derive(Deserialize)]
pub struct LogQuery {
    tail: Option<usize>,
}

pub fn router() -> Router<Arc<ServerManager>> {
    Router::new()
        .route("/", get(get_logs))
        .route("/stream", get(stream_logs))
}

async fn get_logs(
    Query(params): Query<LogQuery>,
    State(manager): State<Arc<ServerManager>>,
) -> impl IntoResponse {
    let logs = manager.get_logs(params.tail).await;
    axum::Json(logs)
}

async fn stream_logs(
    State(manager): State<Arc<ServerManager>>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Send initial logs
    let initial_logs = manager.get_logs(None).await;
    for log in initial_logs {
        let _ = tx.send(log);
    }

    // Spawn task to periodically check for new logs
    let manager_clone = Arc::clone(&manager);
    tokio::spawn(async move {
        let mut last_count = 0;
        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(500));
        loop {
            interval.tick().await;
            let logs = manager_clone.get_logs(None).await;
            if logs.len() > last_count {
                // Send only new logs
                for log in logs.iter().skip(last_count) {
                    if tx.send(log.clone()).is_err() {
                        return;
                    }
                }
                last_count = logs.len();
            }
        }
    });

    let stream = tokio_stream::wrappers::UnboundedReceiverStream::new(rx)
        .map(|log| Ok(Event::default().data(log)));

    Sse::new(stream)
}

