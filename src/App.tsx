import { useState, useEffect, useRef } from 'react';
import { Plus, Folder, Building2, Download, Copy, Settings2, Trash2, LayoutDashboard, FileCode, Database, Server, Terminal, Play, Square, RefreshCw, Activity, Rocket, FlaskConical, StopCircle, CheckCircle2, AlertCircle, Loader2, ExternalLink, Package } from 'lucide-react';
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

export default function App() {
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
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  const [showAdvancedCompose, setShowAdvancedCompose] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const res = await fetch('/api/organizations');
        const data = await res.json();
        setOrganizations(data);
      } catch (e) {
        console.error("Failed to fetch organizations", e);
      }
    };
    fetchOrgs();
  }, []);

  const selectedOrg = organizations.find(org => org.id === selectedOrgId);
  const selectedProject = selectedOrg?.projects.find(p => p.id === selectedProjectId);

  // Helper to update project-level fields (name, description, etc.)
  const updateProject = async (updates: Partial<Project>) => {
    if (!selectedOrgId || !selectedProjectId) return;
    
    // Update local state for immediate UI feedback
    setOrganizations(prev => prev.map(org =>
      org.id === selectedOrgId
        ? { ...org, projects: org.projects.map(p => p.id === selectedProjectId ? { ...p, ...updates } : p) }
        : org
    ));

    // Save to backend
    try {
      await fetch(`/api/projects/${selectedProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
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
      await fetch(`/api/projects/${selectedProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: newConfig })
      });
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
        const res = await fetch(`/api/projects/${selectedProjectId}/logs${containerParam}`);
        const data = await res.json();
        if (data.logs && data.logs.length > 0) {
          setOrganizations(prev => prev.map(org => ({
            ...org,
            projects: org.projects.map(p => 
              p.id === selectedProjectId 
                ? { ...p, logs: data.logs } 
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
  }, [selectedProject?.logs]);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    const newOrg: Organization = {
      id: crypto.randomUUID(),
      name: newOrgName,
      projects: [],
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrg)
      });
      if (!res.ok) throw new Error("Failed to create organization");
      
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
      logs: ['[SYSTEM] Project created. Ready to deploy when you are.']
    };
    
    try {
      const res = await fetch(`/api/organizations/${selectedOrgId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
      });
      if (!res.ok) throw new Error("Failed to create project");

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
        logs: [...(p.logs || []), `[SYSTEM] ${forcePull ? 'Force pulling latest image and rebuilding...' : 'Initializing deployment...'}`, `[SYSTEM] Using Odoo ${project.config.odooVersion} image...`, '[SYSTEM] Creating Docker network and containers...'] 
      } : p)
    })));

    toast.promise(
      async () => {
        const res = await fetch('/api/projects/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            projectId: project.id, 
            config: project.config,
            name: project.name,
            forcePull
          })
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to deploy containers');
        }
        
        return res.json();
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
              logs: [...(p.logs || []), `[SYSTEM] ✅ Odoo ${project.config.odooVersion} running on port ${data.port}.`] 
            } : p)
          })));
          return 'Containers deployed and running!';
        },
        error: (err) => {
          setOrganizations(prev => prev.map(org => ({
            ...org,
            projects: org.projects.map(p => p.id === project.id ? { ...p, status: 'error', logs: [...(p.logs || []), `[ERROR] ${err.message}`] } : p)
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
        logs: [...(p.logs || []), '[TEST] Running configuration tests...'] 
      } : p)
    })));

    toast.promise(
      async () => {
        const res = await fetch('/api/projects/test-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            projectId: project.id, 
            config: project.config,
            name: project.name 
          })
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Configuration test failed');
        }
        
        return res.json();
      },
      {
        loading: 'Testing configuration...',
        success: (data) => {
          setOrganizations(prev => prev.map(org => ({
            ...org,
            projects: org.projects.map(p => p.id === project.id ? { 
              ...p, 
              logs: [...(p.logs || []), ...data.results.map((r: string) => `[TEST] ${r}`), '[TEST] ✅ All tests passed!'] 
            } : p)
          })));
          return 'All configuration tests passed!';
        },
        error: (err) => {
          setOrganizations(prev => prev.map(org => ({
            ...org,
            projects: org.projects.map(p => p.id === project.id ? { 
              ...p, 
              logs: [...(p.logs || []), `[TEST] ❌ ${err.message}`] 
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
        const res = await fetch(`/api/projects/${project.id}/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            containerId: project.containerId,
            dbContainerId: project.dbContainerId 
          })
        });
        if (!res.ok) throw new Error('Failed to stop container');
        return res.json();
      },
      {
        loading: 'Stopping containers...',
        success: () => {
          setOrganizations(prev => prev.map(org => ({
            ...org,
            projects: org.projects.map(p => p.id === project.id ? { 
              ...p, 
              status: 'stopped', 
              logs: [...(p.logs || []), '[SYSTEM] Odoo and database containers stopped.'] 
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
        const res = await fetch(`/api/projects/${project.id}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            containerId: project.containerId,
            dbContainerId: project.dbContainerId 
          })
        });
        if (!res.ok) throw new Error('Failed to start container');
        return res.json();
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
              logs: [...(p.logs || []), '[SYSTEM] Odoo and database containers started.'] 
            } : p)
          })));
          return 'Containers started.';
        },
        error: (err) => err.message
      }
    );
  };

  const handleDeleteProject = (project: Project) => {
    if (!selectedOrgId) return;

    toast.promise(
      async () => {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            containerId: project.containerId,
            dbContainerId: project.dbContainerId,
            name: project.name
          })
        });
        if (!res.ok) throw new Error('Failed to delete containers');
        return res.json();
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

  return (
    <div className="flex h-screen bg-zinc-50 font-sans text-zinc-900">
      <Toaster position="top-right" />
      
      {/* Sidebar */}
      <aside className="w-72 border-r border-zinc-200 bg-white flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Server className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">Odoo Manager</h1>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Organizations</span>
              <Dialog open={isNewOrgDialogOpen} onOpenChange={setIsNewOrgDialogOpen}>
                <DialogTrigger render={<Button variant="ghost" size="icon" className="h-6 w-6" />}>
                  <Plus className="h-4 w-4" />
                </DialogTrigger>
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
            </div>
            
            <ScrollArea className="h-[calc(100vh-200px)]">
              {organizations.map(org => (
                <button
                  key={org.id}
                  onClick={() => {
                    setSelectedOrgId(org.id);
                    setSelectedProjectId(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    selectedOrgId === org.id ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span className="text-sm font-medium truncate">{org.name}</span>
                  {org.projects.length > 0 && (
                    <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 h-4">
                      {org.projects.length}
                    </Badge>
                  )}
                </button>
              ))}
            </ScrollArea>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {selectedOrg ? (
          <>
            {/* Header */}
            <header className="h-16 border-b border-zinc-200 bg-white px-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">{selectedOrg.name}</h2>
                <Separator orientation="vertical" className="h-4" />
                <nav className="flex items-center gap-1 text-sm text-zinc-500">
                  <LayoutDashboard className="w-4 h-4 mr-1" />
                  <span>Projects</span>
                </nav>
              </div>
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
            </header>

            {/* Content Area */}
            <div className="flex-1 flex overflow-hidden">
              {/* Project List */}
              <div className="w-80 border-r border-zinc-200 bg-white overflow-y-auto">
                <div className="p-4 space-y-2">
                  {selectedOrg.projects.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <Folder className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                      <p className="text-sm text-zinc-500">No projects yet. Create one to get started.</p>
                    </div>
                  ) : (
                    selectedOrg.projects.map(project => (
                      <button
                        key={project.id}
                        onClick={() => setSelectedProjectId(project.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          selectedProjectId === project.id 
                            ? 'border-zinc-900 bg-zinc-900 text-white shadow-lg' 
                            : 'border-zinc-200 hover:border-zinc-300 bg-white text-zinc-900'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              project.status === 'running' ? 'bg-emerald-400' :
                              project.status === 'deploying' ? 'bg-amber-400 animate-pulse' :
                              project.status === 'error' ? 'bg-red-400' :
                              project.status === 'stopped' ? 'bg-zinc-400' :
                              'bg-blue-400'
                            }`} />
                            <Badge variant={selectedProjectId === project.id ? 'secondary' : 'outline'} className="text-[10px]">
                              v{project.config.odooVersion}
                            </Badge>
                          </div>
                          <span className="text-[10px] opacity-60">
                            {new Date(project.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="font-semibold text-sm mb-1 truncate">{project.name}</h3>
                        <p className={`text-xs truncate ${selectedProjectId === project.id ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          {project.description || 'No description'}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Project Detail */}
              <div className="flex-1 bg-zinc-50 overflow-y-auto p-8">
                <AnimatePresence mode="wait">
                  {selectedProject ? (
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
                          <Button variant="destructive" size="sm" onClick={() => {
                            setProjectToDelete(selectedProject);
                            setDeleteConfirmationText('');
                          }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Action Buttons Panel */}
                      <Card className="border-zinc-200 shadow-sm bg-white">
                        <CardContent className="p-5">
                          <div className="flex items-center gap-3 flex-wrap">
                            {(selectedProject.status === 'idle' || selectedProject.status === 'error') && (
                              <Button 
                                size="sm" 
                                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                onClick={() => handleDeployProject(selectedProject)}
                              >
                                <Rocket className="w-4 h-4" />
                                Deploy Containers
                              </Button>
                            )}
                            {selectedProject.status === 'stopped' && (
                              <Button 
                                size="sm" 
                                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                onClick={() => handleStartProject(selectedProject)}
                              >
                                <Play className="w-4 h-4" />
                                Start Containers
                              </Button>
                            )}
                            {selectedProject.status === 'running' && (
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
                            {selectedProject.status !== 'deploying' && (
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
                            {selectedProject.status !== 'deploying' && (
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
                          <Card className="border-zinc-200 shadow-sm overflow-hidden bg-zinc-950">
                            <CardHeader className="border-b border-zinc-800 py-3 px-6 flex flex-row items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-zinc-400" />
                                <span className="text-xs font-mono text-zinc-400">Container Logs</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] border-zinc-800 text-zinc-500">
                                  {(selectedProject.status || 'idle').toUpperCase()}
                                </Badge>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-white hover:bg-zinc-800">
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent className="p-0">
                              <ScrollArea className="h-[400px] p-6">
                                <div className="font-mono text-xs space-y-1">
                                  {(selectedProject.logs || []).map((log, i) => (
                                    <div key={i} className="flex gap-4">
                                      <span className="text-zinc-600 shrink-0">[{i + 1}]</span>
                                      <span className={
                                        log.startsWith('[SYSTEM]') ? 'text-blue-400' : 
                                        log.startsWith('[TEST]') ? 'text-violet-400' :
                                        log.startsWith('[ERROR]') ? 'text-red-400' :
                                        'text-zinc-300'
                                      }>
                                        {log}
                                      </span>
                                    </div>
                                  ))}
                                  <div ref={logEndRef} />
                                </div>
                              </ScrollArea>
                            </CardContent>
                          </Card>
                        </TabsContent>
                      </Tabs>
                    </motion.div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-6">
                        <LayoutDashboard className="w-8 h-8 text-zinc-300" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Select a project</h3>
                      <p className="text-zinc-500 max-w-xs">Choose a project from the sidebar to view its configuration and generate Docker Compose files.</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50">
            <div className="max-w-md w-full p-8 text-center">
              <div className="w-20 h-20 bg-white shadow-sm rounded-2xl flex items-center justify-center mx-auto mb-8 border border-zinc-100">
                <Building2 className="w-10 h-10 text-zinc-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Welcome to Odoo Manager</h2>
              <p className="text-zinc-500 mb-8">Get started by creating an organization to group your Odoo projects.</p>
              <Button onClick={() => setIsNewOrgDialogOpen(true)} className="w-full h-12 text-lg">
                Create First Organization
              </Button>
            </div>
          </div>
        )}
      </main>

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
    </div>
  );
}
