import { useState } from "react";
import { toast } from "sonner";

export default function ProfileImageUpload({ value, onChange }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    toast.loading("Uploading profile image...", { id: "profile-upload" });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/_create/api/upload/", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();

      if (!result?.url) {
        throw new Error("No URL returned from upload");
      }

      onChange(result.url);
      toast.success("Profile image uploaded!", { id: "profile-upload" });
    } catch (err) {
      console.error("Profile image upload error:", err);
      toast.error("Failed to upload image", { id: "profile-upload" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Profile Image
      </label>
      {value && (
        <div className="flex items-center gap-3 mb-2">
          <img
            src={value}
            alt="Driver profile"
            className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Remove Image
          </button>
        </div>
      )}
      <input
        type="file"
        id="profile-image-upload"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />
      <label
        htmlFor="profile-image-upload"
        className={`block w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-center cursor-pointer hover:bg-gray-50 transition-colors ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {uploading ? "Uploading..." : value ? "Change Image" : "Upload Image"}
      </label>
      <p className="text-[11px] text-gray-400">
        Upload a profile image (JPG, PNG, max 10MB)
      </p>
    </div>
  );
}
