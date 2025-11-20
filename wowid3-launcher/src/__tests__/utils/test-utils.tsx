import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

// Mock providers wrapper (add any providers your app uses)
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

// Custom render that includes providers
export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: AllTheProviders, ...options });
};

// Re-export everything from testing-library
export * from '@testing-library/react';
export { renderWithProviders as render };
