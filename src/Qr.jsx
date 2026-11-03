import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export const studentUrl = () => location.origin + location.pathname;

/** 학생 접속 주소 QR. 누르면 크게 보인다 */
export function Qr({ size = 72, code, big = false }) {
  const [src, setSrc] = useState('');
  const [open, setOpen] = useState(false);
  const url = studentUrl();
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 600, color: { dark: '#1f2a44', light: '#ffffff' } }).then(setSrc, () => setSrc(''));
  }, [url]);
  if (!src) return null;
  return (
    <>
      <button type="button" className={`qr ${big ? 'qr-big' : ''}`} onClick={() => setOpen(true)} title="크게 보기">
        <img src={src} alt="학생 접속 QR 코드" width={size} height={size} />
        <span className="qr-text">
          <b>📱 학생 접속</b>
          <span className="qr-url">{url.replace(/^https?:\/\//, '')}</span>
          {code && (
            <span>
              입장 코드 <b className="qr-code">{code}</b>
            </span>
          )}
        </span>
      </button>
      {open && (
        <div className="qr-modal" role="dialog" aria-label="학생 접속 QR 코드" onClick={() => setOpen(false)}>
          <div className="qr-modal-card">
            <img src={src} alt="학생 접속 QR 코드" />
            <p className="qr-modal-url">{url.replace(/^https?:\/\//, '')}</p>
            {code && (
              <p className="qr-modal-code">
                입장 코드 <b>{code}</b>
              </p>
            )}
            <p className="muted small">아무 곳이나 누르면 닫혀요</p>
          </div>
        </div>
      )}
    </>
  );
}
