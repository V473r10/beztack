import { createWorker } from "tesseract.js";

export const extractTextFromImage = async (
	imagePath: string,
	lang?: string,
) => {
	const worker = await createWorker(lang);
	const ret = await worker.recognize(imagePath);
	await worker.terminate();
	return ret.data.text;
};
