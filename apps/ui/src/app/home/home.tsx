import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import { TourAlertDialog, type TourStep, useTour } from "@/components/tour";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { data } from "./data";

export default function Page() {
	const { t } = useTranslation();
	const { setSteps, isTourCompleted } = useTour();
	const [openTour, setOpenTour] = useState(false);
	const steps: TourStep[] = [
		{
			content: <div className="p-2">{t("tour.homeTour.step1")}</div>,
			selectorId: TOUR_STEP_IDS.SETTINGS_BUTTON,
			position: "right",
		},
	];

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		if (localStorage.getItem("home_tour_completed") === "true") {
			return;
		}

		setSteps(steps);
		const timer = setTimeout(() => {
			setOpenTour(true);
		}, 100);

		return () => clearTimeout(timer);
	}, [setSteps, isTourCompleted]);

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
