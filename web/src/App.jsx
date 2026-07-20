import { Navigate, Route, Routes } from "react-router-dom";
import { getUser } from "./api";
import Portal from "./pages/Portal";
import Login from "./pages/Login";
import DriverHome from "./pages/driver/DriverHome";
import DriverTraining from "./pages/driver/DriverTraining";
import DriverDocs from "./pages/driver/DriverDocs";
import DriverVisit from "./pages/driver/DriverVisit";
import AdminShell from "./pages/admin/AdminShell";
import Dashboard from "./pages/admin/Dashboard";
import Visits from "./pages/admin/Visits";
import DocumentsPage from "./pages/admin/DocumentsPage";
import DevicesPage from "./pages/admin/DevicesPage";
import AuditPage from "./pages/admin/AuditPage";
import MastersPage from "./pages/admin/MastersPage";
import GateShell from "./pages/gate/GateShell";
import GateConsole from "./pages/gate/GateConsole";
import GateOnsite from "./pages/gate/GateOnsite";

function homeFor(user) {
  if (!user) return "/";
  if (user.role === "driver") return "/driver";
  if (user.role === "gate") return "/gate";
  return "/admin";
}

function RequireAuth({ roles, children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role) && user.role !== "admin") {
    return <Navigate to={homeFor(user)} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Portal />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/driver"
        element={
          <RequireAuth roles={["driver"]}>
            <DriverHome />
          </RequireAuth>
        }
      />
      <Route
        path="/driver/training"
        element={
          <RequireAuth roles={["driver"]}>
            <DriverTraining />
          </RequireAuth>
        }
      />
      <Route
        path="/driver/docs"
        element={
          <RequireAuth roles={["driver"]}>
            <DriverDocs />
          </RequireAuth>
        }
      />
      <Route
        path="/driver/visit"
        element={
          <RequireAuth roles={["driver"]}>
            <DriverVisit />
          </RequireAuth>
        }
      />

      <Route
        path="/gate"
        element={
          <RequireAuth roles={["gate", "admin", "ehs"]}>
            <GateShell />
          </RequireAuth>
        }
      >
        <Route index element={<GateConsole />} />
        <Route path="onsite" element={<GateOnsite />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireAuth roles={["admin", "ehs", "carrier_admin"]}>
            <AdminShell />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="visits" element={<Visits />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="masters" element={<MastersPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
