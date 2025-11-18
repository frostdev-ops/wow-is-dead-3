import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAdmin } from '../hooks/useAdmin';
import { useDrafts } from '../hooks/useDrafts';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import './Dashboard.css';

interface UploadSession {
  uploadId: string;
  files: File[];
}

export default function Dashboard() {
  const { clearToken } = useAuthStore();
  const { loading, error, uploadFiles, createRelease, listReleases, deleteRelease, getBlacklist, updateBlacklist } = useAdmin();
  const { drafts, listDrafts, createDraft, getDraft, updateDraft: updateDraftAPI, deleteDraft: deleteDraftAPI, publishDraft, loading: draftLoading } = useDrafts();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'releases' | 'release-wizard' | 'edit-draft' | 'blacklist'>('dashboard');
  const [draftFilter, setDraftFilter] = useState<'all' | 'drafts'>('all');
  const [editingDraft, setEditingDraft] = useState<any>(null);
  const [editingTab, setEditingTab] = useState<'files' | 'metadata' | 'changelog' | 'review'>('metadata');
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
    } else if (activeTab === 'release-wizard') {
      listDrafts();
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

  const handleCreateDraft = async () => {
    const draft = await createDraft({});
    if (draft) {
      setUploadSuccess(`Draft created: ${draft.version || 'Untitled'}`);
      listDrafts();
    }
  };

  const handleDeleteDraft = async (id: string, version: string) => {
    if (confirm(`Delete draft ${version || 'Untitled Draft'}?`)) {
      await deleteDraftAPI(id);
      setUploadSuccess('Draft deleted');
      listDrafts();
    }
  };

  const handleEditDraft = async (id: string) => {
    const draft = await getDraft(id);
    if (draft) {
      setEditingDraft(draft);
      setEditingTab('metadata');
      setActiveTab('edit-draft');
    }
  };

  const handleUpdateDraft = async (updates: any) => {
    if (!editingDraft) return;
    const updated = { ...editingDraft, ...updates };
    setEditingDraft(updated);
    await updateDraftAPI(editingDraft.id, updates);
    setUploadSuccess('Draft saved');
  };

  const handleFileUpload = async (files: FileList) => {
    if (!editingDraft || files.length === 0) return;

    setUploadError(null);
    const formData = new FormData();

    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    try {
      // Step 1: Upload files to get upload_id
      const uploadResponse = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const uploadData = await uploadResponse.json();
      if (!uploadData || uploadData.length === 0) {
        throw new Error('No upload_id received from server');
      }

      const upload_id = uploadData[0].upload_id;

      // Step 2: Add files to draft using upload_id
      const addFilesResponse = await fetch(`/api/admin/drafts/${editingDraft.id}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ upload_id })
      });

      if (!addFilesResponse.ok) {
        throw new Error(`Failed to add files to draft: ${addFilesResponse.statusText}`);
      }

      const updatedDraft = await addFilesResponse.json();
      setEditingDraft(updatedDraft);
      setUploadSuccess(`${files.length} file(s) uploaded successfully`);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload files');
    }
  };

  const handleRemoveFile = async (filePath: string) => {
    if (!editingDraft) return;

    try {
      const response = await fetch(`/api/admin/drafts/${editingDraft.id}/files/${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Remove failed: ${response.statusText}`);
      }

      const updatedDraft = await response.json();
      setEditingDraft(updatedDraft);
      setUploadSuccess('File removed successfully');
    } catch (err: any) {
      setUploadError(err.message || 'Failed to remove file');
    }
  };

  const handlePublishDraft = async () => {
    if (!editingDraft) return;

    // Validate required fields
    if (!editingDraft.version || !editingDraft.minecraft_version || !editingDraft.fabric_loader) {
      setUploadError('Please fill in all required fields: Version, Minecraft Version, and Fabric Loader');
      return;
    }

    if (!editingDraft.files || editingDraft.files.length === 0) {
      setUploadError('Please upload at least one file before publishing');
      return;
    }

    if (!confirm(`Publish release ${editingDraft.version}? This will make it the latest version available to players.`)) {
      return;
    }

    const success = await publishDraft(editingDraft.id);
    if (success) {
      setUploadSuccess(`Release ${editingDraft.version} published successfully!`);
      setEditingDraft(null);
      setActiveTab('release-wizard');
      listDrafts();
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
            className={`sidebar-link ${activeTab === 'release-wizard' ? 'active' : ''}`}
            onClick={() => setActiveTab('release-wizard')}
          >
            Release Wizard
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

        {activeTab === 'release-wizard' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Release Wizard</h1>
              <p className="page-description">Create and manage modpack releases with intelligent suggestions</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {draftLoading && <div className="alert alert-info">Loading drafts...</div>}
            {uploadSuccess && <div className="alert alert-success">{uploadSuccess}</div>}

            <div className="card">
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>Drafts ({drafts.length})</h2>
                <button className="btn-primary" onClick={handleCreateDraft} disabled={draftLoading}>
                  {draftLoading ? 'Creating...' : '+ Create New Draft'}
                </button>
              </div>

              {drafts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  <Package style={{ width: '48px', height: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                  <p style={{ fontSize: '16px', marginBottom: '16px' }}>No drafts yet</p>
                  <button className="btn-primary" onClick={handleCreateDraft}>
                    Create Your First Draft
                  </button>
                </div>
              ) : (
                <div>
                  {drafts.map((draft) => (
                    <div key={draft.id} style={{
                      padding: '16px',
                      borderBottom: '1px solid #eee',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>
                          {draft.version || 'Untitled Draft'}
                        </h3>
                        <div style={{ fontSize: '12px', color: '#999', display: 'flex', gap: '16px' }}>
                          {draft.minecraft_version && <span>Minecraft {draft.minecraft_version}</span>}
                          {draft.fabric_loader && <span>Fabric {draft.fabric_loader}</span>}
                          <span>{draft.files.length} files</span>
                          <span>Updated {formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleEditDraft(draft.id)}>
                          <Edit style={{ width: '16px', height: '16px', marginRight: '4px' }} /> Edit
                        </button>
                        <button className="btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleDeleteDraft(draft.id, draft.version)}>
                          <Trash2 style={{ width: '16px', height: '16px', marginRight: '4px' }} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'edit-draft' && editingDraft && (
          <div>
            <div className="page-header">
              <h1 className="page-title">{editingDraft.version || 'Untitled Draft'}</h1>
              <p className="page-description">Edit your modpack release</p>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {uploadSuccess && <div className="alert alert-success">{uploadSuccess}</div>}

            <div className="card">
              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '2px solid #007bff', marginBottom: '20px', marginLeft: '-16px', marginRight: '-16px', paddingLeft: '16px' }}>
                <button
                  onClick={() => setEditingTab('metadata')}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    background: editingTab === 'metadata' ? '#007bff' : 'transparent',
                    color: editingTab === 'metadata' ? '#fff' : '#a0a0a0',
                    cursor: 'pointer',
                    fontWeight: editingTab === 'metadata' ? 600 : 500,
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Metadata
                </button>
                <button
                  onClick={() => setEditingTab('files')}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    background: editingTab === 'files' ? '#007bff' : 'transparent',
                    color: editingTab === 'files' ? '#fff' : '#a0a0a0',
                    cursor: 'pointer',
                    fontWeight: editingTab === 'files' ? 600 : 500,
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Files
                </button>
                <button
                  onClick={() => setEditingTab('changelog')}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    background: editingTab === 'changelog' ? '#007bff' : 'transparent',
                    color: editingTab === 'changelog' ? '#fff' : '#a0a0a0',
                    cursor: 'pointer',
                    fontWeight: editingTab === 'changelog' ? 600 : 500,
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Changelog
                </button>
                <button
                  onClick={() => setEditingTab('review')}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    background: editingTab === 'review' ? '#007bff' : 'transparent',
                    color: editingTab === 'review' ? '#fff' : '#a0a0a0',
                    cursor: 'pointer',
                    fontWeight: editingTab === 'review' ? 600 : 500,
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Review
                </button>
              </div>

              {/* Tab Content */}
              {editingTab === 'metadata' && (
                <div style={{ paddingTop: '10px' }}>
                  <h3 style={{ marginTop: 0, color: '#fff' }}>Release Metadata</h3>
                  <div className="form-group">
                    <label className="form-label">Version</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingDraft.version || ''}
                      onChange={(e) => handleUpdateDraft({ version: e.target.value })}
                      placeholder="1.0.0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Minecraft Version</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingDraft.minecraft_version || ''}
                      onChange={(e) => handleUpdateDraft({ minecraft_version: e.target.value })}
                      placeholder="1.20.1"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fabric Loader</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingDraft.fabric_loader || ''}
                      onChange={(e) => handleUpdateDraft({ fabric_loader: e.target.value })}
                      placeholder="0.15.0"
                    />
                  </div>
                </div>
              )}

              {editingTab === 'files' && (
                <div style={{ paddingTop: '10px' }}>
                  <h3 style={{ marginTop: 0, color: '#fff' }}>Files ({editingDraft.files?.length || 0})</h3>

                  {/* Upload Area */}
                  <div style={{
                    border: loading ? '2px solid #007bff' : '2px dashed #007bff',
                    borderRadius: '4px',
                    padding: '20px',
                    textAlign: 'center',
                    marginBottom: '20px',
                    backgroundColor: loading ? '#1a2332' : '#0f0f1e',
                    cursor: loading ? 'wait' : 'pointer',
                    color: '#a0a0a0',
                    opacity: loading ? 0.7 : 1
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (loading) return;
                    const files = e.dataTransfer.files;
                    handleFileUpload(files);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => !loading && document.getElementById('file-upload-input')?.click()}
                  >
                    <input
                      id="file-upload-input"
                      type="file"
                      multiple
                      accept=".zip,.jar,.json,.toml,.txt,*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && !loading) {
                          handleFileUpload(e.target.files);
                        }
                      }}
                    />
                    {loading ? (
                      <>
                        <p style={{ margin: '0 0 8px 0', color: '#007bff', fontWeight: 600 }}>
                          ⏳ Uploading files...
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                          Please wait, this may take a while for large files
                        </p>
                      </>
                    ) : (
                      <>
                        <p style={{ margin: '0 0 8px 0', color: '#007bff', fontWeight: 500 }}>
                          📁 Drag and drop .zip files here or click to browse
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                          Zip files are auto-extracted. Folders must be zipped first!
                        </p>
                      </>
                    )}
                  </div>

                  {/* File List */}
                  {editingDraft.files && editingDraft.files.length > 0 ? (
                    <div>
                      <h4 style={{ marginTop: '16px', marginBottom: '8px', color: '#555' }}>Uploaded Files</h4>
                      <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                        {editingDraft.files.map((file: any) => (
                          <div key={file.path} style={{
                            padding: '12px',
                            borderBottom: '1px solid #eee',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ margin: '0 0 4px 0', fontWeight: 500, color: '#333' }}>{file.path}</p>
                              <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <button
                              className="btn-danger"
                              style={{ padding: '4px 8px', fontSize: '12px', marginLeft: '8px' }}
                              onClick={() => handleRemoveFile(file.path)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: '#999', textAlign: 'center', marginTop: '20px' }}>No files uploaded yet</p>
                  )}
                </div>
              )}

              {editingTab === 'changelog' && (
                <div style={{ paddingTop: '10px' }}>
                  <h3 style={{ marginTop: 0, color: '#fff' }}>Changelog</h3>
                  <textarea
                    className="form-input"
                    style={{ minHeight: '200px' }}
                    value={editingDraft.changelog || ''}
                    onChange={(e) => handleUpdateDraft({ changelog: e.target.value })}
                    placeholder="Enter your changelog..."
                  />
                </div>
              )}

              {editingTab === 'review' && (
                <div style={{ paddingTop: '10px' }}>
                  <h3 style={{ marginTop: 0, color: '#fff' }}>Review Before Publishing</h3>
                  <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '4px', marginTop: '16px', border: '1px solid #333' }}>
                    <p style={{ color: '#a0a0a0', marginBottom: '8px' }}><strong style={{ color: '#fff' }}>Version:</strong> {editingDraft.version || '(not set)'}</p>
                    <p style={{ color: '#a0a0a0', marginBottom: '8px' }}><strong style={{ color: '#fff' }}>Minecraft:</strong> {editingDraft.minecraft_version || '(not set)'}</p>
                    <p style={{ color: '#a0a0a0', marginBottom: '8px' }}><strong style={{ color: '#fff' }}>Fabric Loader:</strong> {editingDraft.fabric_loader || '(not set)'}</p>
                    <p style={{ color: '#a0a0a0', marginBottom: '8px' }}><strong style={{ color: '#fff' }}>Files:</strong> {editingDraft.files?.length || 0}</p>
                    <p style={{ color: '#a0a0a0' }}><strong style={{ color: '#fff' }}>Changelog:</strong> {editingDraft.changelog ? `${editingDraft.changelog.substring(0, 50)}...` : '(not set)'}</p>
                  </div>

                  {/* Validation warnings */}
                  {(!editingDraft.version || !editingDraft.minecraft_version || !editingDraft.fabric_loader || !editingDraft.files?.length) && (
                    <div className="alert alert-error" style={{ marginTop: '16px' }}>
                      <strong>Missing required fields:</strong>
                      <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                        {!editingDraft.version && <li>Version number</li>}
                        {!editingDraft.minecraft_version && <li>Minecraft version</li>}
                        {!editingDraft.fabric_loader && <li>Fabric loader version</li>}
                        {!editingDraft.files?.length && <li>At least one file</li>}
                      </ul>
                    </div>
                  )}

                  <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                    <button
                      className="btn-primary"
                      style={{
                        flex: 1,
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        fontSize: '16px',
                        padding: '12px 24px'
                      }}
                      onClick={handlePublishDraft}
                      disabled={loading || draftLoading || !editingDraft.version || !editingDraft.minecraft_version || !editingDraft.fabric_loader || !editingDraft.files?.length}
                    >
                      {loading || draftLoading ? '🚀 Publishing...' : '🚀 Publish Release'}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setActiveTab('release-wizard');
                        setEditingDraft(null);
                        listDrafts();
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Back Button */}
              <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #333' }}>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setActiveTab('release-wizard');
                    setEditingDraft(null);
                    listDrafts();
                  }}
                >
                  Back to Drafts
                </button>
              </div>
            </div>
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
