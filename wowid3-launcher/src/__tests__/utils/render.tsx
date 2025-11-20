import { ReactElement } from 'react';
import { render as rtlRender } from '@testing-library/react';

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export const render = (ui: ReactElement) =>
  rtlRender(ui, { wrapper: AllTheProviders });

