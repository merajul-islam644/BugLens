import { useState } from "react";
import { PERMISSION_TABLE, ROLE_LABELS, ROLE_ORDER, can } from "../access/permissions";
import { useAccess } from "../access/useAccess";
import { LoadingScreen } from "../../shared/ui/LoadingScreen";
import { MembersPanel } from "./MembersPanel";
import { AuditLogPanel, MaskingPanel, NotificationsPanel, RetentionPanel, TargetScopePanel } from "./SettingsPanels";

const TABS = [
  "Workspace and members",
  "Roles and permissions",
  "Browser and target scope",
  "Evidence retention",
  "Data masking rules",
  "Notifications",
  "Audit log"
] as const;

type Tab = (typeof TABS)[number];

function RolesPanel() {
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>Action</th>
            {ROLE_ORDER.map((slug) => <th key={slug}>{ROLE_LABELS[slug]}</th>)}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_TABLE.map((row) => (
            <tr key={row.action}>
              <td>{row.action}</td>
              {ROLE_ORDER.map((slug) => (
                <td key={slug}>{row.roles.includes(slug) ? "Yes" : "No"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Team & Settings — Admin. Tabs appear as each area is built. */
export function TeamSettingsPage() {
  const access = useAccess();
  const [tab, setTab] = useState<Tab>("Workspace and members");

  if (access.isLoading) return <LoadingScreen />;
  if (!access.data) return <div className="empty-state"><p>Workspace access could not be read.</p></div>;
  if (!can(access.data.role, "manageWorkspace")) {
    return (
      <div className="empty-state">
        <h3>Admin only</h3>
        <p>Only an admin can open Team &amp; Settings.</p>
      </div>
    );
  }

  return (
    <section>
      <header className="page-header">
        <div><h2>Team &amp; Settings</h2><p>The workspace, its people and the rules BugLens enforces.</p></div>
      </header>
      <div className="chips" role="tablist" style={{ marginBottom: 16 }}>
        {TABS.map((item) => (
          <button
            aria-selected={tab === item}
            className={tab === item ? "chip" : "icon-button"}
            key={item}
            role="tab"
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "Workspace and members" ? <MembersPanel access={access.data} /> : null}
      {tab === "Roles and permissions" ? <RolesPanel /> : null}
      {tab === "Browser and target scope" ? <TargetScopePanel access={access.data} /> : null}
      {tab === "Evidence retention" ? <RetentionPanel access={access.data} /> : null}
      {tab === "Data masking rules" ? <MaskingPanel /> : null}
      {tab === "Notifications" ? <NotificationsPanel /> : null}
      {tab === "Audit log" ? <AuditLogPanel access={access.data} /> : null}
    </section>
  );
}
