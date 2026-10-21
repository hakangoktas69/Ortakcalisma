"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type InputHTMLAttributes } from "react";

/**
 * Göster/gizle düğmeli şifre kutusu. Kullanıcı yazdığını kontrol edebilir; varsayılan gizlidir.
 * className giriş kutusuna uygulanır (sayfadaki `input` sınıfıyla aynı görünür; üst boşluk mt-1 düğmede de hesaba katılır).
 */
export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
        aria-pressed={visible}
        className="absolute right-0 bottom-0 flex h-11 w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-800"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
