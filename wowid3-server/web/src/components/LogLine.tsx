import { memo } from "react";
import { motion } from "framer-motion";

export interface LogEntry {
  id: number;
  text: string;
}

function getClassForLine(text: string): string {
  if (text.includes("[STDOUT]")) return "text-green-400";
  if (text.includes("[STDERR]")) return "text-red-400";
  if (text.includes("[CMD]")) return "text-yellow-400";
  if (text.includes("ERROR") || text.includes("error")) return "text-red-500";
  if (text.includes("WARN") || text.includes("warn")) return "text-yellow-500";
  return "text-gray-300";
}

export const LogLine = memo(function LogLine({ entry }: { entry: LogEntry }) {
  const cls = getClassForLine(entry.text);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, margin: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.2 }}
      className={`${cls} whitespace-pre-wrap`}
    >
      {entry.text}
    </motion.div>
  );
});
