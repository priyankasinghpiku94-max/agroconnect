import {
  Link as WouterLink,
  Redirect,
  Route as WouterRoute,
  Switch,
  useLocation,
  useParams,
} from "wouter";

const safeInternalPath = (value) => {
  const path = String(value || "/");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
};

export function BrowserRouter({ children }) {
  return children;
}

export function Routes({ children }) {
  return <Switch>{children}</Switch>;
}

export function Route({ path, element }) {
  return <WouterRoute path={path}>{element}</WouterRoute>;
}

export function Link({ to, ...props }) {
  return <WouterLink to={safeInternalPath(to)} {...props} />;
}

export function NavLink({ to, className = "", ...props }) {
  const [location] = useLocation();
  const target = safeInternalPath(to);
  const current = location.split("?")[0];
  const active =
    current === target ||
    (target !== "/" && current.startsWith(`${target}/`));
  const resolvedClass =
    typeof className === "function"
      ? className({ isActive: active })
      : [className, active ? "active" : ""].filter(Boolean).join(" ");
  return <WouterLink to={target} className={resolvedClass} {...props} />;
}

export function useNavigate() {
  const [, navigate] = useLocation();
  return (to, options = {}) => {
    if (typeof to === "number") {
      window.history.go(to);
      return;
    }
    navigate(safeInternalPath(to), { replace: Boolean(options.replace) });
  };
}

export function Navigate({ to, replace = false }) {
  return <Redirect to={safeInternalPath(to)} replace={replace} />;
}

export { useParams };
