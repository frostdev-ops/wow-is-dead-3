import React from 'react';
import { createPortal } from 'react-dom';
import { Modal } from './ui/Modal';
import { Button } from './ui';
import { Package, AlertTriangle } from 'lucide-react';
import { useUpdateStore } from '../stores/updateStore';

interface ModpackUpdateDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const ModpackUpdateDialog: React.FC<ModpackUpdateDialogProps> = ({ onConfirm, onCancel }) => {
  const { modpackUpdate, showModpackUpdateDialog, setShowModpackUpdateDialog } = useUpdateStore();

  const handleConfirm = () => {
    setShowModpackUpdateDialog(false);
    onConfirm();
  };

  const handleCancel = () => {
    setShowModpackUpdateDialog(false);
    onCancel();
  };

  return createPortal(
    <Modal
      isOpen={showModpackUpdateDialog && !!modpackUpdate}
      onClose={handleCancel}
      size="md"
    >
      {modpackUpdate && (
        <>
          <Modal.Header>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-400" />
              </div>
              <Modal.Title>Modpack Update</Modal.Title>
            </div>
          </Modal.Header>

          <Modal.Body className="space-y-4">
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Update Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Current Version:</span>
                  <span className="text-gray-200 font-mono">
                    {modpackUpdate.currentVersion || 'Not Installed'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">New Version:</span>
                  <span className="text-blue-400 font-mono font-semibold">
                    {modpackUpdate.newVersion}
                  </span>
                </div>
              </div>
            </div>

            {modpackUpdate.changelog && (
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 max-h-48 overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">Changelog</h3>
                <p className="text-sm text-gray-400 whitespace-pre-wrap">
                  {modpackUpdate.changelog}
                </p>
              </div>
            )}

            <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-200">
                This update is required to play on the server. The game will update automatically when you click "Update Now".
              </p>
            </div>
          </Modal.Body>

          <Modal.Footer align="right">
            <Button
              onClick={handleCancel}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              variant="primary"
            >
              <Package className="w-4 h-4 mr-2" />
              Update Now
            </Button>
          </Modal.Footer>
        </>
      )}
    </Modal>,
    document.body
  );
};

export default ModpackUpdateDialog;
