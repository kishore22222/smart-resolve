import { Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import SignIn from './pages/SignIn.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import IssueList from './pages/IssueList.jsx';
import NewIssue from './pages/NewIssue.jsx';
import IssueDetail from './pages/IssueDetail.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminReports from './pages/AdminReports.jsx';
import Forbidden from './pages/Forbidden.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/register" element={<Register />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="/issues" element={<IssueList />} />
        <Route
          path="/issues/new"
          element={
            <ProtectedRoute roles={['reporter', 'admin']}>
              <NewIssue />
            </ProtectedRoute>
          }
        />
        <Route path="/issues/:id" element={<IssueDetail />} />
        <Route path="/forbidden" element={<Forbidden />} />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminReports />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
