import { IconCheck } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type ColorTheme, useTheme } from "@/contexts/theme-context";
import { getAllThemes, type ThemeInfo } from "@/lib/theme-loader";

export function ThemeSelector() {
  const { colorTheme, setColorTheme } = useTheme();
  const { t } = useTranslation();
  const [themes, setThemes] = useState<ThemeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Constants for theme display
  const INITIAL_THEMES_TO_SHOW = 8;
  const THEMES_CALCULATION_OFFSET = 6;

  // Show 6 themes initially (2 rows × 3 cols on desktop)
  const themesToShow = showAll
    ? themes
    : themes.slice(0, INITIAL_THEMES_TO_SHOW);
  const hasMoreThemes = themes.length > INITIAL_THEMES_TO_SHOW;

  useEffect(() => {
    const loadThemes = async () => {
      try {
        setLoading(true);
        const availableThemes = await getAllThemes();
        setThemes(availableThemes);
      } catch (_error) {
        // TODO: Handle theme loading error
        // Silently handle theme loading errors
      } finally {
        setLoading(false);
      }
    };
    loadThemes();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.theme.colorTheme", "Color Theme")}</CardTitle>
        <CardDescription>
          {t(
            "settings.theme.colorThemeDescription",
            "Choose your preferred color scheme and visual style"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
            <span className="ml-2 text-muted-foreground">
              {t("settings.theme.loading", "Loading themes...")}
            </span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {themesToShow.map((theme) => (
                <div className="relative" key={theme.name}>
                  <Button
                    className={`flex h-auto w-full flex-col items-start space-y-3 p-4 text-left transition-all hover:scale-105 ${
                      colorTheme === theme.name
                        ? "border-primary ring-2 ring-primary"
                        : ""
                    }`}
                    onClick={() => setColorTheme(theme.name as ColorTheme)}
                    variant="outline"
                  >
                    {/* Theme Preview */}
                    <div className="h-20 w-full overflow-hidden rounded-md border">
                      <div
                        className="relative h-full w-full"
                        style={{ backgroundColor: theme.preview.background }}
                      >
                        {/* Background pattern */}
                        <div className="absolute inset-2 grid grid-cols-3 gap-1 rounded-sm">
                          <div
                            className="rounded-sm"
                            style={{ backgroundColor: theme.preview.primary }}
                          />
                          <div
                            className="rounded-sm"
                            style={{ backgroundColor: theme.preview.secondary }}
                          />
                          <div
                            className="rounded-sm"
                            style={{ backgroundColor: theme.preview.accent }}
                          />
                          <div
                            className="col-span-2 rounded-sm"
                            style={{
                              backgroundColor: theme.preview.foreground,
                            }}
                          />
                          <div
                            className="rounded-sm"
                            style={{ backgroundColor: theme.preview.primary }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Theme Info */}
                    <div className="w-full">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">
                          {t(`themes.${theme.name}.label`, theme.label)}
                        </h3>
                        {colorTheme === theme.name && (
                          <IconCheck className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <p className="mt-1 text-muted-foreground text-sm">
                        {t(
                          `themes.${theme.name}.description`,
                          theme.description
                        )}
                      </p>
                    </div>
                  </Button>
                </div>
              ))}
            </div>

            {/* Show More/Less Button */}
            {hasMoreThemes && (
              <div className="mt-6 flex justify-center">
                <Button
                  className="px-8"
                  onClick={() => setShowAll(!showAll)}
                  size="sm"
                  variant="outline"
                >
                  {showAll
                    ? t("settings.theme.showLess", "Ver menos")
                    : t(
                        "settings.theme.showMore",
                        `Ver más (${themes.length - THEMES_CALCULATION_OFFSET})`
                      )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
