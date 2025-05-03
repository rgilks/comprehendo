import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
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

const mockAdminSession = {
  data: {
    user: {
      name: 'Admin User',
      email: 'admin@example.com',
      isAdmin: true,
    },
  },
  status: 'authenticated',
};

describe('AdminPage component', () => {
  let tableNamesPromiseResolve: (value: any) => void;
  let tableNamesPromiseReject: (reason?: any) => void;
  let tableNamesPromise: Promise<any>;
  let tableDataPromiseResolve: (value: any) => void;
  let tableDataPromiseReject: (reason?: any) => void;
  let tableDataPromise: Promise<any>;

  beforeEach(() => {
    vi.clearAllMocks();

    tableNamesPromise = new Promise((resolve, reject) => {
      tableNamesPromiseResolve = resolve;
      tableNamesPromiseReject = reject;
    });
    tableDataPromise = new Promise((resolve, reject) => {
      tableDataPromiseResolve = resolve;
      tableDataPromiseReject = reject;
    });

    (getTableNames as Mock).mockImplementation(() => tableNamesPromise);
    (getTableData as Mock).mockImplementation(() => tableDataPromise);
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
    (useSession as Mock).mockReturnValue(mockAdminSession);

    await act(async () => {
      render(<AdminPage />);
    });

    expect(screen.getByText(/Loading table names.../i)).toBeInTheDocument();

    await act(async () => {
      tableNamesPromiseResolve({ data: ['users', 'logs'] });
      await tableNamesPromise;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /users/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /logs/i })).toBeInTheDocument();
    });

    expect(getTableNames).toHaveBeenCalled();
  });

  it('should handle error when loading table names fails', async () => {
    (useSession as Mock).mockReturnValue(mockAdminSession);

    await act(async () => {
      render(<AdminPage />);
    });

    await act(async () => {
      tableNamesPromiseReject(new Error('Network Error'));
      await tableNamesPromise.catch(() => {});
    });

    await waitFor(() => {
      expect(screen.getByText(/Error loading tables: Failed to load tables/i)).toBeInTheDocument();
    });
  });

  it('should fetch and display table data when a table name is clicked', async () => {
    (useSession as Mock).mockReturnValue(mockAdminSession);

    await act(async () => {
      render(<AdminPage />);
      tableNamesPromiseResolve({ data: ['users', 'logs'] });
      await tableNamesPromise;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /users/i })).toBeInTheDocument();
    });

    const mockTableData = {
      data: {
        data: [{ id: 1, name: 'Test User', email: 'test@example.com' }],
        totalRows: 1,
        page: 1,
        limit: 10,
      },
    };

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /users/i }));
    });

    await act(async () => {
      tableDataPromiseResolve(mockTableData);
      await tableDataPromise;
    });

    await waitFor(() => {
      expect(screen.getByText('id')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('email')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    expect(getTableData).toHaveBeenCalledWith('users', 1, 10);
  });

  it('should display an error message if fetching table data fails', async () => {
    (useSession as Mock).mockReturnValue(mockAdminSession);

    await act(async () => {
      render(<AdminPage />);
      tableNamesPromiseResolve({ data: ['users'] });
      await tableNamesPromise;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /users/i })).toBeInTheDocument();
    });

    const mockError = new Error('Database connection failed');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /users/i }));
    });

    await act(async () => {
      tableDataPromiseReject(mockError);
      await tableDataPromise.catch(() => {});
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Error loading data for users: Failed to load table data/i)
      ).toBeInTheDocument();
    });

    expect(getTableData).toHaveBeenCalledWith('users', 1, 10);
  });
});
