export default function handler() {
  return new Response("Catch A Ride minimal test is running on Vercel", {
    status: 200,
    headers: { "Content-Type": "text/plain" }
  });
}
