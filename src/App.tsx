import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BluetoothPrinterProvider } from "@/contexts/BluetoothPrinterContext";
import Index from "./pages/Index";
import Inventory from "./pages/Inventory";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import Invoice from "./pages/Invoice";
import Transactions from "./pages/Transactions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BluetoothPrinterProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Index />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/invoice/:id" element={<Invoice />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </BluetoothPrinterProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
