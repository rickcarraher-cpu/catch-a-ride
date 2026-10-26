import React, { useState, useRef } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Star,
  Upload,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export default function PortraitBuilderWizard({
  driver,
  vehicles,
  onClose,
  onComplete,
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    driverName: driver?.first_name || driver?.name?.split(" ")[0] || "",
    driverPhone: driver?.phone || "",
    selectedVehicle: vehicles?.[0] || null,
    vehicleImageUrl: "",
    driverPortraitUrl: driver?.profile_image_url || "",
    vehicleDescription: "",
  });
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedPortraitUrl, setGeneratedPortraitUrl] = useState(null);
  const canvasRef = useRef(null);

  const totalSteps = 6;

  const handleNext = () => {
    if (step === 1 && !formData.selectedVehicle) {
      toast.error("Please select a vehicle");
      return;
    }
    if (step === 2 && !formData.vehicleImageUrl) {
      toast.error("Please upload a vehicle image");
      return;
    }
    // Skip portrait validation if driver already has one
    if (step === 3 && !formData.driverPortraitUrl) {
      toast.error("Please upload a driver portrait");
      return;
    }
    if (step === 4 && !formData.driverName.trim()) {
      toast.error("Please enter driver name");
      return;
    }
    if (step === 5 && !formData.driverPhone.trim()) {
      toast.error("Please enter driver phone number");
      return;
    }

    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      generatePortrait();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleFileUpload = async (file, fieldName) => {
    if (!file) return;

    setUploading(true);
    toast.loading("Uploading image...", { id: "portrait-upload" });

    try {
      const formDataObj = new FormData();
      formDataObj.append("file", file);

      const response = await fetch("/_create/api/upload/", {
        method: "POST",
        body: formDataObj,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();

      if (!result?.url) {
        throw new Error("No URL returned from upload");
      }

      setFormData((prev) => ({ ...prev, [fieldName]: result.url }));
      toast.success("Image uploaded!", { id: "portrait-upload" });
    } catch (err) {
      console.error("Image upload error:", err);
      toast.error("Failed to upload image", { id: "portrait-upload" });
    } finally {
      setUploading(false);
    }
  };

  const generatePortrait = async () => {
    setGenerating(true);
    toast.loading("Generating portrait card...", { id: "portrait-gen" });

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not found");

      const ctx = canvas.getContext("2d");
      canvas.width = 850;
      canvas.height = 1100;

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Company branding
      ctx.fillStyle = "#1e40af";
      ctx.font = "bold 42px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Catch A Ride", canvas.width / 2, 70);

      ctx.fillStyle = "#6b7280";
      ctx.font = "italic 20px Arial, sans-serif";
      ctx.fillText("...to the next adventure", canvas.width / 2, 105);

      // Horizontal line separator
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(100, 130);
      ctx.lineTo(canvas.width - 100, 130);
      ctx.stroke();

      // "YOUR DRIVER [FirstName]" label
      ctx.fillStyle = "#6b7280";
      ctx.font = "400 20px Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`YOUR DRIVER ${formData.driverName}`, 60, 200);

      // Driver phone
      ctx.fillStyle = "#1e40af";
      ctx.font = "bold 28px Arial, sans-serif";
      ctx.fillText(formData.driverPhone, 60, 243);

      // Vehicle sentence
      ctx.fillStyle = "#374151";
      ctx.font = "400 20px Arial, sans-serif";
      ctx.textAlign = "left";

      const vehicleName = formData.selectedVehicle
        ? formData.selectedVehicle.name
        : "vehicle";
      const vehicleColor = formData.selectedVehicle?.color || "";
      const vehicleFullName = vehicleColor
        ? `${vehicleColor} ${vehicleName}`
        : vehicleName;
      ctx.fillText(
        `${formData.driverName} drives a ${vehicleFullName}`,
        60,
        287,
      );

      // Updated notes text
      ctx.fillStyle = "#6b7280";
      ctx.font = "italic 17px Arial, sans-serif";
      ctx.fillText("Notes appear in your confirmation", 60, 320);

      // PAYMENTS header
      ctx.fillStyle = "#111827";
      ctx.font = "bold 22px Arial, sans-serif";
      ctx.fillText("PAYMENTS", 60, 368);

      // Payment methods
      ctx.fillStyle = "#374151";
      ctx.font = "400 18px Arial, sans-serif";
      ctx.fillText("• CC pre-paid", 60, 400);
      ctx.fillText("• Venmo @CatchARideLimo", 60, 428);
      ctx.fillText("• Zelle (615) 756-8152", 60, 456);
      ctx.fillText("• Cash", 60, 484);

      // 5 stars
      const starY = 523;
      const starSize = 22;
      const starSpacing = 35;
      const startX = 60;

      ctx.fillStyle = "#fbbf24";
      for (let i = 0; i < 5; i++) {
        const x = startX + i * starSpacing;
        drawStar(ctx, x, starY, starSize / 2, 5);
      }

      // Load and draw images
      await new Promise((resolve) => {
        let imagesLoaded = 0;
        const totalImages = 2;

        const checkAllLoaded = () => {
          imagesLoaded++;
          if (imagesLoaded === totalImages) resolve();
        };

        // Driver portrait — circular, positioned on the right side
        const driverImg = new Image();
        driverImg.crossOrigin = "anonymous";
        driverImg.onload = () => {
          const portraitSize = 200;
          const portraitX = canvas.width - 160; // Position on right side (60px margin from right)
          const portraitY = 265; // Vertically aligned with driver info

          ctx.save();
          ctx.beginPath();
          ctx.arc(portraitX, portraitY, portraitSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          // Calculate dimensions to cover the circle (like object-fit: cover)
          const imgAspect = driverImg.width / driverImg.height;
          const circleAspect = 1; // circle is 1:1
          let drawWidth, drawHeight, drawX, drawY;

          if (imgAspect > circleAspect) {
            // Image is wider - fit to height and crop sides
            drawHeight = portraitSize;
            drawWidth = portraitSize * imgAspect;
            drawX = portraitX - drawWidth / 2;
            drawY = portraitY - portraitSize / 2;
          } else {
            // Image is taller - fit to width and crop top/bottom
            drawWidth = portraitSize;
            drawHeight = portraitSize / imgAspect;
            drawX = portraitX - portraitSize / 2;
            drawY = portraitY - drawHeight / 2;
          }

          ctx.drawImage(driverImg, drawX, drawY, drawWidth, drawHeight);
          ctx.restore();

          ctx.strokeStyle = "#d1d5db";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(portraitX, portraitY, portraitSize / 2, 0, Math.PI * 2);
          ctx.stroke();

          // Driver name below the portrait circle
          ctx.fillStyle = "#111827";
          ctx.font = "bold 22px Arial, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            formData.driverName,
            portraitX,
            portraitY + portraitSize / 2 + 30,
          );
          ctx.textAlign = "left"; // reset alignment

          checkAllLoaded();
        };
        driverImg.onerror = () => {
          console.error("Failed to load driver portrait");
          checkAllLoaded();
        };
        driverImg.src = formData.driverPortraitUrl;

        // Vehicle image — large, bottom, with COVER fit to crop empty space
        const vehicleImg = new Image();
        vehicleImg.crossOrigin = "anonymous";
        vehicleImg.onload = () => {
          const vehicleHeight = 300;
          const vehicleWidth = 730;
          const vehicleX = (canvas.width - vehicleWidth) / 2;
          const vehicleY = 610;

          ctx.save();

          // Draw subtle background for vehicle frame
          ctx.fillStyle = "#f9fafb";
          ctx.beginPath();
          ctx.roundRect(vehicleX, vehicleY, vehicleWidth, vehicleHeight, 12);
          ctx.fill();

          // Clip to rounded rectangle
          ctx.beginPath();
          ctx.roundRect(vehicleX, vehicleY, vehicleWidth, vehicleHeight, 12);
          ctx.clip();

          // Calculate dimensions to COVER the box (like object-fit: cover) - crops edges
          const imgAspect = vehicleImg.width / vehicleImg.height;
          const boxAspect = vehicleWidth / vehicleHeight;
          let drawWidth, drawHeight, drawX, drawY;

          if (imgAspect > boxAspect) {
            // Image is wider - fit to height and crop sides
            drawHeight = vehicleHeight;
            drawWidth = vehicleHeight * imgAspect;
            drawX = vehicleX + (vehicleWidth - drawWidth) / 2;
            drawY = vehicleY;
          } else {
            // Image is taller - fit to width and crop top/bottom
            drawWidth = vehicleWidth;
            drawHeight = vehicleWidth / imgAspect;
            drawX = vehicleX;
            drawY = vehicleY + (vehicleHeight - drawHeight) / 2;
          }

          ctx.drawImage(vehicleImg, drawX, drawY, drawWidth, drawHeight);
          ctx.restore();

          ctx.strokeStyle = "#d1d5db";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(vehicleX, vehicleY, vehicleWidth, vehicleHeight, 12);
          ctx.stroke();

          checkAllLoaded();
        };
        vehicleImg.onerror = () => {
          console.error("Failed to load vehicle image");
          checkAllLoaded();
        };
        vehicleImg.src = formData.vehicleImageUrl;
      });

      // Vehicle description (optional)
      if (formData.vehicleDescription) {
        ctx.fillStyle = "#4b5563";
        ctx.font = "400 20px Arial, sans-serif";
        ctx.textAlign = "center";

        const maxWidth = canvas.width - 140;
        const lines = wrapText(ctx, formData.vehicleDescription, maxWidth);
        let textY = 950;
        lines.forEach((line) => {
          ctx.fillText(line, canvas.width / 2, textY);
          textY += 28;
        });
      }

      // Bottom contact info
      ctx.fillStyle = "#374151";
      ctx.font = "400 20px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "Reservation request to:",
        canvas.width / 2,
        canvas.height - 70,
      );

      ctx.fillStyle = "#1e40af";
      ctx.font = "bold 28px Arial, sans-serif";
      ctx.fillText("(615) 756-8152", canvas.width / 2, canvas.height - 35);

      // Upload generated canvas
      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error("Failed to generate image");

        const formDataObj = new FormData();
        formDataObj.append("file", blob, "portrait-card.png");

        const response = await fetch("/_create/api/upload/", {
          method: "POST",
          body: formDataObj,
        });

        if (!response.ok) throw new Error("Upload failed");

        const result = await response.json();
        if (!result?.url) throw new Error("No URL returned from upload");

        setGeneratedPortraitUrl(result.url);
        toast.success("Portrait card generated!", { id: "portrait-gen" });
        setStep(7);
      }, "image/png");
    } catch (err) {
      console.error("Portrait generation error:", err);
      toast.error("Failed to generate portrait card", { id: "portrait-gen" });
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = () => {
    if (generatedPortraitUrl) {
      onComplete({
        portraitUrl: generatedPortraitUrl,
        vehicleAssignmentId: formData.selectedVehicle?.assignment_id,
        vehicleDescription: formData.vehicleDescription,
      });
    }
  };

  const handleReject = () => {
    setGeneratedPortraitUrl(null);
    setStep(1);
  };

  const drawStar = (ctx, cx, cy, radius, points) => {
    ctx.save();
    ctx.beginPath();
    ctx.translate(cx, cy);
    ctx.moveTo(0, 0 - radius);
    for (let i = 0; i < points; i++) {
      ctx.rotate(Math.PI / points);
      ctx.lineTo(0, 0 - radius * 0.4);
      ctx.rotate(Math.PI / points);
      ctx.lineTo(0, 0 - radius);
    }
    ctx.fill();
    ctx.restore();
  };

  const wrapText = (ctx, text, maxWidth) => {
    const words = text.split(" ");
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;
      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Build Portrait Card
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {step <= totalSteps
                ? `Step ${step} of ${totalSteps}`
                : "Review & Approve"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* Step 1: Select Vehicle */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Select Vehicle
              </h3>
              <p className="text-sm text-gray-600">
                Choose which vehicle to feature on this portrait card
              </p>
              {vehicles && vehicles.length > 0 ? (
                <div className="space-y-2">
                  {vehicles.map((vehicle) => (
                    <button
                      key={vehicle.vehicle_id}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          selectedVehicle: vehicle,
                        }))
                      }
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        formData.selectedVehicle?.vehicle_id ===
                        vehicle.vehicle_id
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {vehicle.name}
                          </p>
                          {(vehicle.color ||
                            vehicle.category ||
                            vehicle.passenger_capacity) && (
                            <p className="text-sm text-gray-500 mt-1">
                              {[
                                vehicle.color,
                                vehicle.category,
                                vehicle.passenger_capacity
                                  ? `${vehicle.passenger_capacity} passengers`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        {formData.selectedVehicle?.vehicle_id ===
                          vehicle.vehicle_id && (
                          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                            <Check size={16} className="text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    No vehicles assigned to this driver. Please assign a vehicle
                    first.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Upload Vehicle Image */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Upload Vehicle Image
              </h3>
              <p className="text-sm text-gray-600">
                Upload a photo of{" "}
                {formData.selectedVehicle?.name || "the vehicle"}
              </p>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                {formData.vehicleImageUrl ? (
                  <div className="space-y-4">
                    <img
                      src={formData.vehicleImageUrl}
                      alt="Vehicle"
                      className="max-h-64 mx-auto rounded-lg"
                    />
                    <button
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          vehicleImageUrl: "",
                        }))
                      }
                      className="text-sm text-red-600 hover:text-red-700 underline"
                    >
                      Remove Image
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                    <input
                      type="file"
                      id="vehicle-image-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFileUpload(e.target.files?.[0], "vehicleImageUrl")
                      }
                      disabled={uploading}
                    />
                    <label
                      htmlFor="vehicle-image-upload"
                      className={`inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg cursor-pointer hover:bg-blue-700 transition-colors ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {uploading ? "Uploading..." : "Choose Vehicle Image"}
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                      PNG, JPG up to 10MB
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Upload Driver Portrait */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Upload Driver Portrait
              </h3>
              <p className="text-sm text-gray-600">
                {formData.driverPortraitUrl
                  ? "Driver portrait already uploaded. You can replace it or continue."
                  : "Upload a professional photo of the driver"}
              </p>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                {formData.driverPortraitUrl ? (
                  <div className="space-y-4">
                    <img
                      src={formData.driverPortraitUrl}
                      alt="Driver"
                      className="w-40 h-40 mx-auto rounded-full object-cover border-4 border-gray-200"
                    />
                    <button
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          driverPortraitUrl: "",
                        }))
                      }
                      className="text-sm text-red-600 hover:text-red-700 underline"
                    >
                      Remove Image
                    </button>
                  </div>
                ) : (
                  <div>
                    <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                    <input
                      type="file"
                      id="driver-portrait-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) =>
                        handleFileUpload(
                          e.target.files?.[0],
                          "driverPortraitUrl",
                        )
                      }
                      disabled={uploading}
                    />
                    <label
                      htmlFor="driver-portrait-upload"
                      className={`inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg cursor-pointer hover:bg-blue-700 transition-colors ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {uploading ? "Uploading..." : "Choose Driver Photo"}
                    </label>
                    <p className="text-xs text-gray-500 mt-2">
                      PNG, JPG up to 10MB
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Edit Driver Name */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Driver First Name
              </h3>
              <p className="text-sm text-gray-600">
                Enter the driver's first name only as it should appear on the
                card
              </p>

              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-blue-600 focus:outline-none"
                placeholder="Tami"
                value={formData.driverName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    driverName: e.target.value,
                  }))
                }
              />
            </div>
          )}

          {/* Step 5: Edit Driver Phone */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Driver Phone Number
              </h3>
              <p className="text-sm text-gray-600">
                Enter or edit the driver's contact phone number
              </p>

              <input
                type="tel"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-base focus:ring-2 focus:ring-blue-600 focus:outline-none"
                placeholder="(615) 555-1234"
                value={formData.driverPhone}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    driverPhone: e.target.value,
                  }))
                }
              />
            </div>
          )}

          {/* Step 6: Vehicle Description */}
          {step === 6 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Vehicle Description (Optional)
              </h3>
              <p className="text-sm text-gray-600">
                Add details about the vehicle (e.g., capacity, features,
                amenities)
              </p>

              <textarea
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none"
                rows={4}
                placeholder="e.g., 'Comfortable 6-passenger SUV • Spacious cargo area • Climate control • Premium sound system'"
                value={formData.vehicleDescription}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    vehicleDescription: e.target.value,
                  }))
                }
                maxLength={150}
              />
              <p className="text-xs text-gray-500 text-right">
                {formData.vehicleDescription.length} / 150 characters
              </p>
            </div>
          )}

          {/* Step 7: Approval */}
          {step === 7 && generatedPortraitUrl && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Portrait Card Preview
              </h3>
              <p className="text-sm text-gray-600">
                Review the generated portrait card. Would you like to use this?
              </p>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <img
                  src={generatedPortraitUrl}
                  alt="Generated portrait card"
                  className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleReject}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 text-lg font-bold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Start Over
                </button>
                <button
                  onClick={handleApprove}
                  className="flex-1 px-6 py-4 bg-green-600 text-white text-lg font-bold rounded-lg hover:bg-green-700 transition-colors"
                >
                  Use This Portrait
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Navigation */}
        {step <= totalSteps && (
          <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
              Back
            </button>

            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    s <= step ? "bg-blue-600" : "bg-gray-300"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              disabled={generating || uploading}
              className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === totalSteps ? (
                generating ? (
                  "Generating..."
                ) : (
                  "Generate Preview"
                )
              ) : (
                <>
                  Next
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>
        )}

        {/* Hidden canvas for generating the portrait */}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}
