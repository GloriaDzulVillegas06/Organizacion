import { CONFIG } from '../config.js';
export const store = {
  get(key, fallback){ try{return JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX+key)) ?? fallback}catch{return fallback} },
  set(key, value){ localStorage.setItem(CONFIG.STORAGE_PREFIX+key, JSON.stringify(value)); return value },
  remove(key){ localStorage.removeItem(CONFIG.STORAGE_PREFIX+key) }
};
