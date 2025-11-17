import { useEffect, useRef, useState } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

export function LogViewer() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const scrollToBottom = () => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Load initial logs
    axios
      .get<string[]>(`${API_BASE}/logs?tail=100`)
      .then((response) => {
        setLogs(response.data);
        scrollToBottom();
      })
      .catch((error) => {
        console.error("Failed to load logs:", error);
      });

    // Connect to SSE stream
    const eventSource = new EventSource(`${API_BASE}/logs/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    eventSource.onmessage = (event) => {
      setLogs((prev) => {
        const newLogs = [...prev, event.data];
        // Keep only last 1000 lines
        return newLogs.slice(-1000);
      });
      scrollToBottom();
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const formatLogLine = (line: string) => {
    // Color code different log types
    if (line.includes("[STDOUT]")) {
      return "text-green-400";
    } else if (line.includes("[STDERR]")) {
      return "text-red-400";
    } else if (line.includes("[CMD]")) {
      return "text-yellow-400";
    } else if (line.includes("ERROR") || line.includes("error")) {
      return "text-red-500";
    } else if (line.includes("WARN") || line.includes("warn")) {
      return "text-yellow-500";
    }
    return "text-gray-300";
  };

  return (
    <div className="bg-christmas-darkBg border border-christmas-green rounded-lg p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-christmas-snow">Server Logs</h2>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          ></div>
          <span className="text-sm text-gray-400">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-black rounded-lg p-4 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-gray-500">No logs available</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={formatLogLine(log)}>
              {log}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

