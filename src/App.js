import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import { Box, CircularProgress } from '@mui/material';

import Login from './pages/Login';
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
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<OperationsDashboard />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/doctor" element={<DoctorWorkbench />} />
              <Route path="/pickup" element={<PatientPickup />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/compliance" element={<Compliance />} />
              <Route path="/organization" element={<Organization />} />
              <Route path="/organization/personnel" element={<PersonnelManagement />} />
              <Route path="/organization/positions" element={<PositionsManagement />} />
              <Route path="/organization/performance" element={<PerformanceManagement />} />
              <Route path="/distribution" element={<Distribution />} />
              <Route path="/prescriptions/review" element={<PrescriptionReview />} />
              <Route path="/prescriptions/templates" element={<PrescriptionTemplates />} />
              <Route path="/prescriptions/analytics" element={<PrescriptionAnalytics />} />
              <Route path="/patients" element={<PatientRecords />} />
              <Route path="/traceability" element={<TraceabilitySystem />} />
              <Route path="/quality" element={<QualityManagement />} />
              <Route path="/membership" element={<MembershipManagement />} />
              <Route path="/knowledge" element={<HerbalKnowledgeBase />} />
              <Route path="/training" element={<PharmacistTraining />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App; 