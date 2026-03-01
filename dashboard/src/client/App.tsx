import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import DashboardPage from './pages/DashboardPage';
import SessionsPage from './pages/SessionsPage';
import TasksPage from './pages/TasksPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ConfigPage from './pages/ConfigPage';
import ChatPage from './pages/ChatPage';
import ProjectSelectPage from './pages/ProjectSelectPage';
import { useProject } from './hooks/useProject';

export default function App() {
  const { projectPath } = useProject();

  if (!projectPath) {
    return (
      <Routes>
        <Route path="*" element={<ProjectSelectPage />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/project" element={<ProjectSelectPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
