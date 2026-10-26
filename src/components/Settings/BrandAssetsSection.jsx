import { useState } from "react";
import { Upload, CheckCircle } from "lucide-react";
import { toast } from "@/utils/notify";
import useUpload from "@/utils/useUpload";

export function BrandAssetsSection({ settings, handleUpdate }) {
  const [upload, { loading: uploading }] = useUpload();
  const [previewUrl, setPreviewUrl] = useState(null);

  const logoSrc = previewUrl || settings?.logo_url;

  return (
    <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
      <div className="flex items-center gap-2 text-gray-900 mb-2">
        <Upload size={18} className="text-blue-600" />
        <h2 className="font-semibold text-lg">Brand Assets</h2>
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gray-50 border border-dashed border-gray-300 rounded-xl flex items-center justify-center overflow-hidden">
            {logoSrc ? (
              <img
                src={logoSrc}
                className="max-w-full max-h-full p-2"
                alt="Logo"
              />
            ) : (
              <Upload className="text-gray-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Business Logo</p>
            <p className="text-xs text-gray-500 mb-2">
              Upload your shop logo for emails and the booking page.
            </p>
            <input
              type="file"
              id="logo-upload"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                // Show local preview immediately
                setPreviewUrl(URL.createObjectURL(file));

                toast.loading("Uploading logo...", { id: "logo-upload" });

                try {
                  const result = await upload({ file });
                  console.log("[Logo Upload] result:", result);

                  if (result?.error) {
                    toast.error(`Upload failed: ${result.error}`, {
                      id: "logo-upload",
                    });
                    setPreviewUrl(null);
                    return;
                  }

                  if (!result?.url) {
                    toast.error("Upload returned no URL — try again.", {
                      id: "logo-upload",
                    });
                    setPreviewUrl(null);
                    return;
                  }

                  setPreviewUrl(result.url);
                  handleUpdate("logo_url", result.url);
                  toast.success("Logo saved!", { id: "logo-upload" });
                } catch (err) {
                  console.error("[Logo Upload] error:", err);
                  toast.error("Logo upload failed.", { id: "logo-upload" });
                  setPreviewUrl(null);
                }
              }}
            />
            <label
              htmlFor="logo-upload"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              {uploading ? "Uploading..." : "Update Logo"}
            </label>
            {logoSrc && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle size={11} /> Logo is set
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
