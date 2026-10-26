import { ExternalLink, AlertCircle, CheckCircle } from "lucide-react";
import { SettingInput } from "./SettingInput";

export function CustomDomainSection({ settings, handleUpdate }) {
  const customDomain = settings?.custom_domain || "";
  const hasCustomDomain = !!customDomain;

  // Check if domain looks valid (has a dot and no spaces)
  const looksValid =
    customDomain && customDomain.includes(".") && !customDomain.includes(" ");

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
          Custom Domain for Links
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          Set your deployed app domain for confirmation links and emails
        </p>
      </div>

      {/* Alert - why this is needed */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
        <div className="flex items-start gap-2">
          <AlertCircle
            size={16}
            className="text-blue-600 flex-shrink-0 mt-0.5"
          />
          <div className="text-xs text-blue-800">
            <p className="font-medium mb-1">
              ⚠️ Required for confirmation links to work
            </p>
            <p className="text-blue-700">
              If passengers or drivers report that confirmation links don't
              work, enter your app's deployed domain below. This ensures all
              email and SMS confirmation links point to your actual website, not
              a preview URL.
            </p>
          </div>
        </div>
      </div>

      <SettingInput
        label="Your App Domain"
        settingKey="custom_domain"
        value={customDomain}
        onSave={handleUpdate}
        type="text"
        placeholder="myapp.create.xyz"
        helpText="Enter your deployed app domain (with or without https://)"
      />

      {/* Status indicator */}
      {hasCustomDomain && (
        <div
          className={`rounded-lg p-3 border ${
            looksValid
              ? "bg-green-50 border-green-200"
              : "bg-yellow-50 border-yellow-200"
          }`}
        >
          <div className="flex items-start gap-2">
            {looksValid ? (
              <CheckCircle
                size={16}
                className="text-green-600 flex-shrink-0 mt-0.5"
              />
            ) : (
              <AlertCircle
                size={16}
                className="text-yellow-600 flex-shrink-0 mt-0.5"
              />
            )}
            <div className="text-xs">
              {looksValid ? (
                <>
                  <p className="font-medium text-green-800 mb-1">
                    ✓ Domain configured
                  </p>
                  <p className="text-green-700">
                    All confirmation links will use:{" "}
                    <strong>
                      {customDomain.startsWith("http")
                        ? customDomain
                        : `https://${customDomain}`}
                    </strong>
                  </p>
                  <p className="text-green-600 mt-2">
                    <a
                      href={
                        customDomain.startsWith("http")
                          ? customDomain
                          : `https://${customDomain}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-green-800 inline-flex items-center gap-1"
                    >
                      Test your domain <ExternalLink size={10} />
                    </a>
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-yellow-800 mb-1">
                    Domain format issue
                  </p>
                  <p className="text-yellow-700">
                    Your domain should look like{" "}
                    <strong>myapp.create.xyz</strong> or{" "}
                    <strong>https://myapp.create.xyz</strong>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
        <p className="text-xs font-medium text-gray-800">
          How to find your domain:
        </p>
        <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside">
          <li>
            Click the <strong>Publish</strong> button in the top right of the
            app
          </li>
          <li>
            Copy your deployed app URL (it should end with{" "}
            <strong>.create.xyz</strong> or be a custom domain)
          </li>
          <li>Paste it in the field above</li>
          <li>
            Click <strong>Save</strong>
          </li>
        </ol>
      </div>
    </div>
  );
}
