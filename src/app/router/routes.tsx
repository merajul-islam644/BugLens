import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AppShell } from "../layout/AppShell";
import { RedirectIfAuthenticated, RequireAuth } from "./guards";
import { CallbackPage } from "../../features/auth/CallbackPage";
import { ErrorPage } from "../../features/auth/ErrorPage";
import { LoginPage } from "../../features/auth/LoginPage";
import { NotFoundPage } from "../../features/auth/NotFoundPage";
import { OverviewPage } from "../../features/overview/OverviewPage";
import { ReportsPage } from "../../features/reports/ReportsPage";
import { AcceptInvitePage } from "../../features/invite/AcceptInvitePage";
import { IssueDetailPage } from "../../features/issues/IssueDetailPage";
import { IssuesPage } from "../../features/issues/IssuesPage";
import { EvidencePage } from "../../features/evidence/EvidencePage";
import { InvestigationsPage } from "../../features/investigations/InvestigationsPage";
import { InvestigationWorkspacePage } from "../../features/investigations/InvestigationWorkspacePage";
import { StartInvestigationPage } from "../../features/investigations/StartInvestigationPage";
import { DeactivatedScreen, MfaGate } from "../../features/security/AccessGates";
import { MfaSettingsPage } from "../../features/security/MfaSettingsPage";
import { ProfilePage } from "../../features/profile/ProfilePage";
import { ProjectDetailPage } from "../../features/projects/ProjectDetailPage";
import { ProjectsPage } from "../../features/projects/ProjectsPage";
import { TeamSettingsPage } from "../../features/team/TeamSettingsPage";
import { useAccess } from "../../features/access/useAccess";

function projectRoute(path: string): string | undefined {
  return path.startsWith("/projects/") ? decodeURIComponent(path.slice("/projects/".length)) : undefined;
}

// The shell needs the workspace name for the top bar, so the authenticated tree
// is wrapped here rather than in App.tsx, where no session exists yet. It also
// enforces the two states that come before any screen: a deactivated member is
// locked out, and a required second factor is set up first.
function Shell({ activePath, children, onNavigate }: { activePath: string; children: ReactNode; onNavigate: (path: string) => void }) {
  const access = useAccess();
  const accessData = access.data;

  if (accessData && accessData.active === false) {
    return <DeactivatedScreen onNavigate={onNavigate} />;
  }
  if (accessData && accessData.workspace.requireMfa === true && !accessData.mfaOn) {
    return <MfaGate onNavigate={onNavigate} />;
  }

  return (
    <AppShell
      activePath={activePath}
      onNavigate={onNavigate}
      role={accessData?.role}
      workspaceName={accessData?.workspace.name}
    >
      {children}
    </AppShell>
  );
}

export function AppRouter() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(nextPath: string) {
    const [nextPathname = "/", queryString = ""] = nextPath.split("?");
    window.history.pushState({}, "", nextPath);
    setPath(nextPathname);
    setSearch(queryString ? `?${queryString}` : "");
  }

  if (path === "/login/callback") {
    return <CallbackPage onNavigate={navigate} />;
  }

  if (path === "/login") {
    const returnTo = new URLSearchParams(search).get("returnTo") || undefined;
    return (
      <RedirectIfAuthenticated onNavigate={navigate}>
        <LoginPage returnTo={returnTo} />
      </RedirectIfAuthenticated>
    );
  }

  if (path === "/invite") {
    return <AcceptInvitePage onNavigate={navigate} token={new URLSearchParams(search).get("token") || undefined} />;
  }

  const projectId = projectRoute(path);
  const issueId = path.startsWith("/issues/") ? decodeURIComponent(path.slice("/issues/".length)) : undefined;
  const evidenceId = path.startsWith("/evidence/") ? decodeURIComponent(path.slice("/evidence/".length)) : undefined;
  const investigationNew = path === "/investigations/new";
  const investigationId =
    path.startsWith("/investigations/") && !investigationNew ? decodeURIComponent(path.slice("/investigations/".length)) : undefined;
  const page =
    path === "/" || path === "/overview"
      ? <OverviewPage onNavigate={navigate} />
      : path === "/projects"
        ? <ProjectsPage onNavigate={navigate} />
      : projectId
        ? <ProjectDetailPage onNavigate={navigate} projectId={projectId} />
        : path === "/issues"
          ? <IssuesPage onNavigate={navigate} />
          : issueId
            ? <IssueDetailPage itemId={issueId} onNavigate={navigate} />
            : investigationNew
          ? <StartInvestigationPage initialUrl={new URLSearchParams(search).get("target") || undefined} onNavigate={navigate} />
          : path === "/investigations"
            ? <InvestigationsPage onNavigate={navigate} />
            : investigationId
              ? <InvestigationWorkspacePage itemId={investigationId} onNavigate={navigate} />
              : path === "/evidence" || evidenceId
                ? <EvidencePage initialEvidenceId={evidenceId} onNavigate={navigate} />
                : path === "/reports"
                ? <ReportsPage onNavigate={navigate} />
                : path === "/settings"
                  ? <TeamSettingsPage />
                  : path === "/security"
                    ? <MfaSettingsPage />
                    : path === "/profile"
                      ? <ProfilePage />
                      : path === "/error"
                        ? <ErrorPage />
                        : null;

  if (!page) {
    return <NotFoundPage onNavigate={navigate} />;
  }

  return (
    <RequireAuth currentPath={path} onNavigate={navigate}>
      <Shell activePath={path === "/" ? "/overview" : path} onNavigate={navigate}>
        {page}
      </Shell>
    </RequireAuth>
  );
}
