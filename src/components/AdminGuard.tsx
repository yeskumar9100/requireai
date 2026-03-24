import { Navigate, Outlet } from 'react-router-dom';
import { isAdminLoggedIn } from '../lib/admin-auth';

export function AdminGuard() {
  if (!isAdminLoggedIn()) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
