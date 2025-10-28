import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import TranslatorPage from "@/pages/translator";
import ProjectsPage from "@/pages/projects";
import SystemLogsPage from "@/pages/system-logs";
import GlobalSettingsPage from "@/pages/global-settings";
import ModelsPage from "@/pages/models";
import { Database, FileText, Activity, Settings, Brain } from "lucide-react";

function Router() {
  const [location] = useLocation();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header className="border-b bg-white dark:bg-gray-900 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold">نظام الترجمة الذكي</h1>
              
              <nav className="flex items-center gap-2">
                <Link href="/projects">
                  <Button 
                    variant={location === "/projects" || location === "/" ? "default" : "ghost"}
                    size="sm"
                  >
                    <Database className="w-4 h-4 mr-2" />
                    المشاريع المحفوظة
                  </Button>
                </Link>
                
                <Link href="/translator">
                  <Button 
                    variant={location.startsWith("/translator") ? "default" : "ghost"}
                    size="sm"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    المترجم
                  </Button>
                </Link>
                
                <Link href="/logs">
                  <Button 
                    variant={location === "/logs" ? "default" : "ghost"}
                    size="sm"
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    سجل النظام
                  </Button>
                </Link>
                
                <Link href="/models">
                  <Button 
                    variant={location === "/models" ? "default" : "ghost"}
                    size="sm"
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    النماذج
                  </Button>
                </Link>
                
                <Link href="/settings">
                  <Button 
                    variant={location === "/settings" ? "default" : "ghost"}
                    size="sm"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    الإعدادات
                  </Button>
                </Link>
              </nav>
            </div>
            
            <div className="text-sm text-muted-foreground">
              يدعم PHP, JSON, PO, CSV
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <Switch>
          <Route path="/" component={ProjectsPage} />
          <Route path="/projects" component={ProjectsPage} />
          <Route path="/translator" component={TranslatorPage} />
          <Route path="/logs" component={SystemLogsPage} />
          <Route path="/models" component={ModelsPage} />
          <Route path="/settings" component={GlobalSettingsPage} />
          <Route component={ProjectsPage} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
