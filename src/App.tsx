import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Plus, Folder, Building2, Download, Copy, Settings2, Trash2, LayoutDashboard, FileCode, Database, Server, Terminal, Play, Square, RefreshCw, Activity, Rocket, FlaskConical, StopCircle, CheckCircle2, AlertCircle, Loader2, ExternalLink, Package, LogOut, Users, Shield, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Organization, Project, ProjectConfig, ProjectStatus, OdooVersion } from './types';
import { ODOO_VERSIONS, DEFAULT_PROJECT_CONFIG } from './constants';
import { generateDockerCompose } from './lib/docker-utils';
import { ContainerStats } from './components/ContainerStats';
import { BackupManager } from './components/BackupManager';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import UsersPage from './pages/Users';
import api from './lib/api';

export default function App() {
  const { user, token, isAdmin, isDeveloper, loading: authLoading, logout } = useAuth();

  // Simple path-based routing
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // If auth is loading, show spinner
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  // If not logged in, show Login page
  if (!user || !token) {
    return <Login />;
  }

  // If current path is /login and user IS authenticated, redirect to /
  if (currentPath === '/login') {
    navigate('/');
  }

  // Users management page (admin only)
  if (currentPath === '/users') {
    if (!isAdmin) {
      navigate('/');
      return null;
    }
    return (
      <AppShell user={user} isAdmin={isAdmin} logout={logout} currentPath={currentPath} navigate={navigate}>
        <UsersPage />
      </AppShell>
    );
  }

  // Main app
  return (
    <AppShell user={user} isAdmin={isAdmin} logout={logout} currentPath={currentPath} navigate={navigate}>
      <MainContent isAdmin={isAdmin} isDeveloper={isDeveloper} user={user} token={token} />
    </AppShell>
  );
}

/**
 * Shell component providing sidebar with user menu and navigation.
 */
function AppShell({ children, user, isAdmin, logout, currentPath, navigate }: {
  children: ReactNode;
  user: { id: string; username: string; role: string; lastLoginAt?: string | null };
  isAdmin: boolean;
  logout: () => void;
  currentPath: string;
  navigate: (path: string) => void;
}) {
  return (
    <div className="flex h-screen bg-zinc-50 font-sans text-zinc-900">
      <Toaster position="top-right" />

      {/* Sidebar */}
      <aside className="w-72 border-r border-zinc-200 bg-white flex flex-col">
        <div className="p-6 flex-1">
          <div className="flex items-center gap-2 mb-8 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Server className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">Odoo Manager</h1>
          </div>

          {/* Navigation */}
          <nav className="space-y-1 mb-6">
            <button
              onClick={() => navigate('/')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                currentPath === '/' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate('/users')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentPath === '/users' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                <Users className="w-4 h-4" />
                User Management
              </button>
            )}
          </nav>
        </div>

        {/* User menu at bottom */}
        <div className="p-4 border-t border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-xs font-bold text-white uppercase">
              {user.username.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 truncate">{user.username}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                {user.role === 'admin' ? (
                  <span className="text-purple-600">Admin</span>
                ) : user.role === 'developer' ? (
                  <span className="text-blue-600">Developer</span>
                ) : (
                  <span>Viewer</span>
                )}
              </p>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}

/**
 * Main content component (dashboard + project views)
 */
function MainContent({ isAdmin, isDeveloper, user, token }: { isAdmin: boolean; isDeveloper: boolean; user: any; token: string }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isNewOrgDialogOpen, setIsNewOrgDialogOpen] = useState(false);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  
  const [newProject, setNewProject] = useState<{
    name: string;
    description: string;
    config: ProjectConfig;
  }>({
    name: '',
    description: '',
    config: { ...DEFAULT_PROJECT_CONFIG },
  });

  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  const [showAdvancedCompose, setShowAdvancedCompose] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchOrgs = async () => {
    try {
      const res = await api.get('/organizations');
      setOrganizations(res.data);
    } catch (e) {
      console.error("Failed to fetch organizations", e);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const selectedOrg = organizations.find(org => org.id === selectedOrgId);
  const selectedProject = selectedOrg?.projects.find(p => p.id === selectedProjectId);

  // Helper to update project-level fields (name, description, etc.)
  const updateProject = async (updates: Partial<Project>) => {
    if (!selectedOrgId || !selectedProjectId || !selectedProject) return;
    
    // Update local state for immediate UI feedback
    setOrganizations(prev => prev.map(org =>
      org.id === selectedOrgId
        ? { ...org, projects: org.projects.map(p => p.id === selectedProjectId ? { ...p, ...updates } : p) }
        : org
    ));

    // Save to backend
    try {
      await api.patch(`/organizations/${selectedOrgId}/projects/${selectedProjectId}`, updates);
    } catch (e) {
      console.error("Failed to update project", e);
      toast.error("Failed to save changes to server");
    }
  };

  // Helper to update project config fields (version, db, resources, etc.)
  const updateProjectConfig = async (configUpdates: Partial<ProjectConfig>) => {
    if (!selectedOrgId || !selectedProjectId) return;
    
    const project = organizations.find(o => o.id === selectedOrgId)?.projects.find(p => p.id === selectedProjectId);
    if (!project) return;

    const newConfig = { ...project.config, ...configUpdates };

    // Update local state
    setOrganizations(prev => prev.map(org =>
      org.id === selectedOrgId
        ? { ...org, projects: org.projects.map(p => p.id === selectedProjectId ? { ...p, config: newConfig } : p) }
        : org
    ));

    // Save to backend
    try {
      await api.put(`/projects/${selectedProjectId}`, { config: newConfig });
    } catch (e) {
      console.error("Failed to update project config", e);
      toast.error("Failed to save changes to server");
    }
  };

  // Periodically fetch logs for the selected project if it's running or deploying
  useEffect(() => {
    if (!selectedProjectId || !selectedProject || !['running', 'deploying'].includes(selectedProject.status as string)) return;

    const fetchLogs = async () => {
      try {
        const containerParam = selectedProject.containerId ? `?containerId=${selectedProject.containerId}` : '';
        const res = await api.get(`/projects/${selectedProjectId}/logs${containerParam}`);
        const data = res.data;
        if (data.logs && data.logs.length > 0) {
          setOrganizations(prev => prev.map(org => ({
            ...org,
            projects: org.projects.map(p => 
              p.id === selectedProjectId 
                ? { ...p, containerLogs: data.logs } 
                : p
            )
          })));
        }
      } catch (e) {
        console.error("Failed to fetch logs", e);
      }
    };

    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [selectedProjectId, selectedProject?.status, selectedProject?.containerId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedProject?.containerLogs, selectedProject?.projectLogs]);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    const newOrg: Organization = {
      id: crypto.randomUUID(),
      name: newOrgName,
      projects: [],
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await api.post('/organizations', newOrg);
      
      setOrganizations([...organizations, newOrg]);
      setNewOrgName('');
      setIsNewOrgDialogOpen(false);
      setSelectedOrgId(newOrg.id);
      toast.success('Organization created successfully');
    } catch (e) {
      toast.error("Failed to create organization on server");
    }
  };

  const handleCreateProject = async () => {
    if (!selectedOrgId || !newProject.name.trim()) return;
    const project: Project = {
      id: crypto.randomUUID(),
      ...newProject,
      createdAt: new Date().toISOString(),
      status: 'idle',
      projectLogs: ['[SYSTEM] Project created. Ready to deploy when you are.'],
      containerLogs: []
    };
    
    try {
      await api.post(`/organizations/${selectedOrgId}/projects`, project);

      setOrganizations(organizations.map(org => 
        org.id === selectedOrgId 
          ? { ...org, projects: [...org.projects, project] }
          : org
      ));
      
      setNewProject({
        name: '',
        description: '',
        config: { ...DEFAULT_PROJECT_CONFIG },
      });
      setIsNewProjectDialogOpen(false);
      setSelectedProjectId(project.id);
      toast.success('Project created! Review your configuration and deploy when ready.');
    } catch (e) {
      toast.error("Failed to create project on server");
    }
  };

  const handleDeployProject = async (project: Project, forcePull: boolean = false) => {
    // Update status to deploying
    setOrganizations(prev => prev.map(org => ({
      ...org,
      projects: org.projects.map(p => p.id === project.id ? { 
        ...p, 
        status: 'deploying' as ProjectStatus, 
        projectLogs: [...(p.projectLogs || []), `[SYSTEM] ${forcePull ? 'Force pulling latest image and rebuilding...' : 'Initializing deployment...'}`, `[SYSTEM] Using Odoo ${project.config.odooVersion} image...`, '[SYSTEM] Creating Docker network and containers...'] 
      } : p)
    })));

    toast.promise(
      async () => {
        const res = await api.post('/projects/deploy', {
          projectId: project.id,
          config: project.config,
          name: project.name,
          forcePull
        });
        return res.data;
      },
      {
        loading: 'Deploying containers...',
        success: (data) => {
          setOrganizations(prev => prev.map(org => ({
            ...org,
            projects: org.projects.map(p => p.id === project.id ? { 
              ...p, 
              status: 'running', 
              containerId: data.containerId,
              dbContainerId: data.dbContainerId,
              port: data.port,
              projectLogs: [...(p.projectLogs || []), `[SYSTEM] ✅ Odoo ${project.config.odooVersion} running on port ${data.port}.`] 
            } : p)
          })));
          return 'Containers deployed and running!';
        },
        error: (err) => {
          setOrganizations(prev => prev.map(org => ({
            ...org,
            projects: org.projects.map(p => p.id === project.id ? { ...p, status: 'error', projectLogs: [...(p.projectLogs || []), `[ERROR] ${err.message}`] } : p)
          })));
          return err.message;
        }
      }
    );
  };

  const handleTestConfig = async (project: Project) => {
    setOrganizations(prev => prev.map(org => ({
      ...org,
      projects: org.projects.map(p => p.id === project.id ? { 
        ...p, 
        projectLogs: [...(p.projectLogs || []), '[TEST] Running configuration tests...'] 
      } : p)
    })));

    toast.promise(
      async () => {
        const res = await api.post('/projects/test-config', {
          projectId: project.id,
          config: project.config,
          name: project.name
        });
        return res.data;
      },
      {
        loading: 'Testing configuration...',
        success: (data) => {
          setOrganizations(prev => prev.map(org => ({
            ...org,
            projects: org.projects.map(p => p.id === project.id ? { 
              ...p, 
              projectLogs: [...(p.projectLogs || []), ...data.results.map((r: string) => `[TEST] ${r}`), '[TEST] ✅ All tests passed!'] 
            } : p)
          })));
          return 'All configuration tests passed!';
        },
        error: (err) => {
          setOrganizations(prev => prev.map(org => ({
            ...org,
            projects: org.projects.map(p => p.id === project.id ? { 
              ...p, 
              projectLogs: [...(p.projectLogs || []), `[TEST] ❌ ${err.message}`] 
            } : p)
          })));
          return err.message;
        }
      }
    );
  };

  const handleStopProject = async (project: Project) => {
    if (!project.containerId) return;
    toast.promise(
      async () => {
        const res = await api.post(`/projects/${project.id}/stop`, {
          containerId: project.containerId,
          dbContainerId: project.dbContainerId
        });
        return res.data;
      },
      {
        loading: 'Stopping containers...',
        success: () => {
          setOrganizations(prev => prev.map(org => ({
            ...org,
            projects: org.projects.map(p => p.id === project.id ? { 
              ...p, 
              status: 'stopped', 
              projectLogs: [...(p.projectLogs || []), '[SYSTEM] Odoo and database containers stopped.'] 
            } : p)
          })));
          return 'Containers stopped.';
        },
        error: (err) => err.message
      }
    );
  };

  const handleStartProject = async (project: Project) => {
    if (!project.containerId) return;
    toast.promise(
      async () => {
        const res = await api.post(`/projects/${project.id}/start`, {
          containerId: project.containerId,
          dbContainerId: project.dbContainerId
        });
        return res.data;
      },
      {
        loading: 'Starting containers...',
        success: (data) => {
          setOrganizations(prev => prev.map(org => ({
            ...org,
            projects: org.projects.map(p => p.id === project.id ? { 
              ...p, 
              status: 'running', 
              port: data.port || p.port,
              projectLogs: [...(p.projectLogs || []), '[SYSTEM] Odoo and database containers started.'] 
            } : p)
          })));
          return 'Containers started.';
        },
        error: (err) => err.message
      }
    );
  };

  const handleDeleteOrg = async (org: Organization) => {
    toast.promise(
      async () => {
        const res = await api.delete(`/organizations/${org.id}`);
        return res.data;
      },
      {
        loading: 'Deleting organization...',
        success: () => {
          setOrganizations(organizations.filter(o => o.id !== org.id));
          if (selectedOrgId === org.id) {
             setSelectedOrgId(null);
             setSelectedProjectId(null);
          }
          return 'Organization deleted successfully.';
        },
        error: (err) => err.response?.data?.error || 'Failed to delete organization.'
      }
    );
  };

  const handleDeleteProject = (project: Project) => {
    if (!selectedOrgId) return;

    toast.promise(
      async () => {
        const res = await api.delete(`/projects/${project.id}`, {
          data: {
            containerId: project.containerId,
            dbContainerId: project.dbContainerId,
            name: project.name
          }
        });
        return res.data;
      },
      {
        loading: 'Deleting project and containers...',
        success: () => {
          setOrganizations(organizations.map(org => 
            org.id === selectedOrgId 
              ? { ...org, projects: org.projects.filter(p => p.id !== project.id) }
              : org
          ));
          if (selectedProjectId === project.id) setSelectedProjectId(null);
          return 'Project and containers deleted.';
        },
        error: 'Failed to completely clean up containers.'
      }
    );
  };

  const handleCopyCompose = () => {
    if (!selectedProject) return;
    const compose = selectedProject.config.customCompose ?? generateDockerCompose(selectedProject.name, selectedProject.config, selectedProject.id);
    navigator.clipboard.writeText(compose);
    toast.success('Docker Compose copied to clipboard');
  };

  // Show "Change your password" banner if using default admin credentials on first login
  const showPasswordBanner = user.username === 'admin' && user.lastLoginAt === null;

  return (
    <>
      {showPasswordBanner && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3">
          <KeyRound className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>Security notice:</strong> You are using the default admin credentials. Please change your password from the <button onClick={() => { window.history.pushState({}, '', '/users'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="underline font-semibold hover:text-amber-900">User Management</button> page.
          </p>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-zinc-50">
        {selectedOrg ? (
          <>
            <header className="h-16 border-b border-zinc-200 bg-white px-8 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:text-zinc-600 transition-colors"
                  onClick={() => { setSelectedOrgId(null); setSelectedProjectId(null); }}
                >
                  <Building2 className="w-5 h-5" />
                  <span className="font-semibold text-lg hidden sm:inline">Organizations</span>
                </div>
                
                <Separator orientation="vertical" className="h-4" />
                
                <Select 
                  value={selectedOrgId || ''} 
                  onValueChange={(val) => {
                    setSelectedOrgId(val);
                    setSelectedProjectId(null);
                  }}
                >
                  <SelectTrigger className="h-8 border-none bg-transparent hover:bg-zinc-50 font-semibold text-lg gap-2 px-3 focus:ring-0 w-auto">
                    <SelectValue placeholder="Select Organization">
                      {organizations.find(o => o.id === selectedOrgId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map(org => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Separator orientation="vertical" className="h-4" />
                
                <nav className="flex items-center gap-3">
                  <div 
                    className={`flex items-center gap-1.5 text-sm font-medium cursor-pointer py-1 px-3 rounded-md transition-colors ${!selectedProjectId ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50'}`}
                    onClick={() => setSelectedProjectId(null)}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Projects</span>
                  </div>

                  {selectedProjectId && (
                    <>
                      <Separator orientation="vertical" className="h-4" />
                      <Select 
                        value={selectedProjectId} 
                        onValueChange={setSelectedProjectId}
                      >
                        <SelectTrigger className="h-8 border-none bg-transparent hover:bg-zinc-50 font-medium text-sm gap-2 px-3 focus:ring-0 w-auto">
                          <div className="flex items-center gap-2">
                            <Folder className="w-4 h-4 text-zinc-500" />
                            <SelectValue placeholder="Select Project">
                              {selectedOrg.projects.find(p => p.id === selectedProjectId)?.name}
                            </SelectValue>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {selectedOrg.projects.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </nav>
              </div>
              {(isAdmin || isDeveloper) && (
              <Dialog open={isNewProjectDialogOpen} onOpenChange={setIsNewProjectDialogOpen}>
                <DialogTrigger render={<Button size="sm" className="gap-2" />}>
                  <Plus className="w-4 h-4" />
                  New Project
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Odoo Project</DialogTitle>
                    <DialogDescription>Configure your Odoo instance. Uses the official <code>odoo</code> Docker image with PostgreSQL.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="p-name">Project Name</Label>
                        <Input 
                          id="p-name" 
                          value={newProject.name}
                          onChange={e => setNewProject({...newProject, name: e.target.value})}
                          placeholder="My Odoo Instance" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="p-port">Host Port</Label>
                        <Input 
                          id="p-port" 
                          type="number"
                          value={newProject.config.hostPort || ''}
                          onChange={e => setNewProject({...newProject, config: {...newProject.config, hostPort: parseInt(e.target.value) || 8069}})}
                          placeholder="8069" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="p-version">Odoo Version</Label>
                        <Select 
                          value={newProject.config.odooVersion}
                          onValueChange={v => setNewProject({...newProject, config: {...newProject.config, odooVersion: v}})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ODOO_VERSIONS.map(v => (
                              <SelectItem key={v} value={v}>
                                Odoo {v}{v === '19.0' ? ' (latest)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-desc">Description</Label>
                      <Textarea 
                        id="p-desc" 
                        value={newProject.description}
                        onChange={e => setNewProject({...newProject, description: e.target.value})}
                        placeholder="Project details..." 
                      />
                    </div>
                    <Separator />
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="db-name">Database Name</Label>
                        <Input 
                          id="db-name" 
                          value={newProject.config.dbName}
                          onChange={e => setNewProject({...newProject, config: {...newProject.config, dbName: e.target.value}})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="db-user">Database User</Label>
                        <Input 
                          id="db-user" 
                          value={newProject.config.dbUser}
                          onChange={e => setNewProject({...newProject, config: {...newProject.config, dbUser: e.target.value}})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="db-pass">Database Password</Label>
                        <Input 
                          id="db-pass" 
                          type="password"
                          value={newProject.config.dbPassword}
                          onChange={e => setNewProject({...newProject, config: {...newProject.config, dbPassword: e.target.value}})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="addons">Custom Addons Path</Label>
                      <Input 
                        id="addons" 
                        value={newProject.config.addonsPath}
                        onChange={e => setNewProject({...newProject, config: {...newProject.config, addonsPath: e.target.value}})}
                        placeholder="./addons" 
                      />
                      <p className="text-[11px] text-zinc-400">Mounted at <code>/mnt/extra-addons</code> inside the container.</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreateProject}>Create Project</Button>
                    <p className="text-xs text-zinc-400 mt-1">Containers will not be created yet. You can deploy after reviewing your configuration.</p>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              )}
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-zinc-50">
              {!selectedProjectId ? (
                /* Organization Dashboard - Project Grid */
                <div className="p-8 max-w-7xl mx-auto">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight">Project Dashboard</h1>
                      <p className="text-zinc-500">Manage all your Odoo instances for {selectedOrg.name}.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {isAdmin && (
                      <Button variant="outline" className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => {
                        setOrgToDelete(selectedOrg);
                        setDeleteConfirmationText('');
                      }}>
                        <Trash2 className="w-4 h-4" />
                        Delete Organization
                      </Button>
                      )}
                      {(isAdmin || isDeveloper) && (
                      <Button onClick={() => setIsNewProjectDialogOpen(true)} className="gap-2 shadow-sm rounded-lg">
                        <Plus className="w-4 h-4" />
                        New Project
                      </Button>
                      )}
                    </div>
                  </div>

                  {selectedOrg.projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-zinc-300">
                      <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
                        <Package className="w-8 h-8 text-zinc-300" />
                      </div>
                      <h3 className="text-lg font-semibold text-zinc-900 mb-2">No projects found</h3>
                      <p className="text-zinc-500 mb-8 max-w-xs text-center">Get started by creating your first Odoo deployment in this organization.</p>
                      {(isAdmin || isDeveloper) && (
                      <Button onClick={() => setIsNewProjectDialogOpen(true)} variant="outline" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Create Project
                      </Button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {selectedOrg.projects.map(project => (
                        <motion.div
                          key={project.id}
                          layoutId={project.id}
                          whileHover={{ y: -4 }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        >
                          <Card 
                            className="group cursor-pointer border-zinc-200 hover:border-zinc-900 transition-all hover:shadow-xl bg-white overflow-hidden h-full flex flex-col"
                            onClick={() => setSelectedProjectId(project.id)}
                          >
                            <CardHeader className="pb-3 px-6 pt-6">
                              <div className="flex items-center justify-between mb-3">
                                <Badge variant="secondary" className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  project.status === 'running' ? 'bg-emerald-100 text-emerald-700' :
                                  project.status === 'deploying' ? 'bg-amber-100 text-amber-700 animate-pulse' :
                                  project.status === 'error' ? 'bg-red-100 text-red-700' :
                                  'bg-zinc-100 text-zinc-600'
                                }`}>
                                  {project.status?.toUpperCase() || 'IDLE'}
                                </Badge>
                                <span className="text-[10px] text-zinc-400 font-medium">v{project.config.odooVersion}</span>
                              </div>
                              <CardTitle className="text-lg group-hover:text-zinc-900 truncate">{project.name}</CardTitle>
                              <CardDescription className="line-clamp-2 text-xs min-h-[32px]">{project.description || 'No description provided.'}</CardDescription>
                            </CardHeader>
                            <CardContent className="px-6 py-3 flex-1">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs text-zinc-500">
                                  <div className="flex items-center gap-1.5">
                                    <Activity className="w-3.5 h-3.5 opacity-50" />
                                    <span>Host Port</span>
                                  </div>
                                  <span className="font-mono bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-100">{project.port || project.config.hostPort}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-zinc-500">
                                  <div className="flex items-center gap-1.5">
                                    <Database className="w-3.5 h-3.5 opacity-50" />
                                    <span>Database</span>
                                  </div>
                                  <span className="truncate max-w-[120px] font-medium">{project.config.dbName}</span>
                                </div>
                              </div>
                            </CardContent>
                            <CardFooter className="px-6 pb-6 pt-0 mt-auto">
                              <Button variant="ghost" className="w-full text-zinc-500 group-hover:text-zinc-900 group-hover:bg-zinc-50 gap-2 h-9 text-xs font-semibold">
                                View Details
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </CardFooter>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Project Detail View */
                <div className="p-8">
                <AnimatePresence mode="wait">
                  {selectedProject && (
                    <motion.div
                      key={selectedProject.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="max-w-4xl mx-auto space-y-8"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-3xl font-bold tracking-tight">{selectedProject.name}</h2>
                            {selectedProject.status === 'running' && (
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                                <Activity className="w-3 h-3" />
                                Running on port {selectedProject.port}
                              </Badge>
                            )}
                            {selectedProject.status === 'idle' && (
                              <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-200 gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Ready to Deploy
                              </Badge>
                            )}
                            {selectedProject.status === 'deploying' && (
                              <Badge variant="secondary" className="bg-amber-50 text-amber-600 border-amber-200 gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Deploying...
                              </Badge>
                            )}
                            {selectedProject.status === 'error' && (
                              <Badge variant="secondary" className="bg-red-50 text-red-600 border-red-200 gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Error
                              </Badge>
                            )}
                            {selectedProject.status === 'stopped' && (
                              <Badge variant="secondary" className="bg-zinc-100 text-zinc-500 border-zinc-300 gap-1">
                                <Square className="w-3 h-3" />
                                Stopped
                              </Badge>
                            )}
                          </div>
                          <p className="text-zinc-500 max-w-2xl">{selectedProject.description}</p>
                        </div>
                        <div className="flex gap-2">
                          {selectedProject.status === 'running' && selectedProject.port && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="gap-2"
                              onClick={() => window.open(`http://localhost:${selectedProject.port}`, '_blank')}
                            >
                              <ExternalLink className="w-4 h-4" />
                              Open Odoo
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className="gap-2" onClick={handleCopyCompose}>
                            <Copy className="w-4 h-4" />
                            Copy YAML
                          </Button>
                          {(isAdmin || isDeveloper) && (
                          <Button variant="destructive" size="sm" onClick={() => {
                            setProjectToDelete(selectedProject);
                            setDeleteConfirmationText('');
                          }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons Panel */}
                      <Card className="border-zinc-200 shadow-sm bg-white">
                        <CardContent className="p-5">
                          <div className="flex items-center gap-3 flex-wrap">
                            {(selectedProject.status === 'idle' || selectedProject.status === 'error') && (isAdmin || isDeveloper) && (
                              <Button 
                                size="sm" 
                                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                onClick={() => handleDeployProject(selectedProject)}
                              >
                                <Rocket className="w-4 h-4" />
                                Deploy Containers
                              </Button>
                            )}
                            {selectedProject.status === 'stopped' && (isAdmin || isDeveloper) && (
                              <Button 
                                size="sm" 
                                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                onClick={() => handleStartProject(selectedProject)}
                              >
                                <Play className="w-4 h-4" />
                                Start Containers
                              </Button>
                            )}
                            {selectedProject.status === 'running' && (isAdmin || isDeveloper) && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => handleStopProject(selectedProject)}
                              >
                                <StopCircle className="w-4 h-4" />
                                Stop Containers
                              </Button>
                            )}
                            {selectedProject.status !== 'deploying' && (isAdmin || isDeveloper) && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                                onClick={() => handleDeployProject(selectedProject, true)}
                              >
                                <RefreshCw className="w-4 h-4" />
                                Rebuild & Pull Latest
                              </Button>
                            )}
                            {selectedProject.status !== 'deploying' && (isAdmin || isDeveloper) && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="gap-2 border-violet-200 text-violet-600 hover:bg-violet-50 hover:text-violet-700"
                                onClick={() => handleTestConfig(selectedProject)}
                              >
                                <FlaskConical className="w-4 h-4" />
                                Test Configuration
                              </Button>
                            )}
                            {selectedProject.status === 'deploying' && (
                              <div className="flex items-center gap-2 text-sm text-amber-600">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Deployment in progress...
                              </div>
                            )}
                            <Separator orientation="vertical" className="h-6 mx-1" />
                            <p className="text-xs text-zinc-400">
                              {selectedProject.status === 'idle' 
                                ? 'Review your configuration below, then deploy when ready.' 
                                : selectedProject.status === 'running'
                                ? `Odoo ${selectedProject.config.odooVersion} is running on port ${selectedProject.port}.`
                                : selectedProject.status === 'stopped'
                                ? 'Containers are stopped. You can redeploy.'
                                : selectedProject.status === 'error'
                                ? 'Deployment failed. Check logs and try again.'
                                : 'Please wait...'}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      
                      {selectedProject.status === 'running' && (
                        <div className="space-y-6">
                           <ContainerStats 
                             projectId={selectedProject.id} 
                             title="Odoo Container Resources" 
                           />
                           {selectedProject.config.includePostgres && (
                             <ContainerStats 
                               projectId={selectedProject.id} 
                               type="db" 
                               title="Database Container Resources" 
                             />
                           )}
                        </div>
                      )}

                      <Tabs defaultValue="settings" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-8">
                          <TabsTrigger value="settings" className="gap-2">
                            <Settings2 className="w-4 h-4" />
                            Settings
                          </TabsTrigger>
                          <TabsTrigger value="compose" className="gap-2">
                            <FileCode className="w-4 h-4" />
                            Docker Compose
                          </TabsTrigger>
                          <TabsTrigger value="logs" className="gap-2">
                            <Terminal className="w-4 h-4" />
                            Logs
                          </TabsTrigger>
                        </TabsList>

                        {/* ── Settings Tab ── */}
                        <TabsContent value="settings">
                          <div className="space-y-6">
                            
                            {/* Section: Project Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <Card className="border-zinc-200 shadow-sm">
                                <CardHeader className="pb-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                      <Server className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                      <CardTitle className="text-base">Project Details</CardTitle>
                                      <CardDescription className="text-xs">Basic metadata</CardDescription>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-1 gap-4">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-zinc-500">Project Name</Label>
                                      <Input
                                        value={selectedProject.name}
                                        onChange={e => updateProject({ name: e.target.value })}
                                      />
                                    </div>
{/* 
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-zinc-500">Master Password</Label>
                                      <Input
                                        type="password"
                                        placeholder="Odoo Master Password (default: admin)"
                                        value={selectedProject.config.masterPassword || ''}
                                        onChange={e => updateProject({ config: { ...selectedProject.config, masterPassword: e.target.value } })}
                                      />
                                    </div>
                                    */}
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-zinc-500">Description</Label>
                                      <Textarea
                                        value={selectedProject.description}
                                        onChange={e => updateProject({ description: e.target.value })}
                                        placeholder="What is this project for?"
                                        className="resize-none h-20"
                                      />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

{/* 
                              {selectedProject.config.includePostgres && (
                                <BackupManager projectId={selectedProject.id} onRefresh={fetchOrgs} />
                              )}
                              */}
                            </div>

                            {/* Section: Odoo Config File */}
                            <Card className="border-zinc-200 shadow-sm">
                              <CardHeader className="pb-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                                    <Settings2 className="w-4 h-4 text-zinc-600" />
                                  </div>
                                  <div>
                                    <CardTitle className="text-base">odoo.conf</CardTitle>
                                    <CardDescription className="text-xs">Raw Odoo configuration file — mounted inside the container at <code>/etc/odoo</code></CardDescription>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <Textarea
                                  className="font-mono text-sm min-h-[200px] bg-zinc-50 border-zinc-200"
                                  value={selectedProject.config.odooConf}
                                  onChange={e => updateProjectConfig({ odooConf: e.target.value })}
                                />
                                <p className="text-[11px] text-zinc-400 mt-2">
                                  See the <a href="https://github.com/odoo/docker/blob/master/17.0/odoo.conf" target="_blank" rel="noopener noreferrer" className="underline text-blue-500 hover:text-blue-600">official template</a> for reference.
                                </p>
                              </CardContent>
                            </Card>

                          </div>
                        </TabsContent>

                        {/* ── Docker Compose Tab ── */}
                        <TabsContent value="compose">
                          <div className="flex justify-end mb-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => setShowAdvancedCompose(!showAdvancedCompose)}
                            >
                              {showAdvancedCompose ? <Settings2 className="w-4 h-4" /> : <FileCode className="w-4 h-4" />}
                              {showAdvancedCompose ? "Back to UI Config" : "Advanced (Raw YAML)"}
                            </Button>
                          </div>

                          {!showAdvancedCompose ? (
                            <div className="space-y-6">
                              {/* Section: Core Configuration */}
                              <Card className="border-zinc-200 shadow-sm">
                                <CardHeader className="pb-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                      <Settings2 className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                      <CardTitle className="text-base">Core Config</CardTitle>
                                      <CardDescription className="text-xs">Port mapping and Odoo image version</CardDescription>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-zinc-500">Host Port</Label>
                                      <Input
                                        type="number"
                                        value={selectedProject.config.hostPort || ''}
                                        onChange={e => updateProjectConfig({ hostPort: parseInt(e.target.value) || 8069 })}
                                      />
                                      <p className="text-[11px] text-zinc-400">Port mapped to container's <code>8069</code></p>
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-zinc-500">Odoo Version</Label>
                                      <Select
                                        value={selectedProject.config.odooVersion}
                                        onValueChange={v => updateProjectConfig({ odooVersion: v })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {ODOO_VERSIONS.map(v => (
                                            <SelectItem key={v} value={v}>
                                              Odoo {v}{v === '19.0' ? ' (latest)' : ''}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <p className="text-[11px] text-zinc-400">Official Docker image from <code>hub.docker.com/_/odoo</code></p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Section: Database */}
                              <Card className="border-zinc-200 shadow-sm">
                                <CardHeader className="pb-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                      <Database className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <div>
                                      <CardTitle className="text-base">Database</CardTitle>
                                      <CardDescription className="text-xs">PostgreSQL 15 connection settings</CardDescription>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-zinc-500">Database Name</Label>
                                      <Input
                                        value={selectedProject.config.dbName}
                                        onChange={e => updateProjectConfig({ dbName: e.target.value })}
                                      />
                                      <p className="text-[11px] text-zinc-400">Maps to <code>POSTGRES_DB</code></p>
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-zinc-500">Database User</Label>
                                      <Input
                                        value={selectedProject.config.dbUser}
                                        onChange={e => updateProjectConfig({ dbUser: e.target.value })}
                                      />
                                      <p className="text-[11px] text-zinc-400">Maps to <code>POSTGRES_USER</code></p>
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-zinc-500">Database Password</Label>
                                      <Input
                                        type="password"
                                        value={selectedProject.config.dbPassword}
                                        onChange={e => updateProjectConfig({ dbPassword: e.target.value })}
                                      />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Section: Addons */}
                              <Card className="border-zinc-200 shadow-sm">
                                <CardHeader className="pb-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                      <Package className="w-4 h-4 text-indigo-600" />
                                    </div>
                                    <div className="flex-1">
                                      <CardTitle className="text-base">Addons Volumes</CardTitle>
                                      <CardDescription className="text-xs">Map local folders or Enterprise modules</CardDescription>
                                    </div>
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      onClick={() => updateProjectConfig({ addonsPaths: [...(selectedProject.config.addonsPaths || []), ''] })}
                                    >
                                      <Plus className="w-3 h-3 mr-1" /> Add Path
                                    </Button>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="space-y-3">
                                    {(selectedProject.config.addonsPaths || []).map((path, index) => (
                                      <div key={index} className="flex gap-2 items-start">
                                        <div className="flex-1 space-y-1">
                                          <Input 
                                            value={path} 
                                            placeholder="./addons"
                                            onChange={e => {
                                              const newArr = [...(selectedProject.config.addonsPaths || [])];
                                              newArr[index] = e.target.value;
                                              updateProjectConfig({ addonsPaths: newArr });
                                            }} 
                                          />
                                          <p className="text-[10px] text-zinc-400">Mounted at <code>/mnt/extra-addons-{index}</code></p>
                                        </div>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="text-red-500 hover:bg-red-50 hover:text-red-600 h-9 w-9 mt-0.5"
                                          onClick={() => {
                                            const newArr = [...(selectedProject.config.addonsPaths || [])];
                                            newArr.splice(index, 1);
                                            updateProjectConfig({ addonsPaths: newArr });
                                          }}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ))}
                                    {(!selectedProject.config.addonsPaths || selectedProject.config.addonsPaths.length === 0) && (
                                      <div className="text-center py-4 bg-zinc-50 border border-dashed border-zinc-200 rounded-md text-zinc-400 text-xs">
                                        No addons paths configured.
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>


                              {/* Section: Logging & Health */}
                              <Card className="border-zinc-200 shadow-sm">
                                <CardHeader className="pb-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                                      <FileCode className="w-4 h-4 text-amber-600" />
                                    </div>
                                    <div>
                                      <CardTitle className="text-base">Logging & Health Check</CardTitle>
                                      <CardDescription className="text-xs">Container log rotation and health monitoring</CardDescription>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-zinc-500">Log Max Size</Label>
                                      <Input
                                        value={selectedProject.config.loggingConfig.maxSize}
                                        onChange={e => updateProjectConfig({ loggingConfig: { ...selectedProject.config.loggingConfig, maxSize: e.target.value } })}
                                        placeholder="10m"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-zinc-500">Log Max Files</Label>
                                      <Input
                                        value={selectedProject.config.loggingConfig.maxFile}
                                        onChange={e => updateProjectConfig({ loggingConfig: { ...selectedProject.config.loggingConfig, maxFile: e.target.value } })}
                                        placeholder="3"
                                      />
                                    </div>
                                  </div>
                                  <Separator className="my-4" />
                                  <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-zinc-500">Health Check Interval</Label>
                                      <Input
                                        value={selectedProject.config.healthCheck.interval}
                                        onChange={e => updateProjectConfig({ healthCheck: { ...selectedProject.config.healthCheck, interval: e.target.value } })}
                                        placeholder="30s"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-zinc-500">Health Check Timeout</Label>
                                      <Input
                                        value={selectedProject.config.healthCheck.timeout}
                                        onChange={e => updateProjectConfig({ healthCheck: { ...selectedProject.config.healthCheck, timeout: e.target.value } })}
                                        placeholder="10s"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs font-medium text-zinc-500">Health Check Retries</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={selectedProject.config.healthCheck.retries}
                                        onChange={e => updateProjectConfig({ healthCheck: { ...selectedProject.config.healthCheck, retries: parseInt(e.target.value) || 3 } })}
                                      />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          ) : (
                            <Card className="border-zinc-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                              <CardHeader className="bg-zinc-900 text-white py-3 px-6 flex flex-row items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileCode className="w-4 h-4 text-zinc-400" />
                                  <span className="text-xs font-mono">docker-compose.yml</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {selectedProject.config.customCompose !== undefined && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1"
                                      onClick={() => {
                                        updateProjectConfig({ customCompose: undefined });
                                        toast.info('Reset to auto-generated compose file.');
                                      }}
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                      Reset to Generated
                                    </Button>
                                  )}
                                  <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 border-zinc-700">
                                    {selectedProject.config.customCompose !== undefined ? 'CUSTOM' : 'AUTO'}
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent className="p-0">
                                <Textarea
                                  className="font-mono text-sm bg-zinc-950 text-zinc-300 border-none rounded-none min-h-[500px] focus-visible:ring-0 focus-visible:ring-offset-0 p-6 leading-relaxed resize-none"
                                  value={selectedProject.config.customCompose ?? generateDockerCompose(selectedProject.name, selectedProject.config)}
                                  onChange={e => updateProjectConfig({ customCompose: e.target.value })}
                                />
                              </CardContent>
                              <CardFooter className="bg-zinc-900 border-t border-zinc-800 py-2.5 px-6">
                                <p className="text-[11px] text-zinc-500">
                                  {selectedProject.config.customCompose !== undefined
                                    ? 'You are editing a custom compose file. Visual settings changes won\'t affect this until you reset.'
                                    : 'This file is auto-generated from your Settings. Edit it to switch to a custom compose file.'}
                                </p>
                              </CardFooter>
                            </Card>
                          )}
                        </TabsContent>

                        {/* ── Logs Tab ── */}
                        <TabsContent value="logs">
                          <Tabs defaultValue="activity" className="w-full">
                            <Card className="border-zinc-200 shadow-sm overflow-hidden bg-zinc-950">
                              <CardHeader className="border-b border-zinc-800 py-2 px-6 flex flex-row items-center justify-between bg-zinc-900/50">
                                <TabsList className="bg-zinc-800 border-zinc-700 h-8 p-0.5">
                                  <TabsTrigger value="activity" className="text-[10px] h-7 px-3 data-[state=active]:bg-zinc-700 data-[state=active]:text-white">PROJECT ACTIVITY</TabsTrigger>
                                  <TabsTrigger value="terminal" className="text-[10px] h-7 px-3 data-[state=active]:bg-zinc-700 data-[state=active]:text-white">TERMINAL OUTPUT</TabsTrigger>
                                </TabsList>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] border-zinc-800 text-zinc-500 font-mono">
                                    {(selectedProject.status || 'idle').toUpperCase()}
                                  </Badge>
                                </div>
                              </CardHeader>
                              
                              <CardContent className="p-0">
                                <TabsContent value="activity" className="m-0">
                                  <ScrollArea className="h-[400px] p-6">
                                    <div className="font-mono text-xs space-y-2">
                                      {(!selectedProject.projectLogs || selectedProject.projectLogs.length === 0) ? (
                                        <div className="text-zinc-600 italic">No project activity recorded yet.</div>
                                      ) : (
                                        selectedProject.projectLogs.map((log, i) => (
                                          <div key={i} className="flex gap-3 border-l-2 border-zinc-800 pl-4 py-1">
                                            <span className="text-zinc-300 leading-relaxed tabular-nums">
                                              {log}
                                            </span>
                                          </div>
                                        ))
                                      )}
                                      <div ref={logEndRef} />
                                    </div>
                                  </ScrollArea>
                                </TabsContent>
                                
                                <TabsContent value="terminal" className="m-0">
                                  <ScrollArea className="h-[400px] p-6">
                                    <div className="font-mono text-xs space-y-1">
                                      {(!selectedProject.containerLogs || selectedProject.containerLogs.length === 0) ? (
                                        <div className="text-zinc-600 italic">No container output available. Start the project to see logs.</div>
                                      ) : (
                                        selectedProject.containerLogs.map((log, i) => (
                                          <div key={i} className="flex gap-4">
                                            <span className="text-zinc-600 shrink-0 select-none">{(i + 1).toString().padStart(4, '0')}</span>
                                            <span className={
                                              log.toLowerCase().includes('error') ? 'text-red-400' : 
                                              log.toLowerCase().includes('warn') ? 'text-amber-400' :
                                              'text-zinc-300'
                                            }>
                                              {log}
                                            </span>
                                          </div>
                                        ))
                                      )}
                                      <div ref={logEndRef} />
                                    </div>
                                  </ScrollArea>
                                </TabsContent>
                              </CardContent>
                            </Card>
                          </Tabs>
                        </TabsContent>
                      </Tabs>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </>
        ) : organizations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50">
            <div className="max-w-md w-full p-8 text-center">
              <div className="w-20 h-20 bg-white shadow-sm rounded-2xl flex items-center justify-center mx-auto mb-8 border border-zinc-100">
                <Building2 className="w-10 h-10 text-zinc-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Welcome to Odoo Manager</h2>
              <p className="text-zinc-500 mb-8">Get started by creating an organization to group your Odoo projects.</p>
              {isAdmin && (
              <Button onClick={() => setIsNewOrgDialogOpen(true)} className="w-full h-12 text-lg">
                Create First Organization
              </Button>
              )}
              {!isAdmin && (
              <p className="text-zinc-400 text-sm">Ask an admin to create an organization.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-zinc-50 p-8">
            <div className="max-w-7xl w-full mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">Organizations</h1>
                  <p className="text-zinc-500">Select an organization to manage its projects.</p>
                </div>
                {isAdmin && (
                <Button onClick={() => setIsNewOrgDialogOpen(true)} className="gap-2 shadow-sm rounded-lg">
                  <Plus className="w-4 h-4" />
                  New Organization
                </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {organizations.map(org => (
                  <motion.div
                    key={org.id}
                    layoutId={org.id}
                    whileHover={{ y: -4 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  >
                    <Card 
                      className="group cursor-pointer border-zinc-200 hover:border-zinc-900 transition-all hover:shadow-xl bg-white overflow-hidden h-full flex flex-col"
                      onClick={() => setSelectedOrgId(org.id)}
                    >
                      <CardHeader className="pb-3 px-6 pt-6">
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-10 h-10 rounded-lg bg-zinc-50 flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white transition-colors">
                            <Building2 className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
                          </div>
                          <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 text-[10px] uppercase font-bold">
                            {org.projects.length} {org.projects.length === 1 ? 'Project' : 'Projects'}
                          </Badge>
                        </div>
                        <CardTitle className="text-xl group-hover:text-zinc-900 truncate">{org.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="px-6 py-3 flex-1">
                         <div className="text-xs text-zinc-500">
                           Created on {new Date(org.createdAt).toLocaleDateString()}
                         </div>
                      </CardContent>
                      <CardFooter className="px-6 pb-6 pt-0 mt-auto">
                        <Button variant="ghost" className="w-full text-zinc-500 group-hover:text-zinc-900 group-hover:bg-zinc-50 gap-2 h-9 text-xs font-semibold">
                          View Dashboard
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {/* New Organization Dialog */}
      <Dialog open={isNewOrgDialogOpen} onOpenChange={setIsNewOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Organization</DialogTitle>
            <DialogDescription>Create a new workspace for your Odoo projects.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input 
              id="org-name" 
              value={newOrgName} 
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleCreateOrg}>Create Organization</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <Dialog open={!!projectToDelete} onOpenChange={(open) => {
        if (!open) {
          setProjectToDelete(null);
          setDeleteConfirmationText('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the <strong>{projectToDelete?.name}</strong> project configuration from your workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-zinc-700 mb-2 block">
              Please type <strong>{projectToDelete?.name}</strong> to confirm.
            </Label>
            <Input
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder={projectToDelete?.name}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setProjectToDelete(null);
              setDeleteConfirmationText('');
            }}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              disabled={deleteConfirmationText !== projectToDelete?.name}
              onClick={() => {
                if (projectToDelete) {
                   handleDeleteProject(projectToDelete);
                   setProjectToDelete(null);
                   setDeleteConfirmationText('');
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Organization Dialog */}
      <Dialog open={!!orgToDelete} onOpenChange={(open) => {
        if (!open) {
          setOrgToDelete(null);
          setDeleteConfirmationText('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the <strong>{orgToDelete?.name}</strong> organization.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-zinc-700 mb-2 block">
              Please type <strong>{orgToDelete?.name}</strong> to confirm.
            </Label>
            <Input
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              placeholder={orgToDelete?.name}
            />
          </div>
          <DialogFooter className="flex-col items-center sm:flex-row gap-2">
            {(orgToDelete?.projects.length || 0) > 0 && (
              <p className="text-sm text-red-500 font-medium flex-1 text-left mb-2 sm:mb-0">
                You must delete all {orgToDelete?.projects.length} project(s) first.
              </p>
            )}
            <Button variant="outline" onClick={() => {
              setOrgToDelete(null);
              setDeleteConfirmationText('');
            }}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              disabled={deleteConfirmationText !== orgToDelete?.name || (orgToDelete?.projects.length || 0) > 0}
              onClick={() => {
                if (orgToDelete) {
                   handleDeleteOrg(orgToDelete);
                   setOrgToDelete(null);
                   setDeleteConfirmationText('');
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
