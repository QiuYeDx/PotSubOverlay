import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  DownloadCloud,
  FileText,
  Loader2,
  MonitorUp,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DialogTitle,
  ScrollableDialog,
  ScrollableDialogContent,
  ScrollableDialogHeader,
} from "@/components/qiuye-ui/scrollable-dialog";
import useUpdatePreferencesStore from "@/store/useUpdatePreferencesStore";
import { APP_RELEASES_URL } from "@/constants/app";

export const UPDATE_CHECK_EVENT = "qiuye-template-check-update";
export const UPDATE_STATUS_EVENT = "qiuye-template-update-status";
export const UPDATE_AVAILABLE_EVENT = "qiuye-template-update-available";

export interface ChangelogSection {
  title?: string;
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  sections: ChangelogSection[];
}

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  latestTag: string;
  releaseUrl: string;
  releasesUrl: string;
  changelog?: ChangelogEntry[];
}

export type UpdateCheckResult =
  | {
      status: "available";
      update: AppUpdateInfo;
      message: string;
    }
  | {
      status: "current";
      update: null;
      message: string;
    }
  | {
      status: "error";
      update: null;
      message: string;
    };

type UpdateProps = {
  autoCheck?: boolean;
  autoCheckDelay?: number;
  showTrigger?: boolean;
  manualTriggerEvent?: string;
  triggerLabel?: string;
  checkingLabel?: string;
};

const openExternal = async (url: string) => {
  try {
    await window.ipcRenderer.invoke("open-external", url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

const Update = ({
  autoCheck = false,
  autoCheckDelay = 1500,
  showTrigger = true,
  manualTriggerEvent = UPDATE_CHECK_EVENT,
  triggerLabel,
  checkingLabel,
}: UpdateProps) => {
  const { t } = useTranslation();
  const { showChangelog } = useUpdatePreferencesStore();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const updateAvailable = result?.status === "available";
  const updateInfo = updateAvailable ? result.update : null;

  const triggerText = useMemo(
    () => triggerLabel ?? t("common:action.check_update"),
    [t, triggerLabel]
  );
  const checkingText = useMemo(
    () => checkingLabel ?? t("common:update.checking"),
    [t, checkingLabel]
  );

  const emitUpdateStatus = useCallback(
    (checking: boolean, source: "manual" | "auto") => {
      window.dispatchEvent(
        new CustomEvent(UPDATE_STATUS_EVENT, { detail: { checking, source } })
      );
    },
    []
  );

  const checkUpdate = useCallback(
    async (source: "manual" | "auto" = "manual") => {
      setChecking(true);
      emitUpdateStatus(true, source);

      try {
        const nextResult = await window.ipcRenderer.invoke<UpdateCheckResult>(
          "check-update",
          { includeChangelog: showChangelog }
        );

        setResult(nextResult);

        if (nextResult.status === "available") {
          window.dispatchEvent(
            new CustomEvent(UPDATE_AVAILABLE_EVENT, { detail: nextResult.update })
          );
          setModalOpen(true);
        } else if (source === "manual") {
          setModalOpen(true);
        }
      } finally {
        setChecking(false);
        emitUpdateStatus(false, source);
      }
    },
    [emitUpdateStatus, showChangelog]
  );

  useEffect(() => {
    const manualCheckHandler = () => {
      void checkUpdate("manual");
    };
    window.addEventListener(manualTriggerEvent, manualCheckHandler);

    let autoCheckTimer: number | undefined;
    if (autoCheck) {
      autoCheckTimer = window.setTimeout(() => {
        void checkUpdate("auto");
      }, autoCheckDelay);
    }

    return () => {
      window.removeEventListener(manualTriggerEvent, manualCheckHandler);
      if (autoCheckTimer) window.clearTimeout(autoCheckTimer);
    };
  }, [autoCheck, autoCheckDelay, checkUpdate, manualTriggerEvent]);

  return (
    <>
      <ScrollableDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        maxWidth={
          updateInfo?.changelog?.length
            ? "sm:max-w-[520px]"
            : "sm:max-w-[425px]"
        }
      >
        <ScrollableDialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MonitorUp className="h-5 w-5 text-primary" />
            {t("common:update.title")}
          </DialogTitle>
        </ScrollableDialogHeader>
        <ScrollableDialogContent>
          <UpdateDialogBody result={result} />
        </ScrollableDialogContent>
      </ScrollableDialog>

      {showTrigger ? (
        <Button disabled={checking} onClick={() => void checkUpdate("manual")}>
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MonitorUp className="h-4 w-4" />
          )}
          {checking ? checkingText : triggerText}
        </Button>
      ) : null}
    </>
  );
};

function UpdateDialogBody({ result }: { result: UpdateCheckResult | null }) {
  const { t } = useTranslation();

  if (!result) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("common:update.checking")}
      </div>
    );
  }

  if (result.status === "error") {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("common:update.error_title")}</AlertTitle>
          <AlertDescription className="mt-2 break-all whitespace-pre-wrap">
            {result.message}
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => void openExternal(APP_RELEASES_URL)}
        >
          <DownloadCloud className="h-4 w-4" />
          {t("common:update.open_releases")}
        </Button>
      </div>
    );
  }

  if (result.status === "current") {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold">
            {t("common:update.up_to_date_title")}
          </p>
          <p className="text-sm text-muted-foreground">{result.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-smooth-lg border bg-card p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium leading-none">
            {t("common:update.available_title", {
              version: result.update.latestVersion,
            })}
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {result.update.currentVersion}
            </span>
            <ArrowRight className="h-3 w-3" />
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
              {result.update.latestVersion}
            </span>
          </p>
        </div>
      </div>

      <ChangelogSection entries={result.update.changelog ?? []} />

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => void openExternal(result.update.releaseUrl)}
      >
        <DownloadCloud className="h-4 w-4" />
        {t("common:update.open_releases")}
      </Button>
    </div>
  );
}

function ChangelogSection({ entries }: { entries: ChangelogEntry[] }) {
  const { t } = useTranslation();
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        {t("common:update.changelog_title")}
      </p>
      <ScrollArea className="max-h-[240px] overflow-auto rounded-smooth-lg border bg-muted/30">
        <div className="space-y-3 p-3">
          {entries.map((entry, index) => (
            <div key={entry.version}>
              {index > 0 ? <div className="mb-3 h-px bg-border" /> : null}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                    v{entry.version}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {entry.date}
                  </span>
                </div>
                {entry.sections.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="space-y-1">
                    {section.title ? (
                      <p className="text-xs font-medium text-muted-foreground/80">
                        {section.title}
                      </p>
                    ) : null}
                    <ul className="space-y-0.5">
                      {section.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex items-start gap-1.5 text-sm">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default Update;

