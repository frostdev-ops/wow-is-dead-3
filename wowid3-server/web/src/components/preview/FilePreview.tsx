import { useState, useEffect } from 'react';
import { X, Download, FileText, Image as ImageIcon, Code, File } from 'lucide-react';
import Editor from '@monaco-editor/react';
import './FilePreview.css';

interface FilePreviewProps {
  draftId: string;
  filePath: string;
  fileName: string;
  onClose: () => void;
}

type FileType = 'image' | 'code' | 'text' | 'json' | 'binary';

const getFileType = (fileName: string): FileType => {
  const ext = fileName.toLowerCase().split('.').pop() || '';

  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
  const codeExts = ['js', 'ts', 'tsx', 'jsx', 'java', 'kt', 'py', 'rs', 'go', 'c', 'cpp', 'h', 'hpp'];
  const configExts = ['json', 'json5', 'toml', 'yaml', 'yml', 'xml', 'properties', 'cfg', 'conf', 'ini'];
  const textExts = ['txt', 'md', 'log'];

  if (imageExts.includes(ext)) return 'image';
  if (codeExts.includes(ext)) return 'code';
  if (configExts.includes(ext)) return 'json';
  if (textExts.includes(ext)) return 'text';
  return 'binary';
};

const getLanguageFromExtension = (fileName: string): string => {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'json': 'json',
    'json5': 'json',
    'java': 'java',
    'kt': 'kotlin',
    'py': 'python',
    'rs': 'rust',
    'go': 'go',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'toml': 'toml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'html': 'html',
    'css': 'css',
    'md': 'markdown',
    'properties': 'properties',
    'cfg': 'ini',
    'conf': 'ini',
    'ini': 'ini',
    'txt': 'plaintext',
    'log': 'plaintext',
  };
  return languageMap[ext] || 'plaintext';
};

export default function FilePreview({ draftId, filePath, fileName, onClose }: FilePreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [binaryData, setBinaryData] = useState<ArrayBuffer | null>(null);
  const fileType = getFileType(fileName);
  const authToken = localStorage.getItem('auth_token');

  useEffect(() => {
    loadFile();
  }, [draftId, filePath]);

  const loadFile = async () => {
    setLoading(true);
    setError(null);

    try {
      if (fileType === 'image' || fileType === 'binary') {
        // Load as binary for images and binary files
        const response = await fetch(`/api/admin/drafts/${draftId}/read-file?path=${encodeURIComponent(filePath)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (!response.ok) {
          throw new Error(`Failed to load file: ${response.statusText}`);
        }

        // For images, we'll use the API URL directly
        if (fileType === 'image') {
          setContent(`/api/admin/drafts/${draftId}/read-file?path=${encodeURIComponent(filePath)}`);
        } else {
          // For binary files, read as array buffer for hex view
          const arrayBuffer = await response.arrayBuffer();
          setBinaryData(arrayBuffer);
        }
      } else {
        // Load as text
        const response = await fetch(`/api/admin/drafts/${draftId}/read-file?path=${encodeURIComponent(filePath)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (!response.ok) {
          throw new Error(`Failed to load file: ${response.statusText}`);
        }

        const data = await response.json();
        setContent(data.content || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load file');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/admin/drafts/${draftId}/read-file?path=${encodeURIComponent(filePath)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Failed to download file');
    }
  };

  const renderBinaryPreview = () => {
    if (!binaryData) return null;

    const bytes = new Uint8Array(binaryData);
    const maxBytes = 512; // Show first 512 bytes
    const displayBytes = bytes.slice(0, maxBytes);

    const hexLines: string[] = [];
    const asciiLines: string[] = [];

    for (let i = 0; i < displayBytes.length; i += 16) {
      const lineBytes = displayBytes.slice(i, i + 16);
      const hex = Array.from(lineBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      const ascii = Array.from(lineBytes)
        .map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
        .join('');

      hexLines.push(`${i.toString(16).padStart(8, '0')}: ${hex.padEnd(48, ' ')} | ${ascii}`);
    }

    return (
      <div className="binary-preview">
        <div className="binary-preview-header">
          <span>Hex View (first {maxBytes} bytes of {bytes.length})</span>
        </div>
        <pre className="binary-preview-content">
          {hexLines.join('\n')}
        </pre>
        {bytes.length > maxBytes && (
          <div className="binary-preview-footer">
            ... and {bytes.length - maxBytes} more bytes
          </div>
        )}
      </div>
    );
  };

  const getFileIcon = () => {
    switch (fileType) {
      case 'image': return <ImageIcon size={20} />;
      case 'code': return <Code size={20} />;
      case 'json': return <Code size={20} />;
      case 'text': return <FileText size={20} />;
      default: return <File size={20} />;
    }
  };

  return (
    <div className="file-preview-modal" onClick={onClose}>
      <div className="file-preview-content" onClick={(e) => e.stopPropagation()}>
        <div className="file-preview-header">
          <div className="file-preview-title">
            {getFileIcon()}
            <span>{fileName}</span>
            <span className="file-preview-path">{filePath}</span>
          </div>
          <div className="file-preview-actions">
            <button onClick={handleDownload} className="btn-icon" title="Download">
              <Download size={18} />
            </button>
            <button onClick={onClose} className="btn-icon" title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="file-preview-body">
          {loading && (
            <div className="file-preview-loading">
              <div className="spinner"></div>
              <p>Loading file...</p>
            </div>
          )}

          {error && (
            <div className="file-preview-error">
              <p>Error: {error}</p>
              <button onClick={loadFile} className="btn-primary">Retry</button>
            </div>
          )}

          {!loading && !error && fileType === 'image' && (
            <div className="image-preview">
              <img
                src={content}
                alt={fileName}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            </div>
          )}

          {!loading && !error && (fileType === 'code' || fileType === 'json') && (
            <div className="code-preview">
              <Editor
                height="100%"
                language={getLanguageFromExtension(fileName)}
                value={content}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  wordWrap: 'on',
                }}
              />
            </div>
          )}

          {!loading && !error && fileType === 'text' && (
            <div className="text-preview">
              <pre>{content}</pre>
            </div>
          )}

          {!loading && !error && fileType === 'binary' && renderBinaryPreview()}
        </div>

        <div className="file-preview-footer">
          <span>File size: {content.length || binaryData?.byteLength || 0} bytes</span>
          <span>Type: {fileType}</span>
        </div>
      </div>
    </div>
  );
}
