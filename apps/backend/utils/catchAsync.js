// Async error handling wrapper
// This function wraps async route handlers to catch any errors and pass them to the global error handler

module.exports = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};