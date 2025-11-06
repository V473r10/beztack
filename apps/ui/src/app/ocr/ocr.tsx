"use client";

import { extractTextFromImage } from "@beztack/ocr";
import {
  Camera,
  Copy,
  Loader2,
  StopCircle,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
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

const IMAGE_QUALITY = 0.9;

type Language = {
  code: string;
  name: string;
};

type AnalysisResult = {
  store: string;
  date: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal?: number;
  tax: number;
  total: number;
};

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

// Custom hook for camera functionality
function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

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
        `Error accessing camera: ${err instanceof Error ? err.message : "Unknown error"}`
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

  return { videoRef, isCameraActive, error, startCamera, stopCamera };
}

// Custom hook for OCR processing
function useOCRProcessing() {
  const [extractedText, setExtractedText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [previewImage, setPreviewImage] = useState<string>("");

  const processImage = async (file: File, language: string) => {
    try {
      setError("");
      setIsLoading(true);

      const previewUrl = URL.createObjectURL(file);
      setPreviewImage(previewUrl);

      const text = await extractTextFromImage(previewUrl, language);
      setExtractedText(text);
    } catch (err) {
      setError(
        `Error processing image: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    extractedText,
    isLoading,
    error,
    previewImage,
    processImage,
    setExtractedText,
    setPreviewImage,
    setError,
  };
}

// Custom hook for receipt analysis
function useReceiptAnalysis() {
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string>("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const analyzeReceipt = async (text: string) => {
    if (!text.trim()) {
      setAnalysisError("Please extract text first.");
      return;
    }

    try {
      setAnalysisError("");
      setAnalyzing(true);
      const res = await fetch("http://localhost:3000/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
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

  return {
    analyzing,
    analysisError,
    analysis,
    analyzeReceipt,
    setAnalysis,
    setAnalysisError,
    setAnalyzing,
  };
}

// Helper hook for photo capture functionality
function usePhotoCapture(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onCapture: (file: File) => Promise<void>,
  onComplete: () => void
) {
  const capturePhoto = () => {
    if (!(videoRef.current && canvasRef.current)) {
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      async (blob) => {
        if (blob) {
          const file = new File([blob], "camera-capture.jpg", {
            type: "image/jpeg",
          });
          await onCapture(file);
        }
      },
      "image/jpeg",
      IMAGE_QUALITY
    );

    onComplete();
  };

  return { capturePhoto };
}

// Component for language selection
function LanguageSelector({
  selectedLanguage,
  onLanguageChange,
}: {
  selectedLanguage: string;
  onLanguageChange: (value: string) => void;
}) {
  return (
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
            <Select onValueChange={onLanguageChange} value={selectedLanguage}>
              <SelectTrigger className="w-full" id="language-select">
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
  );
}

// Component for camera controls
function CameraControls({
  camera,
  onCapture,
}: {
  camera: ReturnType<typeof useCamera>;
  onCapture: () => void;
}) {
  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Cámara</CardTitle>
          <CardDescription>
            Utilice la cámara de su dispositivo para capturar imágenes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-3">
            {camera.isCameraActive ? (
              <div className="flex gap-3">
                <Button className="gap-2" onClick={onCapture} variant="default">
                  <Camera className="size-4" />
                  Capturar Foto
                </Button>
                <Button
                  className="gap-2"
                  onClick={camera.stopCamera}
                  variant="destructive"
                >
                  <StopCircle className="size-4" />
                  Detener Cámara
                </Button>
              </div>
            ) : (
              <Button className="gap-2" onClick={camera.startCamera}>
                <Camera className="size-4" />
                Activar Cámara
              </Button>
            )}
          </div>

          {camera.isCameraActive && (
            <div className="flex justify-center">
              <video
                autoPlay
                className="w-full max-w-md rounded-lg border"
                playsInline
                ref={camera.videoRef}
              >
                <track kind="captions" label="English" srcLang="en" />
              </video>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Component for file selection
function FileSelector({
  onFileSelect,
  fileInputRef,
}: {
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
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
            accept="image/*"
            className="hidden"
            onChange={onFileSelect}
            ref={fileInputRef}
            type="file"
          />
          <Button
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
          >
            <Upload className="size-4" />
            Seleccionar Imagen
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Component for extracted text display
function ExtractedText({
  text,
  onAnalyze,
  analyzing,
}: {
  text: string;
  onAnalyze: () => void;
  analyzing: boolean;
}) {
  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Texto Extraído</CardTitle>
              <CardDescription>
                Resultado del reconocimiento óptico de caracteres
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                className="gap-2"
                onClick={() => navigator.clipboard.writeText(text)}
                size="sm"
                variant="outline"
              >
                <Copy className="size-4" />
                Copiar
              </Button>
              <Button
                className="gap-2"
                disabled={analyzing}
                onClick={onAnalyze}
                size="sm"
              >
                {analyzing ? <Loader2 className="size-4 animate-spin" /> : null}
                {analyzing ? "Analyzing…" : "Analyze receipt"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted p-4">
            <pre className="whitespace-pre-wrap font-mono text-sm">{text}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Component for OCR results display
function OCRResults({
  ocr,
  camera,
  receipt,
  onClearResults,
}: {
  ocr: ReturnType<typeof useOCRProcessing>;
  camera: ReturnType<typeof useCamera>;
  receipt: ReturnType<typeof useReceiptAnalysis>;
  onClearResults: () => void;
}) {
  return (
    <>
      {ocr.isLoading && (
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

      {(ocr.error || camera.error) && (
        <div className="px-4 lg:px-6">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <span className="text-lg">⚠️</span>
                <span>{ocr.error || camera.error}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {ocr.previewImage && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle>Imagen Procesada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <img
                  alt="Preview"
                  className="max-h-64 max-w-full rounded-lg border"
                  height={256}
                  src={ocr.previewImage}
                  width={384}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {ocr.extractedText && (
        <ExtractedText
          analyzing={receipt.analyzing}
          onAnalyze={() => receipt.analyzeReceipt(ocr.extractedText)}
          text={ocr.extractedText}
        />
      )}

      {receipt.analysisError && (
        <div className="px-4 lg:px-6">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <span className="text-lg">⚠️</span>
                <span>{receipt.analysisError}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {receipt.analysis && (
        <div className="px-4 lg:px-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Receipt Analysis</CardTitle>
                  <CardDescription>
                    Structured data extracted from the receipt
                  </CardDescription>
                </div>
                <Button
                  className="gap-2"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      JSON.stringify(receipt.analysis, null, 2)
                    )
                  }
                  size="sm"
                  variant="outline"
                >
                  <Copy className="size-4" />
                  Copy JSON
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg bg-muted p-4">
                    <div className="text-muted-foreground text-sm">Store</div>
                    <div className="font-medium text-base">
                      {receipt.analysis.store || "—"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <div className="text-muted-foreground text-sm">Date</div>
                    <div className="font-medium text-base">
                      {receipt.analysis.date || "—"}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-3">Item</th>
                        <th className="py-2 pr-3">Qty</th>
                        <th className="py-2 pr-3">Unit price</th>
                        <th className="py-2 pr-3">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipt.analysis.items?.length ? (
                        receipt.analysis.items.map((it) => (
                          <tr
                            className="border-b last:border-0"
                            key={`${it.name}-${it.unitPrice}-${it.quantity}`}
                          >
                            <td className="py-2 pr-3">{it.name}</td>
                            <td className="py-2 pr-3">{it.quantity}</td>
                            <td className="py-2 pr-3">
                              {it.unitPrice.toFixed(2)}
                            </td>
                            <td className="py-2 pr-3">{it.total.toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            className="py-3 text-muted-foreground"
                            colSpan={4}
                          >
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
                      {(
                        receipt.analysis.subtotal ??
                        receipt.analysis.total - receipt.analysis.tax
                      ).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div className="text-muted-foreground">Tax</div>
                    <div className="tabular-nums">
                      {receipt.analysis.tax.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex gap-6 font-semibold text-base">
                    <div>Total</div>
                    <div className="tabular-nums">
                      {receipt.analysis.total.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {(ocr.previewImage || ocr.extractedText) && (
        <div className="flex justify-center px-4 lg:px-6">
          <Button className="gap-2" onClick={onClearResults} variant="outline">
            <Trash2 className="size-4" />
            Limpiar Resultados
          </Button>
        </div>
      )}
    </>
  );
}

export default function OCR() {
  const [selectedLanguage, setSelectedLanguage] = useState<string>("eng");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const camera = useCamera();
  const ocr = useOCRProcessing();
  const receipt = useReceiptAnalysis();

  const photoCapture = usePhotoCapture(
    camera.videoRef,
    canvasRef,
    (file) => ocr.processImage(file, selectedLanguage),
    camera.stopCamera
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      ocr.processImage(file, selectedLanguage);
    }
  };

  const clearResults = () => {
    ocr.setExtractedText("");
    ocr.setPreviewImage("");
    ocr.setError("");
    receipt.setAnalysis(null);
    receipt.setAnalysisError("");
    receipt.setAnalyzing(false);
    camera.stopCamera();
  };

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 text-center lg:px-6">
        <h1 className="mb-2 font-bold text-3xl">OCR - Extractor de Texto</h1>
        <p className="text-muted-foreground">
          Capture o seleccione una imagen para extraer texto
        </p>
      </div>

      <LanguageSelector
        onLanguageChange={setSelectedLanguage}
        selectedLanguage={selectedLanguage}
      />

      <CameraControls camera={camera} onCapture={photoCapture.capturePhoto} />

      <FileSelector
        fileInputRef={fileInputRef}
        onFileSelect={handleFileSelect}
      />

      <OCRResults
        camera={camera}
        ocr={ocr}
        onClearResults={clearResults}
        receipt={receipt}
      />

      {/* Hidden Canvas for Camera Capture */}
      <canvas className="hidden" ref={canvasRef} />
    </div>
  );
}
