import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  Children,
  isValidElement,
  type ReactNode,
  type ReactElement,
  type CSSProperties,
  type MouseEvent,
} from 'react';

/* ════════════════════════════════════════════════════════════════════
   Minimal History-API router — a zero-dependency drop-in for the small
   slice of the react-router-dom API this SPA uses (BrowserRouter, Routes,
   Route, Navigate, Link, useNavigate). Client-side, no reloads, supports
   browser back/forward and modifier-click (open-in-new-tab).
   ════════════════════════════════════════════════════════════════════ */

interface RouterCtx {
  path: string;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterCtx | null>(null);

function useRouter(): RouterCtx {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('Router components must be used within <BrowserRouter>');
  return ctx;
}

export function BrowserRouter({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback<RouterCtx['navigate']>((to, opts = {}) => {
    if (to === window.location.pathname) return;
    if (opts.replace) window.history.replaceState(null, '', to);
    else window.history.pushState(null, '', to);
    setPath(to);
    window.scrollTo(0, 0);
  }, []);

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

interface RouteProps {
  path: string;
  element: ReactNode;
}

/** Declarative route definition — only read by <Routes>, never rendered directly. */
export function Route(_props: RouteProps): null {
  return null;
}

/** Renders the element of the first <Route> whose path matches; falls back to "*". */
export function Routes({ children }: { children: ReactNode }) {
  const { path } = useRouter();
  let fallback: ReactNode = null;

  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    const props = (child as ReactElement<RouteProps>).props;
    if (props.path === '*') {
      fallback = props.element;
      continue;
    }
    if (props.path === path) return <>{props.element}</>;
  }
  return <>{fallback}</>;
}

/** Imperative redirect — navigates on mount. */
export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const { navigate } = useRouter();
  useEffect(() => {
    navigate(to, { replace });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

interface LinkProps {
  to: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

/** Client-side link — intercepts plain left-clicks, lets modifier-clicks open a new tab. */
export function Link({ to, children, className, style, ...rest }: LinkProps) {
  const { navigate } = useRouter();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} className={className} style={style} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}

/** Returns the imperative navigate function. */
export function useNavigate(): RouterCtx['navigate'] {
  return useRouter().navigate;
}
