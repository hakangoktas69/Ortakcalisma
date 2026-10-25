import { redirect } from 'next/navigation';

// Firma kartı tek başına bir liste değildir; listeye yönlendirilir (kart /firmalar/kart/<id>).
export default function FirmaKartlari() {
  redirect('/firmalar/liste');
}
