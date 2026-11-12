import fs from 'fs';
import path from 'path';

// Fotos de servicos e profissionais enviadas pela gestao. Ficam em disco: no dev local na
// pasta uploads/ do projeto e na VPS num volume do Docker montado no mesmo lugar.
export const uploadsDir = path.resolve(process.cwd(), 'uploads');

const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Grava a foto e devolve a URL que fica no banco (/uploads/...).
export async function salvarFoto(buffer: Buffer, mimetype: string, prefixo: string): Promise<string> {
  const arquivo = `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${EXT[mimetype] || '.jpg'}`;
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  await fs.promises.writeFile(path.join(uploadsDir, arquivo), buffer);
  return `/uploads/${arquivo}`;
}

// Remove uma foto enviada. As imagens prontas do site (chaves como svc_corte) nunca sao apagadas.
export async function removerFoto(url?: string | null) {
  if (!url || !url.startsWith('/uploads/')) return;
  try {
    await fs.promises.unlink(path.join(uploadsDir, path.basename(url)));
  } catch (e) {
    console.warn('[fotos] não foi possível remover', url, (e as Error).message);
  }
}
