import { Routes, Route } from "./router";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import FarmerProducts from "./pages/FarmerProducts";
import AddProduct from "./pages/AddProduct";
import Marketplace from "./pages/Marketplace";
import ProductDetails from "./pages/ProductDetails";
import MyOrders from "./pages/MyOrders";
import AdminDashboard from "./pages/AdminDashboard";
import Profile from "./pages/Profile";
import DemandBoard from "./pages/DemandBoard";
import Negotiations from "./pages/Negotiations";
import Notifications from "./pages/Notifications";
import BusinessHub from "./pages/BusinessHub";
import FpoWorkspace from "./pages/FpoWorkspace";
import ProcurementContracts from "./pages/ProcurementContracts";
import Warehouses from "./pages/Warehouses";
import BusinessAnalytics from "./pages/BusinessAnalytics";
import ExpansionHub from "./pages/ExpansionHub";
import EquipmentRental from "./pages/EquipmentRental";
import AgriInputs from "./pages/AgriInputs";
import SmartMarket from "./pages/SmartMarket";
import CollectionCentres from "./pages/CollectionCentres";
import LaunchHub from "./pages/LaunchHub";
import FinanceCenter from "./pages/FinanceCenter";
import FulfilmentCenter from "./pages/FulfilmentCenter";
import TrustCenter from "./pages/TrustCenter";

export default function App() {
  return (
    <>
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/products/:id" element={<ProductDetails />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/farmer/products"
          element={
            <ProtectedRoute roles={["farmer"]}>
              <FarmerProducts />
            </ProtectedRoute>
          }
        />

        <Route
          path="/farmer/add-product"
          element={
            <ProtectedRoute roles={["farmer"]}>
              <AddProduct />
            </ProtectedRoute>
          }
        />

        <Route
          path="/farmer/products/:id/edit"
          element={
            <ProtectedRoute roles={["farmer"]}>
              <AddProduct />
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders"
          element={
            <ProtectedRoute roles={["farmer", "distributor"]}>
              <MyOrders />
            </ProtectedRoute>
          }
        />

        <Route
          path="/demands"
          element={
            <ProtectedRoute roles={["farmer", "distributor"]}>
              <DemandBoard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/negotiations"
          element={
            <ProtectedRoute roles={["farmer", "distributor"]}>
              <Negotiations />
            </ProtectedRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />

        <Route
          path="/business"
          element={
            <ProtectedRoute>
              <BusinessHub />
            </ProtectedRoute>
          }
        />

        <Route
          path="/business/fpo"
          element={
            <ProtectedRoute roles={["farmer"]}>
              <FpoWorkspace />
            </ProtectedRoute>
          }
        />

        <Route
          path="/business/contracts"
          element={
            <ProtectedRoute roles={["farmer", "distributor", "admin"]}>
              <ProcurementContracts />
            </ProtectedRoute>
          }
        />

        <Route
          path="/business/warehouses"
          element={
            <ProtectedRoute roles={["farmer", "distributor", "admin"]}>
              <Warehouses />
            </ProtectedRoute>
          }
        />

        <Route
          path="/business/analytics"
          element={
            <ProtectedRoute>
              <BusinessAnalytics />
            </ProtectedRoute>
          }
        />

        <Route
          path="/expansion"
          element={
            <ProtectedRoute>
              <ExpansionHub />
            </ProtectedRoute>
          }
        />

        <Route
          path="/expansion/equipment"
          element={
            <ProtectedRoute roles={["farmer", "distributor", "admin"]}>
              <EquipmentRental />
            </ProtectedRoute>
          }
        />

        <Route
          path="/expansion/inputs"
          element={
            <ProtectedRoute roles={["farmer", "distributor", "admin"]}>
              <AgriInputs />
            </ProtectedRoute>
          }
        />

        <Route
          path="/expansion/smart-market"
          element={
            <ProtectedRoute>
              <SmartMarket />
            </ProtectedRoute>
          }
        />

        <Route
          path="/expansion/collection-centres"
          element={
            <ProtectedRoute roles={["farmer", "distributor", "admin"]}>
              <CollectionCentres />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/launch"
          element={
            <ProtectedRoute>
              <LaunchHub />
            </ProtectedRoute>
          }
        />

        <Route
          path="/launch/finance"
          element={
            <ProtectedRoute roles={["farmer", "distributor", "admin"]}>
              <FinanceCenter />
            </ProtectedRoute>
          }
        />

        <Route
          path="/launch/fulfilment"
          element={
            <ProtectedRoute roles={["farmer", "distributor", "admin"]}>
              <FulfilmentCenter />
            </ProtectedRoute>
          }
        />

        <Route
          path="/launch/trust"
          element={
            <ProtectedRoute roles={["farmer", "distributor", "admin"]}>
              <TrustCenter />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}
