import JSZip from 'jszip';

export async function exportReleaseAsZip(releaseData: any, files: any[]): Promise<void> {
  const zip = new JSZip();

  // Add manifest.json
  zip.file('manifest.json', JSON.stringify(releaseData, null, 2));

  // Add metadata
  const metadata = {
    version: releaseData.version,
    minecraft_version: releaseData.minecraft_version,
    fabric_loader: releaseData.fabric_loader,
    changelog: releaseData.changelog,
    exported_at: new Date().toISOString(),
  };
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  // Note: Files would need to be downloaded from the server
  // This is a simplified version - full implementation would fetch files

  // Generate and download ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `release-${releaseData.version}.zip`);
}

export async function exportDraftAsJSON(draftData: any): Promise<void> {
  const json = JSON.stringify(draftData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `draft-${draftData.version || 'untitled'}.json`);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function bulkDownloadFiles(files: { path: string; name: string }[], draftId: string, authToken: string): Promise<void> {
  const zip = new JSZip();

  for (const file of files) {
    try {
      const response = await fetch(`/api/admin/drafts/${draftId}/read-file?path=${encodeURIComponent(file.path)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        zip.file(file.path, blob);
      }
    } catch (error) {
      console.error(`Failed to download ${file.path}:`, error);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `files-${draftId}-${Date.now()}.zip`);
}

export async function importDraftFromJSON(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        resolve(json);
      } catch (error) {
        reject(new Error('Invalid JSON file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// Backup all drafts
export async function backupDrafts(drafts: any[]): Promise<void> {
  const backup = {
    version: '1.0',
    exported_at: new Date().toISOString(),
    drafts,
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `drafts-backup-${new Date().toISOString().split('T')[0]}.json`);
}

// Restore drafts from backup
export async function restoreDrafts(file: File): Promise<any[]> {
  const data = await importDraftFromJSON(file);

  if (!data.drafts || !Array.isArray(data.drafts)) {
    throw new Error('Invalid backup file format');
  }

  return data.drafts;
}
