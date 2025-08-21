import useAuth from "@/hooks/useAuth";

import {  Outlet } from "react-router";

const AuthLayout = () => {
  useAuth()
  

  return (
    <div>
      <Outlet />
    </div>
  );
};

export default AuthLayout;
