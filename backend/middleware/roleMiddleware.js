// Ensures only the requested roles can access a given route
const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions for this resource' });
    }
    next();
  };
};

module.exports = roleMiddleware;
