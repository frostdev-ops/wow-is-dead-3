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
) -> Sse<impl Stream<Item = Result<Event, Infallible>> + Send + 'static> {
    let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Send initial logs (limit to prevent huge initial send)
    let initial_logs = manager.get_logs(Some(100)).await;
    for log in initial_logs {
        let _ = tx.send(log); // Ignore errors, receiver might have disconnected
    }

    // Spawn task to periodically check for new logs
    let manager_clone = Arc::clone(&manager);
    let tx_clone = tx.clone();
    tokio::spawn(async move {
        let mut last_count = manager_clone.get_logs(None).await.len();
        let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(1000)); // Increased to 1s
        
        loop {
            interval.tick().await;
            
            // Check if receiver is still alive before doing work
            if tx_clone.is_closed() {
                break;
            }
            
            let logs = manager_clone.get_logs(None).await;
            if logs.len() > last_count {
                // Send only new logs
                for log in logs.iter().skip(last_count) {
                    if tx_clone.send(log.clone()).is_err() {
                        // Receiver dropped, stop
                        return;
                    }
                }
                last_count = logs.len();
            }
        }
    });

    let stream = tokio_stream::wrappers::UnboundedReceiverStream::new(rx)
        .map(|log| Ok::<Event, Infallible>(Event::default().data(log)));

    Sse::new(stream)
}

