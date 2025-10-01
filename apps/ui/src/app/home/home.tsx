import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import { TourAlertDialog, type TourStep, useTour } from "@/components/tour";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";
import { data } from "./data";

const TOUR_OPEN_DELAY = 100;

export default function Page() {
  const { t } = useTranslation();
  const { setSteps, isTourCompleted } = useTour();
  const [openTour, setOpenTour] = useState(false);
  const steps: TourStep[] = useMemo(
    () => [
      {
        content: <div className="p-2">{t("tour.homeTour.step1")}</div>,
        selectorId: TOUR_STEP_IDS.SETTINGS_BUTTON,
        position: "right",
      },
    ],
    [t]
  );

  useEffect(() => {
    if (localStorage.getItem("home_tour_completed") === "true") {
      return;
    }

    setSteps(steps);
    const timer = setTimeout(() => {
      setOpenTour(true);
    }, TOUR_OPEN_DELAY);

    return () => clearTimeout(timer);
  }, [setSteps, isTourCompleted, steps]);

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <DataTable data={data} />
      <TourAlertDialog isOpen={openTour} setIsOpen={setOpenTour} />
    </div>
  );
}
