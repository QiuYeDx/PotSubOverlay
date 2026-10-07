import { useTranslation } from "react-i18next";
import { MonitorUp } from "lucide-react";
import { SettingsGroup, SettingsRow } from "@/components/app/SettingsGroup";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { UPDATE_CHECK_EVENT } from "@/components/update";
import { APP_REPO_NAME, APP_REPO_OWNER } from "@/constants/app";
import useUpdatePreferencesStore from "@/store/useUpdatePreferencesStore";

function UpdateConfig() {
  const { t } = useTranslation();
  const { autoCheck, showChangelog, setAutoCheck, setShowChangelog } = useUpdatePreferencesStore();

  return (
    <SettingsGroup
      title={t("setting:subtitle.update_config")}
      action={
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          onClick={() => window.dispatchEvent(new Event(UPDATE_CHECK_EVENT))}
        >
          <MonitorUp className="size-3.5" />
          {t("common:action.check_update")}
        </Button>
      }
    >
      <SettingsRow
        label={t("setting:fields.update.auto_check.label")}
        description={t("setting:fields.update.auto_check.desc")}
      >
        <Switch checked={autoCheck} onCheckedChange={setAutoCheck} />
      </SettingsRow>
      <SettingsRow
        label={t("setting:fields.update.show_changelog.label")}
        description={t("setting:fields.update.show_changelog.desc")}
      >
        <Switch checked={showChangelog} onCheckedChange={setShowChangelog} />
      </SettingsRow>
      <SettingsRow
        label={t("setting:fields.update.target_repo")}
        description={t("setting:fields.update.target_repo_desc")}
      >
        <span className="font-mono text-xs text-muted-foreground">
          {APP_REPO_OWNER}/{APP_REPO_NAME}
        </span>
      </SettingsRow>
    </SettingsGroup>
  );
}

export default UpdateConfig;
