const { createWorker } = require("tesseract.js");

const detectVehicleNumber = async (image) => {
  if (!image) {
    throw new Error("Vehicle image is required");
  }

  const worker = await createWorker("eng");

  try {
    await worker.setParameters({
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      tessedit_pageseg_mode: "7"
    });

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

    return {
      rawText,
      vehicleNumber
    };
  } finally {
    await worker.terminate();
  }
};

module.exports = {
  detectVehicleNumber
};
