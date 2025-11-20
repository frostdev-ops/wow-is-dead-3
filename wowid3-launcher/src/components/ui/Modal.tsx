/**
 * Compound Modal Component
 *
 * Usage:
 * <Modal isOpen={isOpen} onClose={onClose}>
 *   <Modal.Header>
 *     <Modal.Title>My Modal Title</Modal.Title>
 *   </Modal.Header>
 *   <Modal.Body>
 *     Content goes here
 *   </Modal.Body>
 *   <Modal.Footer>
 *     <Button onClick={onClose}>Cancel</Button>
 *     <Button variant="primary">Confirm</Button>
 *   </Modal.Footer>
 * </Modal>
 */

import { FC, ReactNode, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Animation config for future use
// import { ANIMATION_CONFIG } from '../../config/constants';

interface ModalContextValue {
  isOpen: boolean;
  onClose: () => void;
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

const useModalContext = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('Modal compound components must be used within Modal');
  }
  return context;
};

// Main Modal Component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: FC<ModalProps> & {
  Header: FC<ModalHeaderProps>;
  Title: FC<ModalTitleProps>;
  Body: FC<ModalBodyProps>;
  Footer: FC<ModalFooterProps>;
} = ({ isOpen, onClose, children, className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <ModalContext.Provider value={{ isOpen, onClose }}>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40"
              onClick={onClose}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={`fixed inset-0 flex items-center justify-center z-50 p-4 ${className}`}
              onClick={(e) => e.target === e.currentTarget && onClose()}
            >
              <div
                className={`bg-gray-900 rounded-lg shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col`}
                onClick={(e) => e.stopPropagation()}
              >
                {children}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ModalContext.Provider>
  );
};

// Modal Header Component
interface ModalHeaderProps {
  children: ReactNode;
  className?: string;
}

const ModalHeader: FC<ModalHeaderProps> = ({ children, className = '' }) => {
  const { onClose } = useModalContext();

  return (
    <div className={`flex items-center justify-between p-4 border-b border-gray-700 ${className}`}>
      {children}
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-white transition-colors p-1"
        aria-label="Close modal"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

// Modal Title Component
interface ModalTitleProps {
  children: ReactNode;
  className?: string;
}

const ModalTitle: FC<ModalTitleProps> = ({ children, className = '' }) => {
  return (
    <h2 className={`text-xl font-bold text-white ${className}`}>
      {children}
    </h2>
  );
};

// Modal Body Component
interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

const ModalBody: FC<ModalBodyProps> = ({ children, className = '' }) => {
  return (
    <div className={`flex-1 p-4 overflow-y-auto ${className}`}>
      {children}
    </div>
  );
};

// Modal Footer Component
interface ModalFooterProps {
  children: ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

const ModalFooter: FC<ModalFooterProps> = ({ children, className = '', align = 'right' }) => {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  };

  return (
    <div className={`flex gap-3 p-4 border-t border-gray-700 ${alignClasses[align]} ${className}`}>
      {children}
    </div>
  );
};

// Attach compound components
Modal.Header = ModalHeader;
Modal.Title = ModalTitle;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

export { Modal };