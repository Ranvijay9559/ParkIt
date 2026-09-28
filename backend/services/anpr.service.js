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

    return {
      rawText,
      vehicleNumber: cleanedText
    };
  } finally {
    await worker.terminate();
  }
};

module.exports = {
  detectVehicleNumber
};