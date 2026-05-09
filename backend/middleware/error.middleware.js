function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
  const status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  const payload = {
    error: {
      message: status === 500 ? "Internal server error" : err.message
    }
  };

  if (process.env.NODE_ENV !== "production") {
    payload.error.details = err.message;
  }

  res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };
