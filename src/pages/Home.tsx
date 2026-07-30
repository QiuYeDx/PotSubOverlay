import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SmoothCorners } from "@/components/qiuye-ui/smooth-corners";
import { APP_NAME } from "@/constants/app";
import AppLogo from "@/assets/app-logo.svg";
import {
  Boxes,
  Brush,
  CheckCircle2,
  FolderCode,
  Languages,
  Moon,
  Rocket,
  Settings2,
} from "lucide-react";

const featureIcons = [Brush, Languages, Moon, Settings2];

function Home() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-[92px] pt-6 sm:px-8">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <SmoothCorners asChild radius={12} smoothing={0.7}>
          <section
            className="border bg-card p-6 shadow-sm"
            data-smooth-corners="home-hero"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <img
                src={AppLogo}
                alt={APP_NAME}
                className="h-20 w-20 shrink-0 rounded-2xl shadow-sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="m-0 text-2xl font-semibold tracking-tight">
                    {t("home:hero.title")}
                  </h1>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    v{import.meta.env.VITE_APP_VERSION}
                  </Badge>
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {t("home:hero.description")}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button size="sm" className="gap-1.5">
                    <Rocket className="h-3.5 w-3.5" />
                    {t("home:actions.start")}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <FolderCode className="h-3.5 w-3.5" />
                    {t("home:actions.customize")}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </SmoothCorners>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Boxes className="h-4 w-4" />
              {t("home:stack.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {["Electron", "React 19", "Vite 5", "Tailwind CSS 4"].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between border-b border-dashed py-1.5 text-sm last:border-b-0"
              >
                <span className="text-muted-foreground">{item}</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => {
          const Icon = featureIcons[index];
          return (
            <Card key={index}>
              <CardHeader className="gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-muted">
                  <Icon className="h-4 w-4" />
                </div>
                <CardTitle className="text-base">
                  {t(`home:features.${index}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`home:features.${index}.description`)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default Home;
