import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { Outlet } from "react-router";

const HomeLayout = () => {
  return (
    <>
      <Header />
      <Outlet />
      <Footer />
    </>
  );
};

export default HomeLayout;
