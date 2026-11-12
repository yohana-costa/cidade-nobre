import multer from 'multer';
import path from 'path';
import { falha } from '../lib/erros';

const PERMITIDAS = ['.jpg', '.jpeg', '.png', '.webp'];

// Foto em memoria; o service grava no disco. A gestao ja reduz a foto no navegador antes de enviar.
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (PERMITIDAS.includes(ext) && /^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(falha(400, 'Apenas imagens são permitidas (jpg, png ou webp).'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});
