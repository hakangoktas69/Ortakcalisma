import { eBeyannameIsi } from '@/bff/beyanname-isi.ts';

// SGK e-Bildirge toplu güncelleme (sgk.ebildirge.sync): MUHSGK'ların SGK bildirimleri, SGK tahakkuk ve hizmet listesi PDF'leri.
export const POST = (req: Request) => eBeyannameIsi(req, 'sgk.ebildirge.sync', 'gib.muhsgk');
