"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { extractTextFromImage } from "@buncn/ocr";
import {
	Camera,
	Copy,
	Loader2,
	StopCircle,
	Trash2,
	Upload,
} from "lucide-react";
import { useRef, useState } from "react";

interface Language {
	code: string;
	name: string;
}

const languages: Language[] = [
	{ code: "eng", name: "English" },
	{ code: "spa", name: "Español" },
	{ code: "fra", name: "Français" },
	{ code: "deu", name: "Deutsch" },
	{ code: "ita", name: "Italiano" },
	{ code: "por", name: "Português" },
	{ code: "rus", name: "Русский" },
	{ code: "chi_sim", name: "中文 (简体)" },
	{ code: "jpn", name: "日本語" },
	{ code: "ara", name: "العربية" },
];

export default function OCR() {
	const [selectedLanguage, setSelectedLanguage] = useState<string>("eng");
	const [extractedText, setExtractedText] = useState<string>("");
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string>("");
	const [previewImage, setPreviewImage] = useState<string>("");
	const [analyzing, setAnalyzing] = useState<boolean>(false);
	const [analysisError, setAnalysisError] = useState<string>("");
	const [analysis, setAnalysis] = useState<
		| {
				store: string;
				date: string;
				items: { name: string; quantity: number; unitPrice: number; total: number }[];
				subtotal?: number;
				tax: number;
				total: number;
		  }
		| null
	>(null);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

	const startCamera = async () => {
		try {
			setError("");
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: "environment" },
			});

			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				setIsCameraActive(true);
			}
		} catch (err) {
			setError(
				`Error accessing camera: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		}
	};

	const stopCamera = () => {
		if (videoRef.current?.srcObject) {
			const stream = videoRef.current.srcObject as MediaStream;
			for (const track of stream.getTracks()) {
				track.stop();
			}
			videoRef.current.srcObject = null;
			setIsCameraActive(false);
		}
	};

	const capturePhoto = () => {
		if (!videoRef.current || !canvasRef.current) return;

		const canvas = canvasRef.current;
		const video = videoRef.current;

		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;

		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.drawImage(video, 0, 0);

			canvas.toBlob(
				async (blob) => {
					if (blob) {
						const file = new File([blob], "camera-capture.jpg", {
							type: "image/jpeg",
						});
						await processImage(file);
					}
				},
				"image/jpeg",
				0.9,
			);
		}

		stopCamera();
	};

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			processImage(file);
		}
	};

	const processImage = async (file: File) => {
		try {
			setError("");
			setIsLoading(true);

			// Create preview URL
			const previewUrl = URL.createObjectURL(file);
			setPreviewImage(previewUrl);

			// Process with OCR
			const text = await extractTextFromImage(previewUrl, selectedLanguage);
			setExtractedText(text);
		} catch (err) {
			setError(
				`Error processing image: ${err instanceof Error ? err.message : "Unknown error"}`,
			);
		} finally {
			setIsLoading(false);
		}
	};

	const clearResults = () => {
		setExtractedText("");
		setPreviewImage("");
		setError("");
		setAnalysis(null);
		setAnalysisError("");
		setAnalyzing(false);
		stopCamera();
	};

	const analyzeReceipt = async () => {
		if (!extractedText.trim()) {
			setAnalysisError("Please extract text first.");
			return;
		}
		try {
			setAnalysisError("");
			setAnalyzing(true);
			const res = await fetch("http://localhost:3000/ai/analyze", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ text: extractedText }),
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data?.error || "Failed to analyze");
			}
			setAnalysis(data);
		} catch (e) {
			setAnalysis(null);
			setAnalysisError(e instanceof Error ? e.message : "Unknown error");
		} finally {
			setAnalyzing(false);
		}
	};

	return (
		<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<div className="text-center px-4 lg:px-6">
				<h1 className="text-3xl font-bold mb-2">OCR - Extractor de Texto</h1>
				<p className="text-muted-foreground">
					Capture o seleccione una imagen para extraer texto
				</p>
			</div>

			<div className="px-4 lg:px-6">
				<Card>
					<CardHeader>
						<CardTitle>Configuración</CardTitle>
						<CardDescription>
							Seleccione el idioma para el reconocimiento de texto
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							<Label htmlFor="language-select">Idioma de reconocimiento</Label>
							<Select
								value={selectedLanguage}
								onValueChange={setSelectedLanguage}
							>
								<SelectTrigger id="language-select" className="w-full">
									<SelectValue placeholder="Seleccionar idioma" />
								</SelectTrigger>
								<SelectContent>
									{languages.map((lang) => (
										<SelectItem key={lang.code} value={lang.code}>
											{lang.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="px-4 lg:px-6">
				<Card>
					<CardHeader>
						<CardTitle>Cámara</CardTitle>
						<CardDescription>
							Utilice la cámara de su dispositivo para capturar imágenes
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex flex-wrap gap-3 mb-4">
							{!isCameraActive ? (
								<Button onClick={startCamera} className="gap-2">
									<Camera className="size-4" />
									Activar Cámara
								</Button>
							) : (
								<div className="flex gap-3">
									<Button
										onClick={capturePhoto}
										variant="default"
										className="gap-2"
									>
										<Camera className="size-4" />
										Capturar Foto
									</Button>
									<Button
										onClick={stopCamera}
										variant="destructive"
										className="gap-2"
									>
										<StopCircle className="size-4" />
										Detener Cámara
									</Button>
								</div>
							)}
						</div>

						{isCameraActive && (
							<div className="flex justify-center">
								<video
									ref={videoRef}
									autoPlay
									playsInline
									className="w-full max-w-md rounded-lg border"
								>
									<track kind="captions" srcLang="en" label="English" />
								</video>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<div className="px-4 lg:px-6">
				<Card>
					<CardHeader>
						<CardTitle>Seleccionar Imagen</CardTitle>
						<CardDescription>
							Cargue una imagen desde su dispositivo
						</CardDescription>
					</CardHeader>
					<CardContent>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							onChange={handleFileSelect}
							className="hidden"
						/>
						<Button
							onClick={() => fileInputRef.current?.click()}
							variant="outline"
							className="gap-2"
						>
							<Upload className="size-4" />
							Seleccionar Imagen
						</Button>
					</CardContent>
				</Card>
			</div>

			{isLoading && (
				<div className="px-4 lg:px-6">
					<Card>
						<CardContent className="pt-6">
							<div className="flex items-center justify-center gap-3">
								<Loader2 className="size-5 animate-spin" />
								<span>Procesando imagen...</span>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{error && (
				<div className="px-4 lg:px-6">
					<Card className="border-destructive">
						<CardContent className="pt-6">
							<div className="flex items-center gap-2 text-destructive">
								<span className="text-lg">⚠️</span>
								<span>{error}</span>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{previewImage && (
				<div className="px-4 lg:px-6">
					<Card>
						<CardHeader>
							<CardTitle>Imagen Procesada</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex justify-center">
								<img
									src={previewImage}
									alt="Preview"
									className="max-w-full max-h-64 rounded-lg border"
								/>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{extractedText && (
				<div className="px-4 lg:px-6">
					<Card>
						<CardHeader>
							<div className="flex justify-between items-center">
								<div>
									<CardTitle>Texto Extraído</CardTitle>
									<CardDescription>
										Resultado del reconocimiento óptico de caracteres
									</CardDescription>
								</div>
								<div className="flex gap-2">
									<Button
										onClick={() => navigator.clipboard.writeText(extractedText)}
										variant="outline"
										size="sm"
										className="gap-2"
									>
										<Copy className="size-4" />
										Copiar
									</Button>
									<Button
										onClick={analyzeReceipt}
										size="sm"
										className="gap-2"
										disabled={analyzing}
									>
										{analyzing ? <Loader2 className="size-4 animate-spin" /> : null}
										{analyzing ? "Analyzing…" : "Analyze receipt"}
									</Button>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className="bg-muted rounded-lg p-4">
								<pre className="whitespace-pre-wrap text-sm font-mono">
									{extractedText}
								</pre>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{analysisError && (
				<div className="px-4 lg:px-6">
					<Card className="border-destructive">
						<CardContent className="pt-6">
							<div className="flex items-center gap-2 text-destructive">
								<span className="text-lg">⚠️</span>
								<span>{analysisError}</span>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{analysis && (
				<div className="px-4 lg:px-6">
					<Card>
						<CardHeader>
							<div className="flex justify-between items-center">
								<div>
									<CardTitle>Receipt Analysis</CardTitle>
									<CardDescription>
										Structured data extracted from the receipt
									</CardDescription>
								</div>
								<Button
									onClick={() => navigator.clipboard.writeText(JSON.stringify(analysis, null, 2))}
									variant="outline"
									size="sm"
									className="gap-2"
								>
									<Copy className="size-4" />
									Copy JSON
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="bg-muted rounded-lg p-4">
										<div className="text-sm text-muted-foreground">Store</div>
										<div className="text-base font-medium">{analysis.store || "—"}</div>
									</div>
									<div className="bg-muted rounded-lg p-4">
										<div className="text-sm text-muted-foreground">Date</div>
										<div className="text-base font-medium">{analysis.date || "—"}</div>
									</div>
								</div>

								<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="text-left border-b">
												<th className="py-2 pr-3">Item</th>
												<th className="py-2 pr-3">Qty</th>
												<th className="py-2 pr-3">Unit price</th>
												<th className="py-2 pr-3">Line total</th>
											</tr>
										</thead>
										<tbody>
											{analysis.items?.length ? (
												analysis.items.map((it) => (
													<tr
														key={`${it.name}-${it.unitPrice}-${it.quantity}`}
														className="border-b last:border-0"
													>
														<td className="py-2 pr-3">{it.name}</td>
														<td className="py-2 pr-3">{it.quantity}</td>
														<td className="py-2 pr-3">{it.unitPrice.toFixed(2)}</td>
														<td className="py-2 pr-3">{it.total.toFixed(2)}</td>
													</tr>
												))
											) : (
												<tr>
													<td className="py-3 text-muted-foreground" colSpan={4}>
														No items detected
													</td>
												</tr>
											)}
										</tbody>
									</table>
								</div>

								<div className="flex flex-col items-end gap-1">
									<div className="flex gap-6 text-sm">
										<div className="text-muted-foreground">Subtotal</div>
										<div className="tabular-nums">
											{(analysis.subtotal ?? (analysis.total - analysis.tax)).toFixed(2)}
										</div>
									</div>
									<div className="flex gap-6 text-sm">
										<div className="text-muted-foreground">Tax</div>
										<div className="tabular-nums">{analysis.tax.toFixed(2)}</div>
									</div>
									<div className="flex gap-6 text-base font-semibold">
										<div>Total</div>
										<div className="tabular-nums">{analysis.total.toFixed(2)}</div>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{(previewImage || extractedText) && (
				<div className="px-4 lg:px-6 flex justify-center">
					<Button onClick={clearResults} variant="outline" className="gap-2">
						<Trash2 className="size-4" />
						Limpiar Resultados
					</Button>
				</div>
			)}

			{/* Hidden Canvas for Camera Capture */}
			<canvas ref={canvasRef} className="hidden" />
		</div>
	);
}
