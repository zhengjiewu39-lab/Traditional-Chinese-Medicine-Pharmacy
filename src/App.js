import React, { Suspense, lazy } from 'react';
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
import ExperimentArchive from './pages/simulation/ExperimentArchive';
import Documentation from './pages/simulation/Documentation';

// Legacy CDSS demo (tag legacy-cdss-v1): code-split so it never loads with the research platform.
const OperationsDashboard = lazy(() => import('./pages/OperationsDashboard'));
const DoctorWorkbench = lazy(() => import('./pages/DoctorWorkbench'));
const PatientPickup = lazy(() => import('./pages/PatientPickup'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Orders = lazy(() => import('./pages/Orders'));
const Customers = lazy(() => import('./pages/Customers'));
const Billing = lazy(() => import('./pages/Billing'));
const Compliance = lazy(() => import('./pages/Compliance'));
const Organization = lazy(() => import('./pages/Organization'));
const Distribution = lazy(() => import('./pages/Distribution'));
const PatientRecords = lazy(() => import('./pages/PatientRecords'));
const TraceabilitySystem = lazy(() => import('./pages/TraceabilitySystem'));
const QualityManagement = lazy(() => import('./pages/QualityManagement'));
const MembershipManagement = lazy(() => import('./pages/MembershipManagement'));
const PrescriptionReview = lazy(() => import('./pages/PrescriptionReview'));
const PrescriptionTemplates = lazy(() => import('./pages/PrescriptionTemplates'));
const PrescriptionAnalytics = lazy(() => import('./pages/PrescriptionAnalytics'));
const ResearchHub = lazy(() => import('./pages/ResearchHub'));
const HerbalKnowledgeBase = lazy(() => import('./pages/HerbalKnowledgeBase'));
const PharmacistTraining = lazy(() => import('./pages/PharmacistTraining'));
const PersonnelManagement = lazy(() => import('./pages/organization/PersonnelManagement'));
const PositionsManagement = lazy(() => import('./pages/organization/PositionsManagement'));
const PerformanceManagement = lazy(() => import('./pages/organization/PerformanceManagement'));

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
              <Route path="/simulation/archive" element={<ExperimentArchive />} />
              <Route path="/simulation/documentation" element={<Documentation />} />
              <Route path="/legacy" element={<Navigate to="/legacy/dashboard" replace />} />
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