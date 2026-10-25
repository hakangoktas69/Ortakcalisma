import { eBeyannameIsi } from '@/bff/beyanname-isi.ts';

// Beyanname senkronu (beyanname.senkron.start): beyanname + tahakkuk PDF'leri ve MUHSGK SGK bildirimleri.
export const POST = (req: Request) => eBeyannameIsi(req, 'beyanname.senkron.start', 'gib.beyannameler');
