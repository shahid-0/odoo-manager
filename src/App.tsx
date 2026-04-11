import { useState, useEffect, useRef } from 'react';
import { Plus, Folder, Building2, Download, Copy, Settings2, Trash2, LayoutDashboard, FileCode, Database, Server, Terminal, Play, Square, RefreshCw, Activity } from 'lucide-react';
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
import { Organization, Project, ProjectConfig, OdooVersion } from './types';
import { ODOO_VERSIONS, DEFAULT_PROJECT_CONFIG } from './constants';
import { generateDockerCompose } from './lib/docker-utils';

export default function App() {
  const [organizations, setOrganizations] = useState<Organization[]>(() => {
    const saved = localStorage.getItem('odoo-manager-orgs');
    return saved ? JSON.parse(saved) : [];
  });
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

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('odoo-manager-orgs', JSON.stringify(organizations));
  }, [organizations]);

  const selectedOrg = organizations.find(org => org.id === selectedOrgId);
  const selectedProject = selectedOrg?.projects.find(p => p.id === selectedProjectId);

  // Periodically fetch logs for the selected project if it's running
  useEffect(() => {
    if (!selectedProjectId || !selectedProject || selectedProject.status !== 'running') return;

    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/projects/${selectedProjectId}/logs`);
        const data = await res.json();
        if (data.logs) {
          setOrganizations(prev => prev.map(org => ({
            ...org,
            projects: org.projects.map(p => 
              p.id === selectedProjectId 
                ? { ...p, logs: [...(p.logs || []), ...data.logs.filter((l: string) => !(p.logs || []).includes(l))] } 
                : p
            )
          })));
        }
      } catch (e) {
        console.error("Failed to fetch logs", e);
      }
    };

    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [selectedProjectId, selectedProject?.status]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedProject?.logs]);

  const handleCreateOrg = () => {
    if (!newOrgName.trim()) return;
    const newOrg: Organization = {
      id: crypto.randomUUID(),
      name: newOrgName,
      projects: [],
      createdAt: new Date().toISOString(),
    };
    setOrganizations([...organizations, newOrg]);
    setNewOrgName('');
    setIsNewOrgDialogOpen(false);
    setSelectedOrgId(newOrg.id);
    toast.success('Organization created successfully');
  };

  const handleCreateProject = async () => {
    if (!selectedOrgId || !newProject.name.trim()) return;
    const project: Project = {
      id: crypto.randomUUID(),
      ...newProject,
      createdAt: new Date().toISOString(),
      status: 'deploying',
      logs: ['[SYSTEM] Initializing deployment...', '[SYSTEM] Generating Docker Compose file...']
    };
    
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
    
    toast.promise(
      fetch('/api/projects/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, config: project.config })
      }),
      {
        loading: 'Deploying containers...',
        success: () => {
          setTimeout(() => {
            setOrganizations(prev => prev.map(org => ({
              ...org,
              projects: org.projects.map(p => p.id === project.id ? { ...p, status: 'running', logs: [...(p.logs || []), '[SYSTEM] Containers started successfully.'] } : p)
            })));
          }, 2000);
          return 'Deployment triggered successfully';
        },
        error: 'Failed to deploy containers'
      }
    );
  };

  const handleDeleteProject = (projectId: string) => {
    if (!selectedOrgId) return;
    setOrganizations(organizations.map(org => 
      org.id === selectedOrgId 
        ? { ...org, projects: org.projects.filter(p => p.id !== projectId) }
        : org
    ));
    if (selectedProjectId === projectId) setSelectedProjectId(null);
    toast.info('Project deleted');
  };

  const handleCopyCompose = () => {
    if (!selectedProject) return;
    const compose = generateDockerCompose(selectedProject.name, selectedProject.config);
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
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>Configure your Odoo instance and services.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="p-name">Project Name</Label>
                        <Input 
                          id="p-name" 
                          value={newProject.name}
                          onChange={e => setNewProject({...newProject, name: e.target.value})}
                          placeholder="My Awesome Odoo" 
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
                              <SelectItem key={v} value={v}>Odoo {v}</SelectItem>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="db-name">Database Name</Label>
                        <Input 
                          id="db-name" 
                          value={newProject.config.dbName}
                          onChange={e => setNewProject({...newProject, config: {...newProject.config, dbName: e.target.value}})}
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
                        placeholder="./extra-addons" 
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreateProject}>Create Project</Button>
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
                          <Badge variant={selectedProjectId === project.id ? 'secondary' : 'outline'} className="text-[10px]">
                            v{project.config.odooVersion}
                          </Badge>
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
                          <h2 className="text-3xl font-bold tracking-tight mb-2">{selectedProject.name}</h2>
                          <p className="text-zinc-500 max-w-2xl">{selectedProject.description}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="gap-2" onClick={handleCopyCompose}>
                            <Copy className="w-4 h-4" />
                            Copy YAML
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteProject(selectedProject.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <Tabs defaultValue="compose" className="w-full">
                        <TabsList className="grid w-full grid-cols-5 mb-8">
                          <TabsTrigger value="compose" className="gap-2">
                            <FileCode className="w-4 h-4" />
                            Docker Compose
                          </TabsTrigger>
                          <TabsTrigger value="logs" className="gap-2">
                            <Terminal className="w-4 h-4" />
                            Logs
                          </TabsTrigger>
                          <TabsTrigger value="config" className="gap-2">
                            <Settings2 className="w-4 h-4" />
                            odoo.conf
                          </TabsTrigger>
                          <TabsTrigger value="resources" className="gap-2">
                            <Database className="w-4 h-4" />
                            Resources
                          </TabsTrigger>
                          <TabsTrigger value="guide" className="gap-2">
                            <FileCode className="w-4 h-4" />
                            Setup Guide
                          </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="compose">
                          <Card className="border-zinc-200 shadow-sm overflow-hidden">
                            <CardHeader className="bg-zinc-900 text-white py-3 px-6 flex flex-row items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileCode className="w-4 h-4 text-zinc-400" />
                                <span className="text-xs font-mono">docker-compose.yml</span>
                              </div>
                              <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 border-zinc-700">YAML</Badge>
                            </CardHeader>
                            <CardContent className="p-0">
                              <pre className="p-6 bg-zinc-950 text-zinc-300 text-sm font-mono overflow-x-auto leading-relaxed">
                                {generateDockerCompose(selectedProject.name, selectedProject.config)}
                              </pre>
                            </CardContent>
                          </Card>
                        </TabsContent>

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
                                      <span className={log.startsWith('[SYSTEM]') ? 'text-blue-400' : 'text-zinc-300'}>
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

                        <TabsContent value="config">
                          <Card className="border-zinc-200 shadow-sm">
                            <CardHeader>
                              <CardTitle className="text-lg">Odoo Configuration</CardTitle>
                              <CardDescription>Edit your odoo.conf file directly.</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <Textarea 
                                className="font-mono text-sm min-h-[400px] bg-zinc-50"
                                value={selectedProject.config.odooConf}
                                onChange={e => {
                                  const updatedOrgs = organizations.map(org => 
                                    org.id === selectedOrgId 
                                      ? { 
                                          ...org, 
                                          projects: org.projects.map(p => 
                                            p.id === selectedProject.id 
                                              ? { ...p, config: { ...p.config, odooConf: e.target.value } }
                                              : p
                                          ) 
                                        }
                                      : org
                                  );
                                  setOrganizations(updatedOrgs);
                                }}
                              />
                            </CardContent>
                          </Card>
                        </TabsContent>

                        <TabsContent value="resources">
                          <div className="grid grid-cols-2 gap-6">
                            <Card className="border-zinc-200 shadow-sm">
                              <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                  <Server className="w-4 h-4" />
                                  Resource Limits
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="space-y-2">
                                  <Label>Memory Limit</Label>
                                  <Input 
                                    value={selectedProject.config.resourceLimits.memory}
                                    onChange={e => {
                                      const updatedOrgs = organizations.map(org => 
                                        org.id === selectedOrgId 
                                          ? { 
                                              ...org, 
                                              projects: org.projects.map(p => 
                                                p.id === selectedProject.id 
                                                  ? { ...p, config: { ...p.config, resourceLimits: { ...p.config.resourceLimits, memory: e.target.value } } }
                                                  : p
                                              ) 
                                            }
                                          : org
                                      );
                                      setOrganizations(updatedOrgs);
                                    }}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>CPU Limit</Label>
                                  <Input 
                                    value={selectedProject.config.resourceLimits.cpu}
                                    onChange={e => {
                                      const updatedOrgs = organizations.map(org => 
                                        org.id === selectedOrgId 
                                          ? { 
                                              ...org, 
                                              projects: org.projects.map(p => 
                                                p.id === selectedProject.id 
                                                  ? { ...p, config: { ...p.config, resourceLimits: { ...p.config.resourceLimits, cpu: e.target.value } } }
                                                  : p
                                              ) 
                                            }
                                          : org
                                      );
                                      setOrganizations(updatedOrgs);
                                    }}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Replicas (Scaling)</Label>
                                  <Input 
                                    type="number"
                                    value={selectedProject.config.replicas}
                                    onChange={e => {
                                      const updatedOrgs = organizations.map(org => 
                                        org.id === selectedOrgId 
                                          ? { 
                                              ...org, 
                                              projects: org.projects.map(p => 
                                                p.id === selectedProject.id 
                                                  ? { ...p, config: { ...p.config, replicas: parseInt(e.target.value) || 1 } }
                                                  : p
                                              ) 
                                            }
                                          : org
                                      );
                                      setOrganizations(updatedOrgs);
                                    }}
                                  />
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="border-zinc-200 shadow-sm">
                              <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                  <FileCode className="w-4 h-4" />
                                  Logging & Health
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Log Max Size</Label>
                                    <Input 
                                      value={selectedProject.config.loggingConfig.maxSize}
                                      onChange={e => {
                                        const updatedOrgs = organizations.map(org => 
                                          org.id === selectedOrgId 
                                            ? { 
                                                ...org, 
                                                projects: org.projects.map(p => 
                                                  p.id === selectedProject.id 
                                                    ? { ...p, config: { ...p.config, loggingConfig: { ...p.config.loggingConfig, maxSize: e.target.value } } }
                                                    : p
                                                ) 
                                              }
                                            : org
                                        );
                                        setOrganizations(updatedOrgs);
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Log Max Files</Label>
                                    <Input 
                                      value={selectedProject.config.loggingConfig.maxFile}
                                      onChange={e => {
                                        const updatedOrgs = organizations.map(org => 
                                          org.id === selectedOrgId 
                                            ? { 
                                                ...org, 
                                                projects: org.projects.map(p => 
                                                  p.id === selectedProject.id 
                                                    ? { ...p, config: { ...p.config, loggingConfig: { ...p.config.loggingConfig, maxFile: e.target.value } } }
                                                    : p
                                                ) 
                                              }
                                            : org
                                        );
                                        setOrganizations(updatedOrgs);
                                      }}
                                    />
                                  </div>
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                  <Label>Health Interval</Label>
                                  <Input 
                                    value={selectedProject.config.healthCheck.interval}
                                    onChange={e => {
                                      const updatedOrgs = organizations.map(org => 
                                        org.id === selectedOrgId 
                                          ? { 
                                              ...org, 
                                              projects: org.projects.map(p => 
                                                p.id === selectedProject.id 
                                                  ? { ...p, config: { ...p.config, healthCheck: { ...p.config.healthCheck, interval: e.target.value } } }
                                                  : p
                                              ) 
                                            }
                                          : org
                                      );
                                      setOrganizations(updatedOrgs);
                                    }}
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </TabsContent>

                        <TabsContent value="guide">
                          <Card className="border-zinc-200 shadow-sm">
                            <CardHeader>
                              <CardTitle>Setup & Security Guide</CardTitle>
                              <CardDescription>Best practices for deploying your Odoo instance.</CardDescription>
                            </CardHeader>
                            <CardContent className="prose prose-zinc max-w-none text-sm space-y-6">
                              <section>
                                <h4 className="font-bold text-zinc-900 mb-2">1. Directory Structure</h4>
                                <pre className="bg-zinc-100 p-4 rounded-lg text-xs">
{`project-folder/
├── docker-compose.yml
├── config/
│   └── odoo.conf
└── extra-addons/ (your custom modules)`}
                                </pre>
                              </section>

                              <section>
                                <h4 className="font-bold text-zinc-900 mb-2">2. Security Best Practices</h4>
                                <ul className="list-disc pl-5 space-y-2 text-zinc-600">
                                  <li><strong>Secrets Management:</strong> Avoid hardcoding passwords in the compose file for production. Use Docker Secrets or an <code className="bg-zinc-100 px-1 rounded">.env</code> file.</li>
                                  <li><strong>Network Isolation:</strong> The generated file uses a bridge network to isolate Odoo and Postgres from other containers.</li>
                                  <li><strong>Database Security:</strong> Change the default <code className="bg-zinc-100 px-1 rounded">odoo</code> user password and ensure the database port (5432) is NOT exposed to the public internet.</li>
                                  <li><strong>Resource Limits:</strong> We have included CPU and Memory limits to prevent a single container from crashing the host.</li>
                                </ul>
                              </section>

                              <section>
                                <h4 className="font-bold text-zinc-900 mb-2">3. Scaling & Updates</h4>
                                <ul className="list-disc pl-5 space-y-2 text-zinc-600">
                                  <li><strong>Scaling:</strong> Use <code className="bg-zinc-100 px-1 rounded">docker-compose up --scale web=3</code> to run multiple Odoo instances (requires a load balancer like Nginx).</li>
                                  <li><strong>Updates:</strong> To update Odoo, change the version in the UI, copy the new YAML, and run <code className="bg-zinc-100 px-1 rounded">docker-compose pull && docker-compose up -d</code>.</li>
                                </ul>
                              </section>
                            </CardContent>
                          </Card>
                        </TabsContent>
                      </Tabs>

                      <Card className="bg-zinc-900 text-white border-none">
                        <CardHeader>
                          <CardTitle className="text-lg">Deployment Instructions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-zinc-400 text-sm">
                          <p>1. Create a directory for your project: <code className="text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded">mkdir {selectedProject.name.toLowerCase().replace(/\s+/g, '-')}</code></p>
                          <p>2. Create a <code className="text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded">docker-compose.yml</code> file and paste the generated YAML.</p>
                          <p>3. Create a <code className="text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded">config/odoo.conf</code> file and paste the configuration.</p>
                          <p>4. Ensure your addons directory exists at <code className="text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded">{selectedProject.config.addonsPath}</code>.</p>
                          <p>5. Run <code className="text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded">docker-compose up -d</code> to start the instance.</p>
                        </CardContent>
                      </Card>
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
    </div>
  );
}

