import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import AuthContext, { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import { Box, CircularProgress } from '@mui/material';

// 导入页面组件
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Customers from './pages/Customers';
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

// 加载组件
const Loading = () => <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;

// 受保护路由组件
function ProtectedRoute({ children }) {
  const isAuthenticated = localStorage.getItem('token') !== null;
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        {children}
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
            
            {/* 基本模块 */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
            <Route path="/compliance" element={<ProtectedRoute><Compliance /></ProtectedRoute>} />
            
            {/* 组织结构模块 */}
            <Route path="/organization" element={<ProtectedRoute><Organization /></ProtectedRoute>} />
            <Route path="/organization/personnel" element={<ProtectedRoute><PersonnelManagement /></ProtectedRoute>} />
            <Route path="/organization/positions" element={<ProtectedRoute><PositionsManagement /></ProtectedRoute>} />
            <Route path="/organization/performance" element={<ProtectedRoute><PerformanceManagement /></ProtectedRoute>} />
            
            <Route path="/distribution" element={<ProtectedRoute><Distribution /></ProtectedRoute>} />
            
            {/* 处方管理子模块 */}
            <Route path="/prescriptions/review" element={<ProtectedRoute><PrescriptionReview /></ProtectedRoute>} />
            <Route path="/prescriptions/templates" element={<ProtectedRoute><PrescriptionTemplates /></ProtectedRoute>} />
            <Route path="/prescriptions/analytics" element={<ProtectedRoute><PrescriptionAnalytics /></ProtectedRoute>} />
            
            {/* 新增模块 */}
            <Route path="/patients" element={<ProtectedRoute><PatientRecords /></ProtectedRoute>} />
            <Route path="/traceability" element={<ProtectedRoute><TraceabilitySystem /></ProtectedRoute>} />
            <Route path="/quality" element={<ProtectedRoute><QualityManagement /></ProtectedRoute>} />
            <Route path="/membership" element={<ProtectedRoute><MembershipManagement /></ProtectedRoute>} />
            <Route path="/knowledge" element={<ProtectedRoute><HerbalKnowledgeBase /></ProtectedRoute>} />
            <Route path="/training" element={<ProtectedRoute><PharmacistTraining /></ProtectedRoute>} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App; 