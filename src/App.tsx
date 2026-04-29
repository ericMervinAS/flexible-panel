import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AccessGate from "./components/AccessGate";
import ImportGate, { type ImportFolder } from "./components/ImportGate";

const queryClient = new QueryClient();

const App = () => {
  const [importSource, setImportSource] = useState<"pending" | "sample" | ImportFolder>("pending");

  return (
    <AccessGate>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {importSource === "pending" ? (
            <ImportGate onReady={setImportSource} />
          ) : (
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index importSource={importSource} />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          )}
        </TooltipProvider>
      </QueryClientProvider>
    </AccessGate>
  );
};

export default App;
