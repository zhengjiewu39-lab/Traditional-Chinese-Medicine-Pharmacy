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

const Workbench = lazy(() => import('./pages/ai/Workbench'));
const CaseIntake = lazy(() => import('./pages/ai/CaseIntake'));
const CaseList = lazy(() => import('./pages/ai/CaseList'));
const ReviewDetail = lazy(() => import('./pages/ai/ReviewDetail'));
const DispensingBoard = lazy(() => import('./pages/ai/DispensingBoard'));
const PatientService = lazy(() => import('./pages/ai/PatientService'));
const Governance = lazy(() => import('./pages/ai/Governance'));
const KnowledgeSources = lazy(() => import('./pages/ai/KnowledgeSources'));
const FollowUpBoard = lazy(() => import('./pages/ai/FollowUpBoard'));
const PatientConfirmation = lazy(() => import('./pages/patient/PatientConfirmation'));
const PatientFeedback = lazy(() => import('./pages/patient/PatientFeedback'));
const MyPrescriptions = lazy(() => import('./pages/patient/MyPrescriptions'));
const PatientProfile = lazy(() => import('./pages/patient/PatientProfile'));
const ClarificationRespond = lazy(() => import('./pages/patient/ClarificationRespond'));
const DoctorWorkbench = lazy(() => import('./pages/DoctorWorkbench'));
const PatientPickup = lazy(() => import('./pages/PatientPickup'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Orders = lazy(() => import('./pages/Orders'));
const Billing = lazy(() => import('./pages/Billing'));
const Distribution = lazy(() => import('./pages/Distribution'));
const PatientRecords = lazy(() => import('./pages/PatientRecords'));
const TraceabilitySystem = lazy(() => import('./pages/TraceabilitySystem'));
const PrescriptionTemplates = lazy(() => import('./pages/PrescriptionTemplates'));
const ResearchEvaluation = lazy(() => import('./pages/research/Evaluation'));
const ResearchDesk = lazy(() => import('./pages/research/ResearchDesk'));

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
            <Route path="/patient/clarification/:token" element={<PublicPage><ClarificationRespond /></PublicPage>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/workbench" element={<Workbench />} />
              <Route path="/intake" element={<CaseIntake />} />
              <Route path="/ai/cases" element={<CaseList mode="all" />} />
              <Route path="/ai/review-queue" element={<CaseList mode="queue" />} />
              <Route path="/ai/reviews/:caseId" element={<ReviewDetail />} />
              <Route path="/ai/knowledge" element={<KnowledgeSources />} />
              <Route path="/ai/governance" element={<Governance />} />
              <Route path="/ai/follow-up" element={<FollowUpBoard />} />
              <Route path="/dispensing" element={<DispensingBoard />} />
              <Route path="/patient-service" element={<PatientService />} />
              <Route path="/patient/me" element={<MyPrescriptions view="all" />} />
              <Route path="/patient/clarifications" element={<MyPrescriptions view="clarifications" />} />
              <Route path="/patient/education" element={<MyPrescriptions view="education" />} />
              <Route path="/patient/feedback" element={<MyPrescriptions view="feedback" />} />
              <Route path="/patient/profile" element={<PatientProfile />} />
              <Route path="/doctor" element={<DoctorWorkbench />} />
              <Route path="/patients" element={<PatientRecords />} />
              <Route path="/prescriptions/templates" element={<PrescriptionTemplates />} />
              <Route path="/pickup" element={<PatientPickup />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/distribution" element={<Distribution />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/traceability" element={<TraceabilitySystem />} />
              <Route path="/research/desk" element={<ResearchDesk />} />
              <Route path="/research/evaluation" element={<ResearchEvaluation />} />
              <Route path="/prescriptions/review" element={<Navigate to="/ai/review-queue" replace />} />
              <Route path="/knowledge" element={<Navigate to="/ai/knowledge" replace />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/simulation/*" element={<Navigate to="/research/desk" replace />} />
              <Route path="/legacy/*" element={<Navigate to="/" replace />} />
              <Route path="/research" element={<Navigate to="/research/desk" replace />} />
              <Route path="/customers" element={<Navigate to="/patients" replace />} />
              <Route path="/membership" element={<Navigate to="/patients" replace />} />
              <Route path="/quality" element={<Navigate to="/traceability" replace />} />
              <Route path="/compliance" element={<Navigate to="/ai/governance" replace />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
