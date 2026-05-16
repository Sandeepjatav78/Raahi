import axios from 'axios';
import { API_ROOT } from '../config';
import { storage } from './storage';

export const api = axios.create({
  baseURL: API_ROOT,
  timeout: 15000
});

api.interceptors.request.use(async (config) => {
  const token = await storage.getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
