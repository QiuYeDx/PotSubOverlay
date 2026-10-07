import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowUpRight,
  ExternalLink,
  Github,
  Globe,
  Info,
  Mail,
  RefreshCw,
} from "lucide-react";
import { UPDATE_CHECK_EVENT, UPDATE_STATUS_EVENT } from "@/components/update";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  APP_AUTHOR_URL,
  APP_BLOG_URL,
  APP_CONTACT_EMAIL,
  APP_NAME,
  APP_RELEASES_URL,
  APP_REPO_URL,
} from "@/constants/app";
import AppLogo from "@/assets/app-logo.svg";

const openExternal = async (url: string) => {
  try {
    await window.ipcRenderer.invoke("open-external", url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

function About() {
  const { t } = useTranslation();
  const appVersion = import.meta.env.VITE_APP_VERSION || "-";
  const [updateChecking, setUpdateChecking] = useState(false);

  const handleManualCheck = () => {
    setUpdateChecking(true);
    window.dispatchEvent(new Event(UPDATE_CHECK_EVENT));
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{ checking: boolean; source: "manual" | "auto" }>
      ).detail;
      if (!detail || detail.source !== "manual") return;
      setUpdateChecking(detail.checking);
    };

    window.addEventListener(UPDATE_STATUS_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(UPDATE_STATUS_EVENT, handler as EventListener);
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-[92px] pt-1 sm:px-8">
      <div className="mb-5">
        <div className="text-2xl font-semibold tracking-tight">
          {t("about:title")}
        </div>
        <div className="mt-1 text-sm text-muted-foreground">
          {t("about:description")}
        </div>
      </div>

      <div className="mb-3 overflow-hidden rounded-xl border bg-card">
        <div className="relative p-6">
          <div className="flex items-start gap-5">
            <img
              src={AppLogo}
              alt={APP_NAME}
              className="h-16 w-16 shrink-0 rounded-2xl shadow-sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="m-0 text-2xl font-semibold tracking-tight">
                  {APP_NAME}
                </h2>
                <Badge variant="outline" className="font-mono text-[11px]">
                  v{appVersion}
                </Badge>
              </div>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                {t("about:tagline")}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleManualCheck}
                  disabled={updateChecking}
                  aria-busy={updateChecking}
                  className="gap-1.5"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      updateChecking ? "animate-spin" : ""
                    }`}
                  />
                  {updateChecking
                    ? t("common:update.checking")
                    : t("common:action.check_update")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void openExternal(APP_REPO_URL)}
                  className="gap-1.5"
                >
                  <Github className="h-3.5 w-3.5" />
                  {t("about:buttons.repo")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void openExternal(APP_RELEASES_URL)}
                  className="gap-1.5"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("about:buttons.releases")}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
            <Stat label={t("about:stats.platform")} value="Windows 11" />
            <Stat label={t("about:stats.license")} value="MIT" />
            <Stat label={t("about:stats.build")} value={`v${appVersion}`} mono />
            <Stat label={t("about:stats.stack")} value="Electron / React" />
          </div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LinkCard
          icon={<Github className="h-[18px] w-[18px]" />}
          title={t("about:links.repo.title")}
          url={APP_REPO_URL.replace("https://", "")}
          desc={t("about:links.repo.desc")}
          href={APP_REPO_URL}
        />
        <LinkCard
          icon={<Globe className="h-[18px] w-[18px]" />}
          title={t("about:links.author.title")}
          url="qiuvision.com"
          desc={t("about:links.author.desc")}
          href={APP_AUTHOR_URL}
        />
        <LinkCard
          icon={<ExternalLink className="h-[18px] w-[18px]" />}
          title={t("about:links.blog.title")}
          url="blog.qiuyedx.com"
          desc={t("about:links.blog.desc")}
          href={APP_BLOG_URL}
        />
        <LinkCard
          icon={<Mail className="h-[18px] w-[18px]" />}
          title={t("about:links.contact.title")}
          url={APP_CONTACT_EMAIL}
          desc={t("about:links.contact.desc")}
          href={`mailto:${APP_CONTACT_EMAIL}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("about:subtitle.tech_stack")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-x-7 gap-y-1 sm:grid-cols-2">
            {[
              [t("about:tech.framework"), "Electron 41 + React 19"],
              [t("about:tech.language"), "TypeScript 5.9"],
              [t("about:tech.build_tool"), "Vite 5"],
              [t("about:tech.style"), "Tailwind CSS 4 + shadcn/ui"],
              [t("about:tech.state"), "Zustand"],
              [t("about:tech.motion"), "Motion"],
              [t("about:tech.i18n"), "i18next"],
              [t("about:tech.pkg"), "pnpm 8.7.0"],
            ].map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between border-b border-dashed py-1.5 text-xs last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0"
              >
                <span className="text-muted-foreground">{key}</span>
                <span className="font-mono text-foreground/80">{value}</span>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="leading-relaxed">{t("about:license_note")}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-[13px] font-medium text-foreground ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function LinkCard({
  icon,
  title,
  url,
  desc,
  href,
}: {
  icon: ReactNode;
  title: string;
  url: string;
  desc: string;
  href: string;
}) {
  return (
    <button
      type="button"
      onClick={() => void openExternal(href)}
      className="group rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/50"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            {title}
            <ArrowUpRight className="h-3.5 w-3.5 opacity-50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
          <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
            {url}
          </div>
          <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {desc}
          </div>
        </div>
      </div>
    </button>
  );
}

export default About;
