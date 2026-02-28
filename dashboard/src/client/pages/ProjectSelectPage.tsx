import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../hooks/useProject';
import ProjectSelector from '../components/project/ProjectSelector';

export default function ProjectSelectPage() {
  const { setProject, recentProjects } = useProject();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(path: string) {
    try {
      setError(null);
      await setProject(path);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set project');
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center p-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold mb-2">ClaudeBot Dashboard</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Select a project folder to visualize ClaudeBot results
        </p>
      </div>
      <ProjectSelector
        onSelect={handleSelect}
        recentProjects={recentProjects}
        error={error}
      />
    </div>
  );
}
