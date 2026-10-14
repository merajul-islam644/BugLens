import { useEffect, useState } from "react";
import { Alert } from "../../shared/ui/Alert";
import { Modal } from "../../shared/ui/Modal";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ENVIRONMENT_TYPES, isFullUrl, toList } from "./environmentTypes";
import type { EnvironmentDraft } from "./useProjects";
import type { EnvironmentRecord } from "./projectsApi";

function toDraft(record: EnvironmentRecord | undefined, projectId: string, workspaceId: string): EnvironmentDraft {
  return {
    allowedHosts: record?.allowedHosts ?? [],
    allowedPaths: record?.allowedPaths ?? [],
    baseUrl: record?.baseUrl ?? "",
    browserDefault: record?.browserDefault ?? "",
    buildLabel: record?.buildLabel ?? "",
    itemId: record?.itemId,
    name: record?.name ?? "",
    projectId: record?.projectId ?? projectId,
    type: record?.type ?? "Development",
    workspaceId: record?.workspaceId ?? workspaceId
  };
}

const BLANK: EnvironmentDraft = {
  allowedHosts: [],
  allowedPaths: [],
  baseUrl: "",
  browserDefault: "",
  buildLabel: "",
  name: "",
  projectId: "",
  type: "Development",
  workspaceId: ""
};

export function EnvironmentFormDialog({
  onCancel,
  onSubmit,
  pending,
  projectId,
  record,
  workspaceId
}: {
  onCancel: () => void;
  onSubmit: (draft: EnvironmentDraft) => void;
  pending: boolean;
  projectId: string;
  record?: EnvironmentRecord;
  workspaceId: string;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState<EnvironmentDraft>(BLANK);
  const [hostsText, setHostsText] = useState("");
  const [pathsText, setPathsText] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    setDraft(toDraft(record, projectId, workspaceId));
    setHostsText((record?.allowedHosts ?? []).join(", "));
    setPathsText((record?.allowedPaths ?? []).join(", "));
    setShowErrors(false);
  }, [record, projectId, workspaceId]);

  const nameMissing = !draft.name.trim();
  const urlInvalid = draft.baseUrl.trim() !== "" && !isFullUrl(draft.baseUrl.trim());

  function submit() {
    if (!draft.name.trim() || (draft.baseUrl.trim() !== "" && !isFullUrl(draft.baseUrl.trim()))) {
      setShowErrors(true);
      return;
    }
    onSubmit({
      ...draft,
      allowedHosts: toList(hostsText),
      allowedPaths: toList(pathsText),
      baseUrl: draft.baseUrl.trim(),
      name: draft.name.trim()
    });
  }

  return (
    <Modal onClose={onCancel} title={record ? t("project.environment.edit") : t("project.environment.add")}>
      <div className="form-grid">
        <label className={`form-field${showErrors && !draft.name.trim() ? " field-invalid" : ""}`}>
          <span>{t("project.environment.form.name")}</span>
          <input onChange={(event) => setDraft({ ...draft, name: event.target.value })} value={draft.name} />
          {showErrors && !draft.name.trim() ? <span className="field-error">{t("project.environment.nameRequired")}</span> : null}
        </label>
        <label className="form-field">
          <span>{t("project.environment.form.type")}</span>
          <select onChange={(event) => setDraft({ ...draft, type: event.target.value })} value={draft.type}>
            {ENVIRONMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className={`form-field span-all${showErrors && draft.baseUrl.trim() && !isFullUrl(draft.baseUrl.trim()) ? " field-invalid" : ""}`}>
          <span>{t("project.environment.form.baseUrl")}</span>
          <input
            onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
            placeholder="https://staging.customerportal.example"
            value={draft.baseUrl}
          />
          {showErrors && draft.baseUrl.trim() && !isFullUrl(draft.baseUrl.trim()) ? (
            <span className="field-error">{t("project.environment.hostInvalid")}</span>
          ) : null}
        </label>
        <label className="form-field">
          <span>{t("project.environment.form.allowedHosts")}</span>
          <input onChange={(event) => setHostsText(event.target.value)} placeholder="staging.customerportal.example" value={hostsText} />
        </label>
        <label className="form-field">
          <span>{t("project.environment.form.allowedPaths")}</span>
          <input onChange={(event) => setPathsText(event.target.value)} placeholder="/app/*" value={pathsText} />
        </label>
        <label className="form-field">
          <span>{t("project.environment.form.browser")}</span>
          <input onChange={(event) => setDraft({ ...draft, browserDefault: event.target.value })} placeholder="Chrome" value={draft.browserDefault} />
        </label>
        <label className="form-field">
          <span>{t("project.environment.form.buildLabel")}</span>
          <input onChange={(event) => setDraft({ ...draft, buildLabel: event.target.value })} placeholder="2026.10.1" value={draft.buildLabel} />
        </label>
        {draft.type === "Production" ? (
          <div className="span-all"><Alert tone="warn">{t("project.environment.productionWarning")}</Alert></div>
        ) : null}
        <div className="form-actions span-all">
          <button className="secondary-button" onClick={onCancel} type="button">{t("common.cancel")}</button>
          <button className="primary-button" disabled={pending} onClick={submit} type="button">{t("common.save")}</button>
        </div>
      </div>
    </Modal>
  );
}
