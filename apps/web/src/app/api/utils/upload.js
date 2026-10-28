async function upload({
  url,
  buffer,
  base64
}) {
  // Direct API host only. Marketing host (/api/v0/upload on create.xyz /
  // anything.com) is behind Vercel bot protection. App-origin hop
  // (/_create/api/upload/) is capped at 4MB by Vercel.
  const response = await fetch(`https://api.anything.com/v0/upload`, {
    method: "POST",
    headers: {
      "Content-Type": buffer ? "application/octet-stream" : "application/json"
    },
    body: buffer ? buffer : JSON.stringify({ base64, url })
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return {
      mimeType: null,
      error: "Upload failed (" + response.status + "): non-JSON response from upload service"
    };
  }
  const data = await response.json();
  if (!response.ok) {
    return {
      mimeType: null,
      error: data.error || ("Upload failed (" + response.status + ")")
    };
  }
  return {
    url: data.url,
    mimeType: data.mimeType || null,
    error: data.error
  };
}
export { upload };
export default upload;