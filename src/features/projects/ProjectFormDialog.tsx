import { useEffect, useState } from "react";
import { Modal } from "../../shared/ui/Modal";
import { useT } from "../../lib/i18n/LocalizationProvider";
import type { ProjectRecord } from "./projectsApi";

export type ProjectDraft = {
  description: string;
  name: string;
  owner: string;
  repositoryUrl: string;
  tags: string[];
};

const EMPTY: ProjectDraft = { description: "", name: "", owner: "", repositoryUrl: "", tags: [] };

export function ProjectFormDialog({
  error,
  existingNames,
  onCancel,
  onSubmit,
  pending,
  project
}: {
  error?: string;
  existingNames: string[];
  onCancel: () => void;
  onSubmit: (draft: ProjectDraft) => void;
  pending: boolean;
  project?: ProjectRecord;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY);
  const [tagText, setTagText] = useState("");
  const [nameMissing, setNameMissing] = useState(false);

  useEffect(() => {
    setDraft({
      description: project?.description ?? "",
      name: project?.name ?? "",
      owner: project?.owner ?? "",
      repositoryUrl: project?.repositoryUrl ?? "",
      tags: project?.tags ?? []
    });
    setTagText((project?.tags ?? []).join(", "));
    setNameMissing(false);
  }, [project]);

  function submit() {
    if (!draft.name.trim()) {
      setNameMissing(true);
      return;
    }
    onSubmit({
      ...draft,
      name: draft.name.trim(),
      tags: tagText.split(",").map((tag) => tag.trim()).filter(Boolean)
    });
  }

  const taken = existingNames.map((name) => name.toLowerCase());
  const duplicate = taken.includes(draft.name.trim().toLowerCase()) && draft.name.trim() !== project?.name;

  return (
    <Modal onClose={onCancel} title={project ? t("projects.editTitle") : t("projects.createTitle")}>
      <div className="form-grid">
        <label className={`form-field${nameMissing ? " field-invalid" : ""}`}>
          <span>{t("projects.form.name")}</span>
          <input
            autoFocus
            onChange={(event) => { setDraft({ ...draft, name: event.target.value }); setNameMissing(false); }}
            value={draft.name}
          />
          {nameMissing ? <span className="field-error">{t("projects.nameRequired")}</span> : null}
          {!nameMissing && duplicate ? <span className="field-error">{t("projects.duplicateName")}</span> : null}
        </label>
        <label className="form-field">
          <span>{t("projects.form.owner")}</span>
          <input
            onChange={(event) => setDraft({ ...draft, owner: event.target.value })}
            value={draft.owner}
          />
        </label>
        <label className="form-field span-all">
          <span>{t("projects.form.description")}</span>
          <textarea
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            value={draft.description}
          />
        </label>
        <label className="form-field">
          <span>{t("projects.form.tags")}</span>
          <input onChange={(event) => setTagText(event.target.value)} value={tagText} />
          <span className="field-hint">{t("projects.form.tagsHint")}</span>
        </label>
        <label className="form-field">
          <span>{t("projects.form.repositoryUrl")}</span>
          <input
            onChange={(event) => setDraft({ ...draft, repositoryUrl: event.target.value })}
            placeholder="https://git.example.com/team/app"
            value={draft.repositoryUrl}
          />
          <span className="field-hint">{t("projects.form.repositoryHint")}</span>
        </label>
        {error ? <p className="field-error span-all">{error}</p> : null}
        <div className="form-actions span-all">
          <button className="secondary-button" onClick={onCancel} type="button">{t("common.cancel")}</button>
          <button className="primary-button" disabled={pending || duplicate} onClick={submit} type="button">
            {project ? t("common.save") : t("common.create")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
