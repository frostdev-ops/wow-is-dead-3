import ReactMarkdown from 'react-markdown';

interface ChangelogViewerProps {
  changelog: string;
  className?: string;
  emptyMessage?: string;
}

export default function ChangelogViewer({
  changelog,
  className = '',
  emptyMessage = 'No changelog available',
}: ChangelogViewerProps) {
  if (!changelog || changelog.trim() === '') {
    return (
      <div className={`changelog-viewer-empty ${className}`} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`changelog-viewer ${className}`}>
      <ReactMarkdown>{changelog}</ReactMarkdown>
    </div>
  );
}
