import { createBrowserRouter } from "react-router";
import HomePage from "./components/pages/HomePage";
import LoginPage from "./components/pages/LoginPage";
import RegisterPage from "./components/pages/RegisterPage";
import AuthLayout from "./layouts/AuthLayout";
import HomeLayout from "./layouts/HomeLayout";

import PropertyOwnerLayout from "./layouts/PropertyOwnerLayout";
import PropertyOwnerDashboard from "./components/dashboard/propertyOwener/PropertyOwnerDashboard";
import PropertiesPage from "./components/dashboard/propertyOwener/PropertiesPage";
import CreateProperty from "./components/dashboard/propertyOwener/CreateProperty";
import UserProfilePage from "./components/dashboard/propertyOwener/UserProfilePage";
import CreateSaleEmployee from "./components/dashboard/propertyOwener/CreateSaleEmployee";


const router = createBrowserRouter([
  {
    path: "/",
    element: <HomeLayout />,
    children: [
      {
        path: "",
        element: <HomePage />,
      },
    ],
  },
  {
    path: "auth",
    element: <AuthLayout />,
    children: [
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "register",
        element: <RegisterPage />,
      },
    ],
  },
  {
    path: "propertyOwner", 
    element: <PropertyOwnerLayout />,
    children: [
      {
        path: "",
        element: <PropertyOwnerDashboard />
      },
      {
        path: "properties",
        element: <PropertiesPage />
      },
      {
        path: "createProperty",
        element: <CreateProperty />
      },
      {
        path: "userProfile",
        element: <UserProfilePage />
      },
      {
        path: "createSaleEmployee",
        element: <CreateSaleEmployee />
      }
    ]
  }
]);

export default router;