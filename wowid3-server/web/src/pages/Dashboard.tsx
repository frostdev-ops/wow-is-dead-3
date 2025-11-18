import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAdmin } from '../hooks/useAdmin';
import { useFileUpload } from '../hooks/useFileUpload';
import { useReleaseOperations } from '../hooks/useReleaseOperations';
import { useDrafts } from '../hooks/useDrafts';
import DraftList from '../components/drafts/DraftList';
import ReleaseList from '../components/releases/ReleaseList';
import FileUploadZone from '../components/uploads/FileUploadZone';
import UploadProgress from '../components/uploads/UploadProgress';
import FileBrowser from '../components/FileBrowser';
import './Dashboard.css';

export default function Dashboard() {
  const { clearToken } = useAuthStore();
  const { getBlacklist, updateBlacklist, createRelease } = useAdmin();
  const { releases } = useReleaseOperations();
  const { getDraft, updateDraft: updateDraftAPI, publishDraft } = useDrafts();
  const { uploadFiles, uploadProgress, uploading, uploadResults, getTotalProgress } = useFileUpload();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'releases' | 'release-wizard' | 'edit-draft' | 'blacklist'>('dashboard');
  const [editingDraft, setEditingDraft] = useState<any>(null);
  const [editingTab, setEditingTab] = useState<'files' | 'metadata' | 'changelog' | 'review'>('metadata');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
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
    if (activeTab === 'blacklist') {
      loadBlacklist();
    }
  }, [activeTab]);

  const loadBlacklist = async () => {
    try {
      const patterns = await getBlacklist();
      setBlacklistPatterns(patterns);
    } catch {
      // Error handled by hook
    }
  };

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    setUploadError(null);
    setUploadSuccess(null);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    const results = await uploadFiles(selectedFiles);
    if (results && results.length > 0) {
      setUploadSuccess(`Uploaded ${results.length} files successfully`);
    } else {
      setUploadError('Upload failed');
    }
  };

  const handleCreateRelease = async () => {
    if (!uploadResults || uploadResults.length === 0 || !releaseForm.version) {
      setUploadError('Please upload files and fill all required fields');
      return;
    }

    try {
      await createRelease(
        uploadResults[0].upload_id,
        releaseForm.version,
        releaseForm.minecraftVersion,
        releaseForm.fabricLoader,
        releaseForm.changelog
      );
      setUploadSuccess('Release created successfully!');
      setReleaseForm({ version: '', minecraftVersion: '', fabricLoader: '', changelog: '' });
      setSelectedFiles([]);
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to create release');
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

  const handlePublishDraft = async () => {
    if (!editingDraft) return;

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

            {uploadError && <div className="alert alert-error">{uploadError}</div>}
            {uploadSuccess && <div className="alert alert-success">{uploadSuccess}</div>}

            {selectedFiles.length === 0 ? (
              <FileUploadZone
                onFilesSelected={handleFilesSelected}
                multiple={true}
                webkitdirectory={true}
              />
            ) : (
              <div className="card">
                <h3>Selected Files ({selectedFiles.length})</h3>
                <div className="file-list">
                  {selectedFiles.slice(0, 10).map((file, idx) => (
                    <div key={idx} className="file-item">
                      <span>{file.name}</span>
                      <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                  ))}
                  {selectedFiles.length > 10 && (
                    <div className="file-item">... and {selectedFiles.length - 10} more</div>
                  )}
                </div>

                {!uploadResults || uploadResults.length === 0 ? (
                  <>
                    <button className="btn-primary" onClick={handleUpload} disabled={uploading}>
                      {uploading ? 'Uploading...' : 'Upload Files'}
                    </button>
                    {uploadProgress.length > 0 && (
                      <UploadProgress files={uploadProgress} totalProgress={getTotalProgress()} />
                    )}
                  </>
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

                    <button className="btn-primary" onClick={handleCreateRelease}>
                      Create Release
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

            {uploadSuccess && <div className="alert alert-success">{uploadSuccess}</div>}

            <ReleaseList />
          </div>
        )}

        {activeTab === 'release-wizard' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Release Wizard</h1>
              <p className="page-description">Create and manage modpack releases with intelligent suggestions</p>
            </div>

            {uploadSuccess && <div className="alert alert-success">{uploadSuccess}</div>}

            <DraftList onEditDraft={handleEditDraft} />
          </div>
        )}

        {activeTab === 'edit-draft' && editingDraft && (
          <div>
            <div className="page-header">
              <h1 className="page-title">{editingDraft.version || 'Untitled Draft'}</h1>
              <p className="page-description">Edit your modpack release</p>
            </div>

            {uploadSuccess && <div className="alert alert-success">{uploadSuccess}</div>}

            <div className="card">
              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '2px solid #007bff', marginBottom: '20px', marginLeft: '-16px', marginRight: '-16px', paddingLeft: '16px' }}>
                {(['metadata', 'files', 'changelog', 'review'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setEditingTab(tab)}
                    style={{
                      padding: '12px 24px',
                      border: 'none',
                      background: editingTab === tab ? '#007bff' : 'transparent',
                      color: editingTab === tab ? '#fff' : '#a0a0a0',
                      cursor: 'pointer',
                      fontWeight: editingTab === tab ? 600 : 500,
                      fontSize: '14px',
                      transition: 'all 0.2s ease',
                      textTransform: 'capitalize',
                    }}
                  >
                    {tab}
                  </button>
                ))}
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
                  <h3 style={{ marginTop: 0, color: '#fff', marginBottom: '16px' }}>
                    File Browser - Interactive Directory Management
                  </h3>
                  <FileBrowser
                    draftId={editingDraft.id}
                    onFileChange={async () => {
                      const draft = await getDraft(editingDraft.id);
                      if (draft) {
                        setEditingDraft(draft);
                      }
                    }}
                  />
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
                      disabled={!editingDraft.version || !editingDraft.minecraft_version || !editingDraft.fabric_loader || !editingDraft.files?.length}
                    >
                      🚀 Publish Release
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        setActiveTab('release-wizard');
                        setEditingDraft(null);
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

            {uploadError && <div className="alert alert-error">{uploadError}</div>}
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

              <button className="btn-primary" onClick={handleSaveBlacklist}>
                Save Blacklist
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
