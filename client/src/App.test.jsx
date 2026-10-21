import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('App routing', () => {
  it('renders the sign-in screen when signed out', () => {
    renderAt('/signin');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/report a campus issue/i)).toBeInTheDocument();
  });

  it('redirects an unauthenticated deep link to sign-in', () => {
    renderAt('/issues');
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});
