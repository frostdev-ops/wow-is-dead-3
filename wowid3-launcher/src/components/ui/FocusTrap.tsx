import { ReactNode, useEffect, useRef } from 'react';

interface FocusTrapProps {
  children: ReactNode;
  isActive: boolean;
  onEscape?: () => void;
  restoreFocus?: boolean;
}

/**
 * FocusTrap component that traps keyboard focus within its children
 * Used for modals, dialogs, and other overlays
 *
 * Features:
 * - Traps Tab/Shift+Tab navigation within container
 * - Supports Escape key to close
 * - Restores focus to trigger element on unmount
 * - WCAG 2.1 compliant focus management
 */
export const FocusTrap = ({ children, isActive, onEscape, restoreFocus = true }: FocusTrapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Store the currently focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the first focusable element in the trap
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    return () => {
      // Restore focus when trap is deactivated
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isActive, restoreFocus]);

  const getFocusableElements = (): HTMLElement[] => {
    if (!containerRef.current) return [];

    const elements = containerRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    return Array.from(elements);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isActive) return;

    // Handle Escape key
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault();
      onEscape();
      return;
    }

    // Handle Tab key for focus trapping
    if (e.key === 'Tab') {
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: moving backwards
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: moving forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="focus-trap-container"
    >
      {children}
    </div>
  );
};
