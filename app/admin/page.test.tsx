import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useSession } from 'next-auth/react';
import AdminPage from './page';
import { expect } from 'vitest';
import { Mock } from 'vitest';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

import { getTableNames, getTableData } from './actions';

vi.mock('./actions', () => ({
  getTableNames: vi.fn(),
  getTableData: vi.fn(),
}));

describe('AdminPage component', () => {
  let tableNamesPromiseResolve: (value: any) => void;
  let tableNamesPromise: Promise<any>;

  beforeEach(() => {
    vi.clearAllMocks();

    tableNamesPromise = new Promise((resolve) => {
      tableNamesPromiseResolve = resolve;
    });

    (getTableNames as Mock).mockImplementation(() => tableNamesPromise);
    (getTableData as Mock).mockImplementation(() =>
      Promise.resolve({
        data: {
          data: [{ id: 1, name: 'Test User' }],
          totalRows: 10,
          page: 1,
          limit: 10,
        },
      })
    );
  });

  it('should show loading state while checking authentication', async () => {
    (useSession as Mock).mockReturnValue({
      data: null,
      status: 'loading',
    });

    await act(async () => {
      render(<AdminPage />);
    });

    expect(screen.getByText('Loading authentication status...')).toBeInTheDocument();
  });

  it('should show unauthorized message when user is not logged in', async () => {
    (useSession as Mock).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });

    await act(async () => {
      render(<AdminPage />);
    });

    expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    expect(screen.getByText('You must be logged in to access the admin area.')).toBeInTheDocument();
  });

  it('should show unauthorized message when user is not an admin', async () => {
    (useSession as Mock).mockReturnValue({
      data: {
        user: {
          name: 'Regular User',
          email: 'user@example.com',
          isAdmin: false,
        },
      },
      status: 'authenticated',
    });

    await act(async () => {
      render(<AdminPage />);
    });

    expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    expect(screen.getByText('You do not have admin permissions.')).toBeInTheDocument();
  });

  it('should load table names when user is an admin', async () => {
    (useSession as Mock).mockReturnValue({
      data: {
        user: {
          name: 'Admin User',
          email: 'admin@example.com',
          isAdmin: true,
        },
      },
      status: 'authenticated',
    });

    await act(async () => {
      render(<AdminPage />);
    });

    expect(screen.getByText(/Loading table names.../i)).toBeInTheDocument();

    await act(async () => {
      tableNamesPromiseResolve({ data: ['users', 'logs'] });
      await tableNamesPromise;
    });

    await waitFor(() => {
      expect(screen.getByText('users')).toBeInTheDocument();
      expect(screen.getByText('logs')).toBeInTheDocument();
    });

    expect(getTableNames).toHaveBeenCalled();
  });

  it('should handle error when loading table names fails', async () => {
    (useSession as Mock).mockReturnValue({
      data: {
        user: {
          name: 'Admin User',
          email: 'admin@example.com',
          isAdmin: true,
        },
      },
      status: 'authenticated',
    });

    await act(async () => {
      render(<AdminPage />);
      tableNamesPromiseResolve({ error: 'Unauthorized' });
    });

    await act(async () => {
      await tableNamesPromise;
    });

    await waitFor(() => {
      expect(screen.getByText(/Error loading tables: Unauthorized/i)).toBeInTheDocument();
    });
  });
});
