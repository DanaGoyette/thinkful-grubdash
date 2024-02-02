function errorHandler(error, request, response, next) {
  const { status = 500, message = "Something went wrong!" } = error;
  if (status === 500) console.error(error);  // Commented out to silence tests.
  response.status(status).json({ error: message });
}

module.exports = errorHandler;
