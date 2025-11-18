import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { type TourStep, useTour } from "@/components/tour";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";

export function useSettingsTour() {
  const { setSteps, startTour } = useTour();
  const { t } = useTranslation();

  const steps: TourStep[] = useMemo(
    () => [
      {
        content: <div className="p-2">{t("tour.settingsTour.step1")}</div>,
        selectorId: TOUR_STEP_IDS.Settings.TwoFactor.CARD,
        position: "top",
      },
      {
        content: <div className="p-2">{t("tour.settingsTour.step2")}</div>,
        selectorId: TOUR_STEP_IDS.Settings.TwoFactor.SWITCH,
        position: "right",
      },
    ],
    [t]
  );

  useEffect(() => {
    if (localStorage.getItem("settings_tour_completed") === "true") {
      return;
    }
    setSteps(steps);
    startTour();
  }, [setSteps, startTour, steps]);
}
