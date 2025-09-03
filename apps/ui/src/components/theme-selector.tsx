import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { type ColorTheme, useTheme } from "@/contexts/theme-context";
import { type ThemeInfo, getAllThemes } from "@/lib/theme-loader";
import { IconCheck } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function ThemeSelector() {
	const { colorTheme, setColorTheme } = useTheme();
	const { t } = useTranslation();
	const [themes, setThemes] = useState<ThemeInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [showAll, setShowAll] = useState(false);

	// Show 6 themes initially (2 rows × 3 cols on desktop)
	const themesToShow = showAll ? themes : themes.slice(0, 8);
	const hasMoreThemes = themes.length > 8;

	useEffect(() => {
		const loadThemes = async () => {
			try {
				setLoading(true);
				const availableThemes = await getAllThemes();
				setThemes(availableThemes);
			} catch (error) {
				console.error("Failed to load themes:", error);
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
						"Choose your preferred color scheme and visual style",
					)}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{loading ? (
					<div className="flex items-center justify-center py-8">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
						<span className="ml-2 text-muted-foreground">
							{t("settings.theme.loading", "Loading themes...")}
						</span>
					</div>
				) : (
					<>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
							{themesToShow.map((theme) => (
								<div key={theme.name} className="relative">
									<Button
										variant="outline"
										className={`w-full h-auto p-4 flex flex-col items-start space-y-3 text-left transition-all hover:scale-105 ${
											colorTheme === theme.name
												? "ring-2 ring-primary border-primary"
												: ""
										}`}
										onClick={() => setColorTheme(theme.name as ColorTheme)}
									>
										{/* Theme Preview */}
										<div className="w-full h-20 rounded-md overflow-hidden border">
											<div
												className="w-full h-full relative"
												style={{ backgroundColor: theme.preview.background }}
											>
												{/* Background pattern */}
												<div className="absolute inset-2 rounded-sm grid grid-cols-3 gap-1">
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
														className="rounded-sm col-span-2"
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
											<p className="text-sm text-muted-foreground mt-1">
												{t(
													`themes.${theme.name}.description`,
													theme.description,
												)}
											</p>
										</div>
									</Button>
								</div>
							))}
						</div>

						{/* Show More/Less Button */}
						{hasMoreThemes && (
							<div className="flex justify-center mt-6">
								<Button
									variant="outline"
									size="sm"
									onClick={() => setShowAll(!showAll)}
									className="px-8"
								>
									{showAll
										? t("settings.theme.showLess", "Ver menos")
										: t(
												"settings.theme.showMore",
												`Ver más (${themes.length - 6})`,
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
