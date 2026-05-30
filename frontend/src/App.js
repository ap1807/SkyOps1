import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import Login from "@/pages/Login";
import Overview from "@/pages/Overview";
import Satisfaction from "@/pages/Satisfaction";
import Predictive from "@/pages/Predictive";
import Comparisons from "@/pages/Comparisons";
import Disruption from "@/pages/Disruption";
import Advisor from "@/pages/Advisor";
import Explorer from "@/pages/Explorer";
import Settings from "@/pages/Settings";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Overview />} />
              <Route path="satisfaction" element={<Satisfaction />} />
              <Route path="predict" element={<Predictive />} />
              <Route path="compare" element={<Comparisons />} />
              <Route path="disruptions" element={<Disruption />} />
              <Route path="advisor" element={<Advisor />} />
              <Route path="explorer" element={<Explorer />} />
              <Route path="alerts" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
