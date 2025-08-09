import jwt from 'jsonwebtoken';
import config from '../config.js';

export function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: '7d',
  });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}
