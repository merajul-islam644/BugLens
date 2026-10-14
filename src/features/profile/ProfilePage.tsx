import { Clock, Mail, ShieldCheck } from "lucide-react";
import { useAccess } from "../access/useAccess";
import { roleLabel } from "../access/permissions";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { useCurrentUser, userDisplayName, userInitials } from "./useCurrentUser";

export function ProfilePage() {
  const me = useCurrentUser();
  const access = useAccess();
  const { t } = useT();
  const profile = me.data?.data;
  const name = userDisplayName(profile);

  return (
    <section>
      <PageHeader subtitle={t("profile.subtitle")} title={t("profile.title")} />

      {me.isLoading ? (
        <div className="panel">
          <Skeleton className="skeleton-line-lg" />
        </div>
      ) : (
        <div className="panel">
          <div className="meta-list">
            <dt>{t("profile.name")}</dt>
            <dd>
              <span className="muted">
                <span className="avatar avatar-sm">{userInitials(profile)}</span>
                {name || t("profile.unavailable")}
              </span>
            </dd>
            <dt>{t("profile.email")}</dt>
            <dd>{profile?.email ? <span className="muted"><Mail size={14} /> {profile.email}</span> : t("muted.none")}</dd>
            <dt>{t("profile.role")}</dt>
            <dd>
              <span className="muted">
                <ShieldCheck size={14} />
                {access.data ? roleLabel(access.data.role) : t("common.loading")}
              </span>
            </dd>
            <dt>{t("profile.workspace")}</dt>
            <dd>{access.data?.workspace.name ?? t("common.loading")}</dd>
            <dt>{t("profile.signedIn")}</dt>
            <dd>
              <span className="muted"><Clock size={14} /> {new Date().toLocaleString()}</span>
            </dd>
          </div>
        </div>
      )}
    </section>
  );
}
