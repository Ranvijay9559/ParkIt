const { createWorker } = require("tesseract.js");

let workerPromise;
let scanQueue = Promise.resolve();

const getWorker = () => {
  if (!workerPromise) {
    console.log("[ANPR] Initializing Tesseract worker");
    workerPromise = createWorker("eng", 1, {
      logger: ({ status, progress }) => {
        const percentage = Number.isFinite(progress)
          ? ` ${Math.round(progress * 100)}%`
          : "";
        console.log(`[ANPR OCR] ${status}${percentage}`);
      }
    })
      .then(async (worker) => {
        await worker.setParameters({
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
          tessedit_pageseg_mode: "7"
        });
        console.log("[ANPR] Tesseract worker ready");
        return worker;
      })
      .catch((error) => {
        workerPromise = null;
        console.error("[ANPR] Tesseract worker initialization failed:", error.message);
        throw error;
      });
  }

  return workerPromise;
};

const runScan = async (image) => {
  if (!image) {
    throw new Error("Vehicle image is required");
  }

  const worker = await getWorker();

  try {
    console.log("[ANPR] Recognizing captured plate image");
    const result = await worker.recognize(image);

    const rawText = result.data.text || "";

    const cleanedText = rawText
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    // Accept common Indian registration formats, including BH-series plates.
    // OCR output often contains spaces or punctuation, removed above.
    const vehicleNumber = cleanedText.match(
      /(?:[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}|\d{2}BH\d{4}[A-Z]{1,2})/
    )?.[0] || "";

    console.log(`[ANPR] Recognition finished; plate candidate ${vehicleNumber ? "found" : "not found"}`);

    return {
      rawText,
      vehicleNumber
    };
  } catch (error) {
    // Discard a worker that failed so the next request can initialize a clean one.
    workerPromise = null;
    console.error("[ANPR] Recognition failed:", error.message);
    await worker.terminate().catch(() => {});
    throw error;
  }
};

const detectVehicleNumber = (image) => {
  // A single OCR worker handles scans sequentially within a warm server instance.
  const scan = scanQueue.then(() => runScan(image));
  scanQueue = scan.catch(() => {});
  return scan;
};

module.exports = {
  detectVehicleNumber
};
