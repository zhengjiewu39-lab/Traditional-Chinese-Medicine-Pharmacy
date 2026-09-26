import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
import Layout from './components/Layout';
import RoleGuard from './components/RoleGuard';
import { Box, CircularProgress } from '@mui/material';
import { getHomeForRole } from './config/navigation';

import Login from './pages/Login';
import SimulationOverview from './pages/simulation/Overview';
import ScenarioConfiguration from './pages/simulation/ScenarioConfiguration';
import StrategyComparison from './pages/simulation/StrategyComparison';
import SimulationRun from './pages/simulation/SimulationRun';
import SimulationResults from './pages/simulation/Results';
import Reproducibility from './pages/simulation/Reproducibility';
import OperationsDashboard from './pages/OperationsDashboard';
import DoctorWorkbench from './pages/DoctorWorkbench';
import PatientPickup from './pages/PatientPickup';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Customers from './pages/Customers';
import Billing from './pages/Billing';
import Compliance from './pages/Compliance';
import Organization from './pages/Organization';
import Distribution from './pages/Distribution';
import PatientRecords from './pages/PatientRecords';
import TraceabilitySystem from './pages/TraceabilitySystem';
import QualityManagement from './pages/QualityManagement';
import MembershipManagement from './pages/MembershipManagement';
import PrescriptionReview from './pages/PrescriptionReview';
import PrescriptionTemplates from './pages/PrescriptionTemplates';
import PrescriptionAnalytics from './pages/PrescriptionAnalytics';
import ResearchHub from './pages/ResearchHub';
import HerbalKnowledgeBase from './pages/HerbalKnowledgeBase';
import PharmacistTraining from './pages/PharmacistTraining';
import PersonnelManagement from './pages/organization/PersonnelManagement';
import PositionsManagement from './pages/organization/PositionsManagement';
import PerformanceManagement from './pages/organization/PerformanceManagement';

const Loading = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <CircularProgress />
  </Box>
);

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <RoleGuard>
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </RoleGuard>
    </Layout>
  );
}

function RoleHome() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getHomeForRole(user.role)} replace />;
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LanguageProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RoleHome />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/simulation/overview" element={<SimulationOverview />} />
              <Route path="/simulation/scenario" element={<ScenarioConfiguration />} />
              <Route path="/simulation/strategies" element={<StrategyComparison />} />
              <Route path="/simulation/run" element={<SimulationRun />} />
              <Route path="/simulation/results" element={<SimulationResults />} />
              <Route path="/simulation/reproducibility" element={<Reproducibility />} />
              <Route path="/legacy/dashboard" element={<OperationsDashboard />} />
              <Route path="/dashboard" element={<Navigate to="/simulation/overview" replace />} />
              <Route path="/legacy/billing" element={<Billing />} />
              <Route path="/legacy/doctor" element={<DoctorWorkbench />} />
              <Route path="/legacy/pickup" element={<PatientPickup />} />
              <Route path="/legacy/inventory" element={<Inventory />} />
              <Route path="/legacy/orders" element={<Orders />} />
              <Route path="/legacy/customers" element={<Customers />} />
              <Route path="/legacy/compliance" element={<Compliance />} />
              <Route path="/legacy/organization" element={<Organization />} />
              <Route path="/legacy/organization/personnel" element={<PersonnelManagement />} />
              <Route path="/legacy/organization/positions" element={<PositionsManagement />} />
              <Route path="/legacy/organization/performance" element={<PerformanceManagement />} />
              <Route path="/legacy/distribution" element={<Distribution />} />
              <Route path="/legacy/prescriptions/review" element={<PrescriptionReview />} />
              <Route path="/legacy/prescriptions/templates" element={<PrescriptionTemplates />} />
              <Route path="/legacy/prescriptions/analytics" element={<PrescriptionAnalytics />} />
              <Route path="/legacy/research" element={<ResearchHub />} />
              <Route path="/legacy/patients" element={<PatientRecords />} />
              <Route path="/legacy/traceability" element={<TraceabilitySystem />} />
              <Route path="/legacy/quality" element={<QualityManagement />} />
              <Route path="/legacy/membership" element={<MembershipManagement />} />
              <Route path="/legacy/knowledge" element={<HerbalKnowledgeBase />} />
              <Route path="/legacy/training" element={<PharmacistTraining />} />
              <Route path="/billing" element={<Navigate to="/legacy/billing" replace />} />
              <Route path="/doctor" element={<Navigate to="/legacy/doctor" replace />} />
              <Route path="/pickup" element={<Navigate to="/legacy/pickup" replace />} />
              <Route path="/inventory" element={<Navigate to="/legacy/inventory" replace />} />
              <Route path="/orders" element={<Navigate to="/legacy/orders" replace />} />
              <Route path="/customers" element={<Navigate to="/legacy/customers" replace />} />
              <Route path="/compliance" element={<Navigate to="/legacy/compliance" replace />} />
              <Route path="/organization" element={<Navigate to="/legacy/organization" replace />} />
              <Route path="/distribution" element={<Navigate to="/legacy/distribution" replace />} />
              <Route path="/prescriptions/review" element={<Navigate to="/legacy/prescriptions/review" replace />} />
              <Route path="/prescriptions/templates" element={<Navigate to="/legacy/prescriptions/templates" replace />} />
              <Route path="/prescriptions/analytics" element={<Navigate to="/legacy/prescriptions/analytics" replace />} />
              <Route path="/research" element={<Navigate to="/legacy/research" replace />} />
              <Route path="/patients" element={<Navigate to="/legacy/patients" replace />} />
              <Route path="/traceability" element={<Navigate to="/legacy/traceability" replace />} />
              <Route path="/quality" element={<Navigate to="/legacy/quality" replace />} />
              <Route path="/membership" element={<Navigate to="/legacy/membership" replace />} />
              <Route path="/knowledge" element={<Navigate to="/legacy/knowledge" replace />} />
              <Route path="/training" element={<Navigate to="/legacy/training" replace />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App; 