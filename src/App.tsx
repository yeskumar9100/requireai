import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AppLayout from "./components/AppLayout";
import Upload from "./pages/Upload";
import Pipeline from "./pages/Pipeline";
import BRDViewer from "./pages/BRDViewer";
import KnowledgeGraph from "./pages/KnowledgeGraph";
import Chat from "./pages/Chat";
import Conflicts from "./pages/Conflicts";
import Settings from "./pages/Settings";
import Projects from "./pages/Projects";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import ShareBRD from "./pages/ShareBRD";
import { AuthGuard } from "./components/AuthGuard";
import { AdminGuard } from "./components/AdminGuard";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/share/:token" element={<ShareBRD />} />
      
      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route element={<AdminGuard />}>
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>
      
      <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/upload/:id" element={<Upload />} />
        <Route path="/pipeline/:id" element={<Pipeline />} />
        <Route path="/brd/:id" element={<BRDViewer />} />
        <Route path="/graph/:id" element={<KnowledgeGraph />} />
        <Route path="/chat/:id" element={<Chat />} />
        <Route path="/conflicts/:id" element={<Conflicts />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
