import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

interface LauncherVersion {
  version: string;
  files: Array<{
    platform: string;
    file_type: string;
    filename: string;
    size: number;
  }>;
  changelog: string;
  mandatory: boolean;
  released_at: string;
}

export function LauncherReleasesList() {
  const [versions, setVersions] = useState<LauncherVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = async () => {
    try {
      const response = await api.get('/admin/launcher/releases');
      setVersions(response.data);
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Launcher Releases</h1>
        <Link
          to="/admin/launcher/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create New Release
        </Link>
      </div>

      <div className="space-y-4">
        {versions.map((version) => (
          <div
            key={version.version}
            className="border rounded-lg p-4 hover:shadow-lg transition"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="text-xl font-bold">
                  Version {version.version}
                  {version.mandatory && (
                    <span className="ml-2 text-sm bg-red-100 text-red-800 px-2 py-1 rounded">
                      Mandatory
                    </span>
                  )}
                </h2>
                <p className="text-sm text-gray-600">
                  Released: {new Date(version.released_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="mb-3">
              <h3 className="font-semibold mb-1">Files:</h3>
              <ul className="text-sm space-y-1">
                {version.files.map((file, idx) => (
                  <li key={idx} className="text-gray-700">
                    {file.platform} ({file.file_type}): {file.filename} (
                    {(file.size / 1024 / 1024).toFixed(2)} MB)
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-1">Changelog:</h3>
              <pre className="text-sm bg-gray-50 p-2 rounded whitespace-pre-wrap">
                {version.changelog}
              </pre>
            </div>
          </div>
        ))}

        {versions.length === 0 && (
          <div className="text-center text-gray-600 py-12">
            No launcher releases yet. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
