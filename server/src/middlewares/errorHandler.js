export function errorHandler(err, req, res, next) {
  console.error("Error:", err);

  // Custom error codes and messages
  let statusCode = 500;
  let message = "Internal Server Error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = err.message;
  }

  if (err.message === "Trip not found or access denied") {
    statusCode = 404;
    message = err.message;
  }

  // Add custom codes if needed here...

  res.status(statusCode).json({ message });
}
