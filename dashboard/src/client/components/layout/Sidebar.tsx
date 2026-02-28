import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '▣' },
  { to: '/sessions', label: 'Sessions', icon: '◷' },
  { to: '/tasks', label: 'Tasks', icon: '☰' },
  { to: '/analytics', label: 'Analytics', icon: '◔' },
  { to: '/config', label: 'Config', icon: '⚙' },
];

export default function Sidebar() {
  return (
    <nav className="row-start-2 bg-[var(--bg-surface)] border-r border-[var(--border-default)] flex flex-col py-3">
      <div className="flex-1 flex flex-col gap-0.5 px-2">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
              }`
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </div>

      <div className="border-t border-[var(--border-default)] mt-2 pt-2 px-2">
        <NavLink
          to="/project"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${
              isActive
                ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
            }`
          }
        >
          <span className="text-base">📁</span>
          Project
        </NavLink>
      </div>
    </nav>
  );
}
