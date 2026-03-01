import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import type { ProjectInfo } from '@shared/api-types';

const STORAGE_KEY = 'claudebot-dashboard-projects';

function getRecentProjects(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecentProject(projectPath: string): void {
  const recent = getRecentProjects().filter((p) => p !== projectPath);
  recent.unshift(projectPath);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, 10)));
}

interface ProjectContextValue {
  projectPath: string | null;
  projectInfo: ProjectInfo | null;
  loading: boolean;
  setProject: (path: string) => Promise<ProjectInfo>;
  recentProjects: string[];
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projectPath, setProjectPathState] = useState<string | null>(null);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentProjects] = useState(getRecentProjects);

  // Check initial project on mount
  useEffect(() => {
    fetch('/api/project')
      .then((res) => res.json())
      .then((info: ProjectInfo) => {
        if (info.valid && info.path) {
          setProjectPathState(info.path);
          setProjectInfo(info);
          addRecentProject(info.path);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setProject = useCallback(async (newPath: string): Promise<ProjectInfo> => {
    const res = await fetch('/api/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: newPath }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to set project');
    }

    const info: ProjectInfo = await res.json();
    setProjectPathState(info.path);
    setProjectInfo(info);
    addRecentProject(info.path);
    return info;
  }, []);

  return (
    <ProjectContext.Provider value={{ projectPath, projectInfo, loading, setProject, recentProjects }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return ctx;
}
