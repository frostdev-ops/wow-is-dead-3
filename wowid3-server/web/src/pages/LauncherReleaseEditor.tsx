import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

interface LauncherReleaseForm {
  version: string;
  changelog: string;
  mandatory: boolean;
  windowsInstaller: File | null;
  windowsExecutable: File | null;
  linuxAppImage: File | null;
}

export function LauncherReleaseEditor() {
  const navigate = useNavigate();
  const [form, setForm] = useState<LauncherReleaseForm>({
    version: '',
    changelog: '',
    mandatory: false,
    windowsInstaller: null,
    windowsExecutable: null,
    linuxAppImage: null,
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('version', form.version);
      formData.append('changelog', form.changelog);
      formData.append('mandatory', form.mandatory.toString());

      if (form.windowsInstaller) {
        formData.append('windows_installer', form.windowsInstaller);
      }
      if (form.windowsExecutable) {
        formData.append('windows_executable', form.windowsExecutable);
      }
      if (form.linuxAppImage) {
        formData.append('linux_appimage', form.linuxAppImage);
      }

      await api.post('/admin/launcher/releases', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      navigate('/admin/launcher');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload release');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Create Launcher Release</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Version */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Version (e.g., 1.2.0)
          </label>
          <input
            type="text"
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
            className="w-full px-3 py-2 border rounded"
            required
            placeholder="1.2.0"
          />
        </div>

        {/* Changelog */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Changelog
          </label>
          <textarea
            value={form.changelog}
            onChange={(e) => setForm({ ...form, changelog: e.target.value })}
            className="w-full px-3 py-2 border rounded"
            rows={6}
            required
            placeholder="- Feature: Added new functionality&#10;- Fix: Resolved bug"
          />
        </div>

        {/* Mandatory */}
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={form.mandatory}
              onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm font-medium">Mandatory Update</span>
          </label>
        </div>

        {/* Windows Installer */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Windows Installer (.exe from bundle/nsis/)
          </label>
          <input
            type="file"
            accept=".exe"
            onChange={(e) =>
              setForm({ ...form, windowsInstaller: e.target.files?.[0] || null })
            }
            className="w-full"
          />
          {form.windowsInstaller && (
            <p className="text-sm text-gray-600 mt-1">
              {form.windowsInstaller.name} ({(form.windowsInstaller.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {/* Windows Executable */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Windows Executable (.exe from target/release/)
          </label>
          <input
            type="file"
            accept=".exe"
            onChange={(e) =>
              setForm({ ...form, windowsExecutable: e.target.files?.[0] || null })
            }
            className="w-full"
          />
          {form.windowsExecutable && (
            <p className="text-sm text-gray-600 mt-1">
              {form.windowsExecutable.name} ({(form.windowsExecutable.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {/* Linux AppImage */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Linux AppImage (.AppImage from bundle/appimage/)
          </label>
          <input
            type="file"
            accept=".AppImage"
            onChange={(e) =>
              setForm({ ...form, linuxAppImage: e.target.files?.[0] || null })
            }
            className="w-full"
          />
          {form.linuxAppImage && (
            <p className="text-sm text-gray-600 mt-1">
              {form.linuxAppImage.name} ({(form.linuxAppImage.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={uploading}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {uploading ? 'Uploading...' : 'Create Release'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/launcher')}
            className="px-6 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
