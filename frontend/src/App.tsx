import InvoiceWorkspace from './pages/InvoiceWorkspace';
import InvoicingAccounts from './pages/InvoicingAccounts';
import PartyHistory from './pages/PartyHistory';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductForm from "./pages/ProductForm";
import BonAchatPage from "./pages/BonAchat";
import BonAchatDetail from "./pages/BonAchatDetail";
import BonAchatForm from "./pages/BonAchatForm";
import FacturesPage from "./pages/Factures";
import FactureDetail from "./pages/FactureDetail";
import FactureForm from "./pages/FactureForm";
import Suppliers from "./pages/Suppliers";
import SupplierForm from "./pages/SupplierForm";
import Clients from "./pages/Clients";
import ClientForm from "./pages/ClientForm";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Products />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/products/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProductForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/products/:id/edit"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ProductForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bon-achat"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BonAchatPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bon-achat/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BonAchatForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bon-achat/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BonAchatDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bon-achat/:id/edit"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BonAchatForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/factures"
              element={
                <ProtectedRoute>
                  <Layout>
                    <InvoiceWorkspace />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/factures/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <FactureForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/factures/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <FactureDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/factures/:id/edit"
              element={
                <ProtectedRoute>
                  <Layout>
                    <FactureForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Suppliers />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SupplierForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/suppliers/:id/edit"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SupplierForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Clients />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ClientForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/clients/:id/edit"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ClientForm />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Navigate to="/products?categories=manage" replace />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Navigate to="/products?categories=manage" replace />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories/:id/edit"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Navigate to="/products?categories=manage" replace />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="/clients/:id/documents" element={<ProtectedRoute><Layout><PartyHistory /></Layout></ProtectedRoute>} />
            <Route path="/suppliers/:id/documents" element={<ProtectedRoute><Layout><PartyHistory supplier /></Layout></ProtectedRoute>} />
            <Route path="/accounts" element={<ProtectedRoute><Layout><InvoicingAccounts /></Layout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
