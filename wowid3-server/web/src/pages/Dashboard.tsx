import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAdmin } from '../hooks/useAdmin';
import './Dashboard.css';

interface UploadSession {
  uploadId: string;
  files: File[];
}

export default function Dashboard() {
  const { clearToken } = useAuthStore();
  const { loading, error, uploadFiles, createRelease, listReleases, deleteRelease, getBlacklist, updateBlacklist } = useAdmin();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'releases' | 'blacklist'>('dashboard');
  const [uploadSession, setUploadSession] = useState<UploadSession | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [releases, setReleases] = useState<any[]>([]);
  const [blacklistPatterns, setBlacklistPatterns] = useState<string[]>([]);
  const [newPattern, setNewPattern] = useState('');

  // Release form state
  const [releaseForm, setReleaseForm] = useState({
    version: '',
    minecraftVersion: '',
    fabricLoader: '',
    changelog: '',
  });

  useEffect(() => {
    if (activeTab === 'releases') {
      loadReleases();
    } else if (activeTab === 'blacklist') {
      loadBlacklist();
    }
  }, [activeTab]);

  const loadReleases = async () => {
    try {
      const data = await listReleases();
      setReleases(data);
    } catch {
      // Error handled by hook
    }
  };

  const loadBlacklist = async () => {
    try {
      const patterns = await getBlacklist();
      setBlacklistPatterns(patterns);
    } catch {
      // Error handled by hook
    }
  };

  const handleFileSelect = (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const files = e instanceof DragEvent ? (e as any).dataTransfer?.files : (e.target as HTMLInputElement).files;
    if (files) {
      setUploadSession({
        uploadId: '',
        files: Array.from(files),
      });
      setUploadError(null);
      setUploadSuccess(null);
    }
  };

  const handleUpload = async () => {
    if (!uploadSession?.files.length) return;

    try {
      const responses = await uploadFiles(uploadSession.files);
      if (responses.length > 0) {
        setUploadSession({ uploadId: responses[0].upload_id, files: uploadSession.files });
        setUploadSuccess(`Uploaded ${responses.length} files successfully`);
      }
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Upload failed');
    }
  };

  const handleCreateRelease = async () => {
    if (!uploadSession?.uploadId || !releaseForm.version) {
      setUploadError('Please fill all required fields');
      return;
    }

    try {
      await createRelease(
        uploadSession.uploadId,
        releaseForm.version,
        releaseForm.minecraftVersion,
        releaseForm.fabricLoader,
        releaseForm.changelog
      );
      setUploadSuccess('Release created successfully!');
      setReleaseForm({ version: '', minecraftVersion: '', fabricLoader: '', changelog: '' });
      setUploadSession(null);
      loadReleases();
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to create release');
    }
  };

  const handleDeleteRelease = async (version: string) => {
    if (confirm(`Are you sure you want to delete release ${version}?`)) {
      try {
        await deleteRelease(version);
        setUploadSuccess(`Release ${version} deleted successfully`);
        loadReleases();
      } catch (err: any) {
        setUploadError(err.response?.data?.error || 'Failed to delete release');
      }
    }
  };

  const handleAddBlacklistPattern = () => {
    if (newPattern && !blacklistPatterns.includes(newPattern)) {
      setBlacklistPatterns([...blacklistPatterns, newPattern]);
      setNewPattern('');
    }
  };

  const handleRemoveBlacklistPattern = (pattern: string) => {
    setBlacklistPatterns(blacklistPatterns.filter((p) => p !== pattern));
  };

  const handleSaveBlacklist = async () => {
    try {
      await updateBlacklist(blacklistPatterns);
      setUploadSuccess('Blacklist updated successfully');
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to save blacklist');
    }
  };

  return (
    <div className="app-layout">
      <div className="sidebar">
        <div className="sidebar-header">WOWID3</div>
        <nav className="sidebar-nav">
          <button
            className={`sidebar-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`sidebar-link ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Upload Files
          </button>
          <button
            className={`sidebar-link ${activeTab === 'releases' ? 'active' : ''}`}
            onClick={() => setActiveTab('releases')}
          >
            Manage Releases
          </button>
          <button
            className={`sidebar-link ${activeTab === 'blacklist' ? 'active' : ''}`}
            onClick={() => setActiveTab('blacklist')}
          >
            Blacklist
          </button>
        </nav>
        <button className="sidebar-logout" onClick={() => clearToken()}>
          Logout
        </button>
      </div>

      <div className="main-content">
        {activeTab === 'dashboard' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Dashboard</h1>
              <p className="page-description">Manage your modpack releases</p>
            </div>
            <div className="grid">
              <div className="stat-card">
                <div className="stat-value">{releases.length}</div>
                <div className="stat-label">Active Releases</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{blacklistPatterns.length}</div>
                <div className="stat-label">Blacklist Patterns</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Upload Files</h1>
              <p className="page-description">Upload modpack files for a new release</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {uploadError && <div className="alert alert-error">{uploadError}</div>}
            {uploadSuccess && <div className="alert alert-success">{uploadSuccess}</div>}

            {!uploadSession ? (
              <div className="card">
                <div className="upload-area" onDrop={handleFileSelect} onDragOver={(e) => e.preventDefault()}>
                  <input type="file" multiple hidden onChange={handleFileSelect} id="file-input" webkitdirectory="" />
                  <label htmlFor="file-input" className="upload-label">
                    <div className="upload-icon">📁</div>
                    <div className="upload-text">Drag files here or click to select</div>
                    <div className="upload-hint">Select a folder to upload all modpack files</div>
                  </label>
                </div>
              </div>
            ) : (
              <div className="card">
                <h3>Selected Files ({uploadSession.files.length})</h3>
                <div className="file-list">
                  {uploadSession.files.slice(0, 10).map((file, idx) => (
                    <div key={idx} className="file-item">
                      <span>{file.name}</span>
                      <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                  ))}
                  {uploadSession.files.length > 10 && <div className="file-item">... and {uploadSession.files.length - 10} more</div>}
                </div>

                {!uploadSession.uploadId ? (
                  <button className="btn-primary" onClick={handleUpload} disabled={loading}>
                    {loading ? 'Uploading...' : 'Upload Files'}
                  </button>
                ) : (
                  <div>
                    <div className="alert alert-success">Upload completed! Now create the release.</div>

                    <div className="form-group">
                      <label className="form-label">Version *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={releaseForm.version}
                        onChange={(e) => setReleaseForm({ ...releaseForm, version: e.target.value })}
                        placeholder="1.0.0"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Minecraft Version</label>
                      <input
                        type="text"
                        className="form-input"
                        value={releaseForm.minecraftVersion}
                        onChange={(e) => setReleaseForm({ ...releaseForm, minecraftVersion: e.target.value })}
                        placeholder="1.20.1"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Fabric Loader</label>
                      <input
                        type="text"
                        className="form-input"
                        value={releaseForm.fabricLoader}
                        onChange={(e) => setReleaseForm({ ...releaseForm, fabricLoader: e.target.value })}
                        placeholder="0.15.7"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Changelog</label>
                      <textarea
                        className="form-input"
                        value={releaseForm.changelog}
                        onChange={(e) => setReleaseForm({ ...releaseForm, changelog: e.target.value })}
                        placeholder="What's new in this release?"
                        rows={4}
                      />
                    </div>

                    <button className="btn-primary" onClick={handleCreateRelease} disabled={loading}>
                      {loading ? 'Creating...' : 'Create Release'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'releases' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Manage Releases</h1>
              <p className="page-description">View and manage existing releases</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {uploadSuccess && <div className="alert alert-success">{uploadSuccess}</div>}

            {releases.length === 0 ? (
              <div className="card">
                <p>No releases yet. Create one from the Upload Files section.</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Minecraft</th>
                    <th>Files</th>
                    <th>Size</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {releases.map((release) => (
                    <tr key={release.version}>
                      <td>
                        <span className="badge badge-success">{release.version}</span>
                      </td>
                      <td>{release.minecraft_version}</td>
                      <td>{release.file_count}</td>
                      <td>{(release.size_bytes / 1024 / 1024).toFixed(2)} MB</td>
                      <td>{new Date(release.created_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="btn-danger"
                          onClick={() => handleDeleteRelease(release.version)}
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'blacklist' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Blacklist Patterns</h1>
              <p className="page-description">Files matching these patterns won't be synced to clients</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {uploadSuccess && <div className="alert alert-success">{uploadSuccess}</div>}

            <div className="card">
              <div className="form-group">
                <label className="form-label">Add Pattern</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={newPattern}
                    onChange={(e) => setNewPattern(e.target.value)}
                    placeholder="e.g., optifine.txt or journeymap/**"
                    style={{ flex: 1 }}
                  />
                  <button className="btn-secondary" onClick={handleAddBlacklistPattern}>
                    Add
                  </button>
                </div>
              </div>

              {blacklistPatterns.length > 0 && (
                <div className="pattern-list">
                  <h3>Current Patterns</h3>
                  {blacklistPatterns.map((pattern) => (
                    <div key={pattern} className="pattern-item">
                      <span>{pattern}</span>
                      <button
                        className="btn-danger"
                        onClick={() => handleRemoveBlacklistPattern(pattern)}
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button className="btn-primary" onClick={handleSaveBlacklist} disabled={loading}>
                {loading ? 'Saving...' : 'Save Blacklist'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
