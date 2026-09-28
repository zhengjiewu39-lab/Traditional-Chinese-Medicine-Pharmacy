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

// Pharmacist-governed AI pharmacy workflow.
const Workbench = lazy(() => import('./pages/ai/Workbench'));
const CaseIntake = lazy(() => import('./pages/ai/CaseIntake'));
const CaseList = lazy(() => import('./pages/ai/CaseList'));
const ReviewDetail = lazy(() => import('./pages/ai/ReviewDetail'));
const DispensingBoard = lazy(() => import('./pages/ai/DispensingBoard'));
const PatientService = lazy(() => import('./pages/ai/PatientService'));
const Governance = lazy(() => import('./pages/ai/Governance'));
const KnowledgeSources = lazy(() => import('./pages/ai/KnowledgeSources'));
const OperationsAgent = lazy(() => import('./pages/ai/OperationsAgent'));
const PatientConfirmation = lazy(() => import('./pages/patient/PatientConfirmation'));
const PatientFeedback = lazy(() => import('./pages/patient/PatientFeedback'));
const MyPrescriptions = lazy(() => import('./pages/patient/MyPrescriptions'));

// Pharmacy business pages (formerly under /legacy) and the remaining legacy demos: code-split.
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

/** Business pages that rejoined the formal workflow: path → component. `/legacy/<path>` redirects here. */
const BUSINESS_ROUTES = [
  ['/doctor', DoctorWorkbench],
  ['/patients', PatientRecords],
  ['/customers', Customers],
  ['/membership', MembershipManagement],
  ['/prescriptions/templates', PrescriptionTemplates],
  ['/prescriptions/review', PrescriptionReview],
  ['/knowledge', HerbalKnowledgeBase],
  ['/pickup', PatientPickup],
  ['/billing', Billing],
  ['/distribution', Distribution],
  ['/inventory', Inventory],
  ['/orders', Orders],
  ['/traceability', TraceabilitySystem],
  ['/quality', QualityManagement],
  ['/compliance', Compliance],
];

function PublicPage({ children }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>;
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
            <Route path="/patient/confirmation/:token" element={<PublicPage><PatientConfirmation /></PublicPage>} />
            <Route path="/patient/feedback/:token" element={<PublicPage><PatientFeedback /></PublicPage>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/workbench" element={<Workbench />} />
              <Route path="/intake" element={<CaseIntake />} />
              <Route path="/ai/cases" element={<CaseList mode="all" />} />
              <Route path="/ai/review-queue" element={<CaseList mode="queue" />} />
              <Route path="/ai/reviews/:caseId" element={<ReviewDetail />} />
              <Route path="/ai/knowledge" element={<KnowledgeSources />} />
              <Route path="/ai/governance" element={<Governance />} />
              <Route path="/ai/operations" element={<OperationsAgent />} />
              <Route path="/dispensing" element={<DispensingBoard />} />
              <Route path="/patient-service" element={<PatientService />} />
              <Route path="/patient/me" element={<MyPrescriptions />} />
              {BUSINESS_ROUTES.map(([p, Page]) => <Route key={p} path={p} element={<Page />} />)}
              {BUSINESS_ROUTES.map(([p]) => <Route key={`legacy${p}`} path={`/legacy${p}`} element={<Navigate to={p} replace />} />)}
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
              <Route path="/legacy/organization" element={<Organization />} />
              <Route path="/legacy/organization/personnel" element={<PersonnelManagement />} />
              <Route path="/legacy/organization/positions" element={<PositionsManagement />} />
              <Route path="/legacy/organization/performance" element={<PerformanceManagement />} />
              <Route path="/legacy/prescriptions/analytics" element={<PrescriptionAnalytics />} />
              <Route path="/legacy/research" element={<ResearchHub />} />
              <Route path="/legacy/training" element={<PharmacistTraining />} />
              <Route path="/dashboard" element={<Navigate to="/workbench" replace />} />
              <Route path="/organization" element={<Navigate to="/legacy/organization" replace />} />
              <Route path="/prescriptions/analytics" element={<Navigate to="/legacy/prescriptions/analytics" replace />} />
              <Route path="/research" element={<Navigate to="/legacy/research" replace />} />
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