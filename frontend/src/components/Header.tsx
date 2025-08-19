import { Link } from "react-router";
import { Button } from "./ui/button";

const Header = () => {
  return (
    <nav>
      <div>
        <Link to={"/"}>Logo</Link>
      </div>
      <div>
        <Button>
          <Link to={"/auth/login"}>Login</Link>
        </Button>
        <Button>
          <Link to={"/auth/register"}>register</Link>
        </Button>
      </div>
    </nav>
  );
};

export default Header;
