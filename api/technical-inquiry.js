// EMERGENCY SHUTDOWN
// Technical inquiry endpoint is intentionally disabled.
// Replace this file and redeploy when you want to restore the form.

export default async function handler(req, res) {
  res.status(503).send('Inquiry form temporarily unavailable');
}